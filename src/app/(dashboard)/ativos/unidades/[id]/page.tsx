"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FotosUpload } from "@/components/ui/fotos-upload";
import { useToast } from "@/components/ui/toast";
import { NaoEncontrado } from "@/components/ui/nao-encontrado";
import {
  Wrench,
  Archive,
  PackageCheck,
  AlertTriangle,
  MessageSquarePlus,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  Package,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_INFO: Record<string, { label: string; variant: "success" | "info" | "warning" | "danger" | "neutral" }> = {
  EM_ESTOQUE: { label: "Em estoque", variant: "success" },
  NO_EVENTO: { label: "No evento", variant: "info" },
  MANUTENCAO: { label: "Em manutenção", variant: "warning" },
  BAIXADA: { label: "Baixada", variant: "danger" },
};

const TIPO_TIMELINE: Record<string, { label: string; cor: string; Icon: any }> = {
  SAIDA: { label: "Saída", cor: "text-amber-600 bg-amber-50", Icon: ArrowUpRight },
  RETORNO: { label: "Retorno", cor: "text-emerald-600 bg-emerald-50", Icon: ArrowDownLeft },
  MANUTENCAO: { label: "Manutenção", cor: "text-orange-600 bg-orange-50", Icon: Wrench },
  BAIXA: { label: "Baixa", cor: "text-red-600 bg-red-50", Icon: Archive },
  RETORNO_ESTOQUE: { label: "Voltou ao estoque", cor: "text-emerald-600 bg-emerald-50", Icon: PackageCheck },
  AVARIA: { label: "Avaria", cor: "text-red-600 bg-red-50", Icon: AlertTriangle },
  OBSERVACAO: { label: "Observação", cor: "text-slate-600 bg-slate-100", Icon: MessageSquarePlus },
};

export default function UnidadePage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [unidade, setUnidade] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [naoAchou, setNaoAchou] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]);
  const [obs, setObs] = useState("");
  const [salvandoInfo, setSalvandoInfo] = useState(false);
  // Ações com motivo
  const [acao, setAcao] = useState<null | { status: string; titulo: string }>(null);
  const [motivo, setMotivo] = useState("");
  const [executando, setExecutando] = useState(false);
  // Ocorrência
  const [ocorrencia, setOcorrencia] = useState<null | "AVARIA" | "OBSERVACAO">(null);
  const [ocorrenciaTexto, setOcorrenciaTexto] = useState("");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/unidades/${params.id}`);
      if (!res.ok) {
        setNaoAchou(true);
        return;
      }
      const d = await res.json();
      setUnidade(d.unidade);
      setTimeline(d.timeline || []);
      setFotos(Array.isArray(d.unidade.fotos) ? d.unidade.fotos : []);
      setObs(d.unidade.observacoes || "");
    } catch {
      setNaoAchou(true);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarInfo(fotosNovas?: string[]) {
    setSalvandoInfo(true);
    try {
      const res = await fetch(`/api/unidades/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacoes: obs, fotos: fotosNovas ?? fotos }),
      });
      if (!res.ok) throw new Error();
      toast("Informações da unidade salvas!", "success");
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setSalvandoInfo(false);
    }
  }

  async function executarAcao() {
    if (!acao) return;
    setExecutando(true);
    try {
      const res = await fetch(`/api/unidades/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: acao.status, motivo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(`${acao.titulo} registrada.`, "success");
      setAcao(null);
      setMotivo("");
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro.", "error");
    } finally {
      setExecutando(false);
    }
  }

  async function registrarOcorrencia() {
    if (!ocorrencia || !ocorrenciaTexto.trim()) return;
    setExecutando(true);
    try {
      const res = await fetch(`/api/unidades/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: ocorrencia, descricao: ocorrenciaTexto }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(ocorrencia === "AVARIA" ? "Avaria registrada." : "Observação registrada.", "success");
      setOcorrencia(null);
      setOcorrenciaTexto("");
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro.", "error");
    } finally {
      setExecutando(false);
    }
  }

  if (loading)
    return (
      <>
        <Header breadcrumbs={[{ label: "Ativos" }, { label: "Unidade" }]} />
        <main className="pt-14 p-6 flex items-center justify-center h-60">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </main>
      </>
    );
  if (naoAchou || !unidade)
    return (
      <>
        <Header breadcrumbs={[{ label: "Ativos" }, { label: "Unidade" }]} />
        <main className="pt-14 p-6">
          <NaoEncontrado mensagem="Unidade não encontrada." voltarHref="/ativos/itens" voltarLabel="Voltar para Itens" />
        </main>
      </>
    );

  const st = STATUS_INFO[unidade.status] || STATUS_INFO.EM_ESTOQUE;
  const noEvento = unidade.status === "NO_EVENTO";

  return (
    <>
      <Header
        breadcrumbs={[
          { label: "Ativos" },
          { label: "Itens" },
          { label: unidade.codigo },
        ]}
      />
      <main className="pt-14 p-6 max-w-4xl">
        {/* Cabeçalho da unidade */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              {unidade.item.fotoCapaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={unidade.item.fotoCapaUrl}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover border border-slate-100"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Package className="h-7 w-7 text-blue-600" />
                </div>
              )}
              <div>
                <p className="text-2xl font-bold font-mono text-slate-900">{unidade.codigo}</p>
                <Link
                  href={`/ativos/itens?search=${encodeURIComponent(unidade.item.codigo || unidade.item.nome)}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {unidade.item.nome}
                </Link>
                <p className="text-xs text-slate-400">
                  {[unidade.item.marca?.nome, unidade.item.modelo, unidade.item.categoria?.nome]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant={st.variant}>{st.label}</Badge>
              {noEvento && unidade.os?.orcamento && (
                <p className="text-xs text-slate-500 mt-1">
                  {unidade.os.orcamento.eventoNome || `OS #${unidade.os.orcamento.numero}`}
                </p>
              )}
              {unidade.proximaManutencao && (
                <p className="text-xs text-amber-600 mt-1">
                  Próx. manutenção: {new Date(unidade.proximaManutencao).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          </div>

          {/* Ações em destaque */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {unidade.status !== "MANUTENCAO" && (
              <button
                onClick={() => setAcao({ status: "MANUTENCAO", titulo: "Manutenção" })}
                disabled={noEvento}
                className="flex flex-col items-center gap-1 rounded-xl border-2 border-orange-200 bg-orange-50 py-3 text-orange-700 font-medium text-sm hover:bg-orange-100 transition-colors disabled:opacity-40"
              >
                <Wrench className="h-5 w-5" />
                Enviar p/ manutenção
              </button>
            )}
            {unidade.status !== "EM_ESTOQUE" && !noEvento && (
              <button
                onClick={() => setAcao({ status: "EM_ESTOQUE", titulo: "Retorno ao estoque" })}
                className="flex flex-col items-center gap-1 rounded-xl border-2 border-emerald-200 bg-emerald-50 py-3 text-emerald-700 font-medium text-sm hover:bg-emerald-100 transition-colors"
              >
                <PackageCheck className="h-5 w-5" />
                Voltar ao estoque
              </button>
            )}
            {unidade.status !== "BAIXADA" && (
              <button
                onClick={() => setAcao({ status: "BAIXADA", titulo: "Baixa" })}
                disabled={noEvento}
                className="flex flex-col items-center gap-1 rounded-xl border-2 border-red-200 bg-red-50 py-3 text-red-700 font-medium text-sm hover:bg-red-100 transition-colors disabled:opacity-40"
              >
                <Archive className="h-5 w-5" />
                Dar baixa
              </button>
            )}
            <button
              onClick={() => setOcorrencia("AVARIA")}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-amber-200 bg-amber-50 py-3 text-amber-700 font-medium text-sm hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="h-5 w-5" />
              Registrar avaria
            </button>
            <button
              onClick={() => setOcorrencia("OBSERVACAO")}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-slate-200 bg-white py-3 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              <MessageSquarePlus className="h-5 w-5" />
              Anotar observação
            </button>
          </div>
          {noEvento && (
            <p className="text-xs text-slate-500 mt-2">
              A unidade está no evento — para manutenção/baixa, registre a entrada na conferência
              da OS primeiro.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fotos e observações da unidade */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
            <FotosUpload
              label="Fotos desta unidade"
              value={fotos}
              onChange={(f) => {
                setFotos(f);
                salvarInfo(f);
              }}
              consultaBusca={[unidade.item.marca?.nome, unidade.item.modelo, unidade.item.nome]
                .filter(Boolean)
                .join(" ")}
            />
            <div>
              <Textarea
                label="Observações desta unidade"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Ex.: risco na lateral, controle remoto com fita, nº de série..."
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <Button size="sm" onClick={() => salvarInfo()} loading={salvandoInfo}>
                  Salvar observações
                </Button>
              </div>
            </div>
          </div>

          {/* Histórico */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
              <History className="h-4 w-4 text-blue-600" />
              Histórico da unidade
            </h2>
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nenhuma movimentação ainda. Saídas e retornos aparecem aqui quando a unidade for
                conferida numa OS.
              </p>
            ) : (
              <ul className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {timeline.map((t) => {
                  const info = TIPO_TIMELINE[t.tipo] || TIPO_TIMELINE.OBSERVACAO;
                  return (
                    <li key={t.id} className="flex gap-3">
                      <span className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${info.cor}`}>
                        <info.Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800">
                          {t.osId ? (
                            <Link href={`/ordens-servico/${t.osId}`} className="hover:underline">
                              {t.descricao}
                            </Link>
                          ) : (
                            t.descricao
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(t.em).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {t.autor ? ` · ${t.autor}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Modal de ação com motivo */}
        <Modal
          open={!!acao}
          onClose={() => setAcao(null)}
          title={acao?.titulo || ""}
          size="sm"
        >
          <ModalBody>
            <p className="text-sm text-slate-600 mb-3">
              {acao?.status === "MANUTENCAO" && `Enviar ${unidade.codigo} para manutenção?`}
              {acao?.status === "BAIXADA" &&
                `Dar baixa em ${unidade.codigo}? Ela sai do estoque definitivamente.`}
              {acao?.status === "EM_ESTOQUE" && `Retornar ${unidade.codigo} ao estoque?`}
            </p>
            <Textarea
              label="Motivo / detalhes (opcional)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: fonte queimada, enviado à assistência X..."
              rows={2}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setAcao(null)} disabled={executando}>
              Cancelar
            </Button>
            <Button onClick={executarAcao} loading={executando}>
              Confirmar
            </Button>
          </ModalFooter>
        </Modal>

        {/* Modal de ocorrência */}
        <Modal
          open={!!ocorrencia}
          onClose={() => setOcorrencia(null)}
          title={ocorrencia === "AVARIA" ? "Registrar avaria" : "Anotar observação"}
          size="sm"
        >
          <ModalBody>
            <Textarea
              label={ocorrencia === "AVARIA" ? "O que aconteceu? *" : "Observação *"}
              value={ocorrenciaTexto}
              onChange={(e) => setOcorrenciaTexto(e.target.value)}
              placeholder={
                ocorrencia === "AVARIA"
                  ? "Ex.: tela trincada no canto, voltou do evento X com risco..."
                  : "Ex.: repassada limpeza geral, atualizado firmware..."
              }
              rows={3}
              autoFocus
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setOcorrencia(null)} disabled={executando}>
              Cancelar
            </Button>
            <Button onClick={registrarOcorrencia} loading={executando} disabled={!ocorrenciaTexto.trim()}>
              Registrar
            </Button>
          </ModalFooter>
        </Modal>
      </main>
    </>
  );
}
