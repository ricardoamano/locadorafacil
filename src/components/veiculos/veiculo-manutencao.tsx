"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { Wrench, Plus, Trash2, FileText, Paperclip } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Modal de manutenções + documentos do veículo.
// Manutenção genérica: qualquer tipo (óleo, pneus, revisão, freios...),
// com km, custo, próxima prevista (data/km) e comprovantes/fotos anexados.

const TIPOS_FALLBACK = ["Troca de óleo", "Pneus", "Revisão", "Freios", "Bateria", "Funilaria", "Alinhamento"];

function dataCurta(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : null;
}

export function VeiculoManutencaoModal({
  veiculo,
  onClose,
}: {
  veiculo: { id: string; placa: string; modelo: string } | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [manutencoes, setManutencoes] = useState<any[]>([]);
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null); // manutencaoId ou "DOC"
  const [linkDoc, setLinkDoc] = useState("");
  // Classificações de manutenção: padrão + as criadas pela empresa
  const [tiposPadrao, setTiposPadrao] = useState<string[]>(TIPOS_FALLBACK);
  const [tiposCustom, setTiposCustom] = useState<string[]>([]);
  const [novoTipo, setNovoTipo] = useState("");
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [form, setForm] = useState({
    tipo: "", data: new Date().toISOString().slice(0, 10), km: "", custo: "",
    descricao: "", proximaData: "", proximaKm: "", observacoes: "",
  });

  const carregar = useCallback(() => {
    if (!veiculo) return;
    setCarregando(true);
    fetch(`/api/veiculos/${veiculo.id}/manutencoes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setManutencoes(d.manutencoes || []);
        setArquivos(d.arquivos || []);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [veiculo]);

  useEffect(() => {
    fetch("/api/veiculos/tipos-manutencao")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTiposPadrao(d.padrao || TIPOS_FALLBACK);
        setTiposCustom(d.custom || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (veiculo) {
      setFormAberto(false);
      setForm({
        tipo: "", data: new Date().toISOString().slice(0, 10), km: "", custo: "",
        descricao: "", proximaData: "", proximaKm: "", observacoes: "",
      });
      carregar();
    }
  }, [veiculo, carregar]);

  async function salvarManutencao() {
    if (!veiculo) return;
    if (!form.tipo.trim()) {
      toast("Informe o tipo de manutenção.", "error");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch(`/api/veiculos/${veiculo.id}/manutencoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast("Manutenção registrada! Anexe os comprovantes se quiser. 🔧", "success");
      setFormAberto(false);
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirManutencao(id: string) {
    if (!veiculo) return;
    try {
      const res = await fetch(
        `/api/veiculos/${veiculo.id}/manutencoes?manutencaoId=${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      carregar();
    } catch {
      toast("Erro ao excluir.", "error");
    }
  }

  async function uploadArquivo(file: File, manutencaoId: string | null) {
    if (!veiculo) return;
    setEnviando(manutencaoId || "DOC");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (manutencaoId) fd.append("manutencaoId", manutencaoId);
      const res = await fetch(`/api/veiculos/${veiculo.id}/arquivos`, {
        method: "POST",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      carregar();
      toast("Arquivo anexado!", "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao enviar.", "error");
    } finally {
      setEnviando(null);
    }
  }

  async function anexarLinkDoc() {
    if (!veiculo || !linkDoc.trim()) return;
    setEnviando("DOC");
    try {
      const res = await fetch(`/api/veiculos/${veiculo.id}/arquivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkDoc.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setLinkDoc("");
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao anexar.", "error");
    } finally {
      setEnviando(null);
    }
  }

  async function excluirArquivo(id: string) {
    if (!veiculo) return;
    try {
      const res = await fetch(`/api/veiculos/${veiculo.id}/arquivos?arquivoId=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      carregar();
    } catch {
      toast("Erro ao remover.", "error");
    }
  }

  async function criarTipo() {
    const nome = novoTipo.trim();
    if (!nome) return;
    setCriandoTipo(true);
    try {
      const res = await fetch("/api/veiculos/tipos-manutencao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setTiposCustom(d.custom || []);
      setForm((p) => ({ ...p, tipo: nome }));
      setNovoTipo("");
      toast(`Classificação "${nome}" criada.`, "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao criar.", "error");
    } finally {
      setCriandoTipo(false);
    }
  }

  async function removerTipo(nome: string) {
    try {
      const res = await fetch(
        `/api/veiculos/tipos-manutencao?nome=${encodeURIComponent(nome)}`,
        { method: "DELETE" }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setTiposCustom(d.custom || []);
    } catch {
      toast("Erro ao remover classificação.", "error");
    }
  }

  const documentos = arquivos.filter((a) => !a.manutencaoId);
  const anexosDe = (manutencaoId: string) => arquivos.filter((a) => a.manutencaoId === manutencaoId);

  return (
    <Modal
      open={!!veiculo}
      onClose={onClose}
      title={veiculo ? `🔧 ${veiculo.modelo} — ${veiculo.placa}` : ""}
      size="xl"
    >
      <ModalBody>
        {carregando ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Documentos do veículo */}
            <div className="rounded-lg border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-slate-900">Documentos do veículo</h4>
              </div>
              <p className="text-xs text-slate-400 mb-2">
                CRLV em PDF, seguro, IPVA... qualquer arquivo (até 4 MB) ou link.
              </p>
              {documentos.length > 0 && (
                <div className="space-y-1 mb-2">
                  {documentos.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="text-slate-400 text-xs">{a.tipo === "LINK" ? "🔗" : "📄"}</span>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                        {a.titulo}
                      </a>
                      <button onClick={() => excluirArquivo(a.id)} className="ml-auto text-slate-300 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 items-center">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:border-blue-300 cursor-pointer">
                  {enviando === "DOC" ? "Enviando..." : "📤 Enviar documento"}
                  <input
                    type="file"
                    className="hidden"
                    disabled={enviando === "DOC"}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadArquivo(f, null);
                      e.target.value = "";
                    }}
                  />
                </label>
                <div className="flex-1 min-w-40 flex gap-2">
                  <Input
                    value={linkDoc}
                    onChange={(e) => setLinkDoc(e.target.value)}
                    placeholder="ou cole um link"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        anexarLinkDoc();
                      }
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={anexarLinkDoc}>
                    Anexar
                  </Button>
                </div>
              </div>
            </div>

            {/* Manutenções */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-semibold text-slate-900">
                    Histórico de manutenções ({manutencoes.length})
                  </h4>
                </div>
                <Button size="sm" variant="outline" onClick={() => setFormAberto((v) => !v)}>
                  <Plus className="h-4 w-4" />
                  Nova manutenção
                </Button>
              </div>

              {formAberto && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 mb-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {tiposPadrao.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, tipo: t }))}
                        className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                          form.tipo === t
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                    {tiposCustom.map((t) => (
                      <span
                        key={t}
                        className={`group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs border transition-colors ${
                          form.tipo === t
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-violet-50 text-violet-700 border-violet-200 hover:border-violet-300"
                        }`}
                      >
                        <button type="button" onClick={() => setForm((p) => ({ ...p, tipo: t }))}>
                          {t}
                        </button>
                        <button
                          type="button"
                          onClick={() => removerTipo(t)}
                          title="Excluir esta classificação"
                          className={form.tipo === t ? "text-blue-200 hover:text-white" : "text-violet-300 hover:text-red-500"}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      value={novoTipo}
                      onChange={(e) => setNovoTipo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          criarTipo();
                        }
                      }}
                      placeholder={criandoTipo ? "Criando..." : "+ nova classificação (Enter)"}
                      disabled={criandoTipo}
                      className="h-6 w-48 rounded-full border border-dashed border-slate-300 bg-white px-2.5 text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <Input
                        label="Tipo de manutenção *"
                        value={form.tipo}
                        onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                        placeholder="Ex.: Troca de óleo, correia dentada..."
                      />
                    </div>
                    <Input
                      label="Data *"
                      type="date"
                      value={form.data}
                      onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
                    />
                    <Input
                      label="Km atual"
                      type="number"
                      value={form.km}
                      onChange={(e) => setForm((p) => ({ ...p, km: e.target.value }))}
                      placeholder="87.500"
                    />
                    <Input
                      label="Custo (R$)"
                      type="number"
                      step="0.01"
                      value={form.custo}
                      onChange={(e) => setForm((p) => ({ ...p, custo: e.target.value }))}
                    />
                    <Input
                      label="Próxima (data)"
                      type="date"
                      value={form.proximaData}
                      onChange={(e) => setForm((p) => ({ ...p, proximaData: e.target.value }))}
                    />
                    <Input
                      label="Próxima (km)"
                      type="number"
                      value={form.proximaKm}
                      onChange={(e) => setForm((p) => ({ ...p, proximaKm: e.target.value }))}
                      placeholder="97.500"
                    />
                  </div>
                  <Textarea
                    label="O que foi feito"
                    value={form.descricao}
                    onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                    rows={2}
                    placeholder="Óleo 5W30 sintético + filtro de óleo e de ar..."
                  />
                  <Textarea
                    label="Observações"
                    value={form.observacoes}
                    onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                    rows={2}
                    placeholder="Ex.: próxima troca em 10.000 km ou 6 meses, o que vier primeiro"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setFormAberto(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={salvarManutencao} loading={salvando}>
                      Registrar manutenção
                    </Button>
                  </div>
                </div>
              )}

              {manutencoes.length === 0 && !formAberto ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  Nenhuma manutenção registrada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {manutencoes.map((m) => (
                    <div key={m.id} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {m.tipo}
                            <span className="ml-2 text-xs font-normal text-slate-400">
                              {dataCurta(m.data)}
                              {m.km != null ? ` · ${Number(m.km).toLocaleString("pt-BR")} km` : ""}
                              {m.custo != null ? ` · ${formatCurrency(m.custo)}` : ""}
                            </span>
                          </p>
                          {m.descricao && (
                            <p className="text-xs text-slate-600 mt-0.5">{m.descricao}</p>
                          )}
                          {(m.proximaData || m.proximaKm != null || m.observacoes) && (
                            <p className="text-xs text-amber-700 mt-1">
                              ⏭ Próxima:{" "}
                              {[
                                dataCurta(m.proximaData),
                                m.proximaKm != null
                                  ? `${Number(m.proximaKm).toLocaleString("pt-BR")} km`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" ou ") || "—"}
                              {m.observacoes ? ` · ${m.observacoes}` : ""}
                            </p>
                          )}
                          {anexosDe(m.id).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {anexosDe(m.id).map((a) => (
                                <span key={a.id} className="inline-flex items-center gap-1 text-xs">
                                  <a
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    📎 {a.titulo}
                                  </a>
                                  <button
                                    onClick={() => excluirArquivo(a.id)}
                                    className="text-slate-300 hover:text-red-500"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <label
                            title="Anexar comprovante/foto"
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                          >
                            {enviando === m.id ? (
                              <span className="h-4 w-4 block animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                            ) : (
                              <Paperclip className="h-4 w-4" />
                            )}
                            <input
                              type="file"
                              className="hidden"
                              disabled={!!enviando}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadArquivo(f, m.id);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <button
                            onClick={() => excluirManutencao(m.id)}
                            title="Excluir manutenção"
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
