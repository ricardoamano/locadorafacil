"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  QrCode,
  ScanLine,
  PackageCheck,
  PackageOpen,
  Trash2,
  CheckCircle2,
  X,
  Plus,
} from "lucide-react";

interface ResumoItem {
  itemId: string;
  nome: string;
  codigo: string;
  apelidos: string | null;
  descricaoComercial: string | null;
  quantidade: number;
  saida: number;
  entrada: number;
  extra?: boolean;
}

interface Evento {
  id: string;
  tipo: string;
  quantidade: number;
  registradoPor: string | null;
  createdAt: string;
  item: { nome: string; codigo: string };
  unidade?: { codigo: string } | null;
}

interface ItemExtra {
  id: string;
  quantidade: number;
  observacao: string | null;
  adicionadoPor: string | null;
  item: { id: string; nome: string; codigo: string };
}

interface ItemCatalogo {
  id: string;
  nome: string;
  codigo: string;
  apelidos?: string | null;
}

interface Unidade {
  id: string;
  codigo: string;
  numero: number;
  status: string;
  itemId: string;
  itemNome: string;
  osAtualId: string | null;
  osAtualNumero: number | null;
  osAtualEvento: string | null;
}

// BarcodeDetector ainda não está nas typings padrão
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const BarcodeDetector: any;

export function OsConferencia({ osId }: { osId: string }) {
  const { toast } = useToast();
  const [resumo, setResumo] = useState<ResumoItem[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [extras, setExtras] = useState<ItemExtra[]>([]);
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([]);
  const [extraSel, setExtraSel] = useState("");
  const [extraQtd, setExtraQtd] = useState(1);
  const [extraObs, setExtraObs] = useState("");
  const [addExtra, setAddExtra] = useState(false);
  const [tipo, setTipo] = useState<"SAIDA" | "ENTRADA">("SAIDA");
  const [itemSel, setItemSel] = useState("");
  const [qtd, setQtd] = useState(1);
  const [registrando, setRegistrando] = useState(false);
  const [scanAberto, setScanAberto] = useState(false);
  const [scanSuportado, setScanSuportado] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cooldownRef = useRef<number>(0);
  const tipoRef = useRef(tipo);
  tipoRef.current = tipo;

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/ordens-servico/${osId}/conferencia`);
      if (!res.ok) return;
      const d = await res.json();
      setResumo(d.resumo || []);
      setEventos(d.eventos || []);
      setUnidades(d.unidades || []);
      const re = await fetch(`/api/ordens-servico/${osId}/itens-extras`);
      if (re.ok) {
        const de = await re.json();
        setExtras(de.extras || []);
      }
    } catch {}
  }, [osId]);

  useEffect(() => {
    carregar();
    fetch("/api/itens?limit=500")
      .then((r) => r.json())
      .then((d) => setCatalogo(d.itens || []))
      .catch(() => {});
  }, [carregar]);

  async function adicionarExtra() {
    if (!extraSel) return;
    try {
      const res = await fetch(`/api/ordens-servico/${osId}/itens-extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: extraSel, quantidade: extraQtd, observacao: extraObs }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Erro ao adicionar item.", "error");
        return;
      }
      toast(`${d.item?.nome || "Item"} adicionado à OS!`, "success");
      setExtraSel("");
      setExtraQtd(1);
      setExtraObs("");
      setAddExtra(false);
      carregar();
    } catch {
      toast("Erro ao adicionar item.", "error");
    }
  }

  async function removerExtra(extraId: string) {
    try {
      const res = await fetch(
        `/api/ordens-servico/${osId}/itens-extras?extraId=${extraId}`,
        { method: "DELETE" }
      );
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Erro ao remover.", "error");
        return;
      }
      toast("Item avulso removido da OS.", "success");
      carregar();
    } catch {
      toast("Erro ao remover.", "error");
    }
  }

  const registrar = useCallback(
    async (payload: { itemId?: string; unidadeId?: string; codigo?: string; quantidade?: number }) => {
      setRegistrando(true);
      try {
        const res = await fetch(`/api/ordens-servico/${osId}/conferencia`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, tipo: tipoRef.current }),
        });
        const d = await res.json();
        if (!res.ok) {
          toast(d.error || "Erro ao registrar.", "error");
          return false;
        }
        setResumo(d.resumo || []);
        toast(
          `${tipoRef.current === "SAIDA" ? "Saída" : "Entrada"} registrada: ${
            d.evento?.unidade?.codigo ? d.evento.unidade.codigo + " — " : ""
          }${d.evento?.item?.nome || "item"}`,
          "success"
        );
        carregar();
        return true;
      } catch {
        toast("Erro ao registrar.", "error");
        return false;
      } finally {
        setRegistrando(false);
      }
    },
    [osId, toast, carregar]
  );

  // ── Scanner de QR code (câmera) ──────────────────────────────────────────
  const pararScanner = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanAberto(false);
  }, []);

  async function abrirScanner() {
    if (typeof BarcodeDetector === "undefined") {
      setScanSuportado(false);
      toast(
        "Este navegador não suporta leitura de QR pela câmera. Use a busca manual abaixo.",
        "error"
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setScanAberto(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 50);

      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes?.[0]?.rawValue as string | undefined;
          if (raw && Date.now() - cooldownRef.current > 2500) {
            cooldownRef.current = Date.now();
            // O QR da etiqueta contém uma URL com ?search=CODIGO
            let codigo = raw;
            try {
              const u = new URL(raw);
              codigo = u.searchParams.get("search") || raw;
            } catch {}
            await registrar({ codigo, quantidade: 1 });
          }
        } catch {}
        if (streamRef.current) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      toast("Não foi possível acessar a câmera. Use a busca manual.", "error");
      setScanSuportado(false);
    }
  }

  useEffect(() => () => pararScanner(), [pararScanner]);

  async function desfazer(eventoId: string) {
    try {
      const res = await fetch(
        `/api/ordens-servico/${osId}/conferencia?eventoId=${eventoId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      toast("Registro desfeito.", "success");
      carregar();
    } catch {
      toast("Erro ao desfazer.", "error");
    }
  }

  // Unidades elegíveis conforme o modo: saída = em estoque; entrada = no evento desta OS
  const unidadesElegiveis = unidades.filter((u) =>
    tipo === "SAIDA"
      ? u.status === "EM_ESTOQUE"
      : u.status === "NO_EVENTO" && u.osAtualId === osId
  );
  const itensComUnidade = new Set(unidades.map((u) => u.itemId));
  const itemOptions = [
    ...unidadesElegiveis.map((u) => {
      const r = resumo.find((x) => x.itemId === u.itemId);
      return {
        value: `u:${u.id}`,
        label: `${u.codigo} — ${u.itemNome}`,
        keywords: [r?.apelidos, r?.descricaoComercial].filter(Boolean).join(" "),
      };
    }),
    // Itens sem unidades serializadas: registro por quantidade
    ...resumo
      .filter((r) => !itensComUnidade.has(r.itemId))
      .map((r) => ({
        value: `i:${r.itemId}`,
        label: `${r.codigo ? r.codigo + " — " : ""}${r.nome} (por quantidade)`,
        keywords: [r.apelidos, r.descricaoComercial].filter(Boolean).join(" "),
      })),
  ];
  const selecaoPorQuantidade = itemSel.startsWith("i:");

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <ScanLine className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">
          Conferência de Equipamentos (Saída / Entrada)
        </h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Registre a saída do estoque para o evento e o retorno, bipando o QR code da
        etiqueta do item ou usando a busca manual.
      </p>

      {/* Modo */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => {
            setTipo("SAIDA");
            setItemSel("");
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            tipo === "SAIDA"
              ? "bg-amber-50 border-amber-300 text-amber-700"
              : "border-slate-200 text-slate-500 hover:bg-slate-50"
          }`}
        >
          <PackageOpen className="h-4 w-4" />
          Saída p/ evento
        </button>
        <button
          onClick={() => {
            setTipo("ENTRADA");
            setItemSel("");
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            tipo === "ENTRADA"
              ? "bg-green-50 border-green-300 text-green-700"
              : "border-slate-200 text-slate-500 hover:bg-slate-50"
          }`}
        >
          <PackageCheck className="h-4 w-4" />
          Entrada (devolução)
        </button>
      </div>

      {/* Scanner */}
      <div className="mb-4">
        {!scanAberto ? (
          <Button variant="outline" onClick={abrirScanner}>
            <QrCode className="h-4 w-4" />
            Escanear QR code
          </Button>
        ) : (
          <div className="relative w-full max-w-sm">
            <video
              ref={videoRef}
              className="w-full rounded-lg border border-slate-200"
              muted
              playsInline
            />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="h-40 w-40 border-2 border-blue-400 rounded-lg" />
            </div>
            <button
              onClick={pararScanner}
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 flex items-center justify-center text-slate-600 shadow"
              title="Fechar câmera"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-xs text-slate-400 mt-1">
              Aponte a câmera para a etiqueta — cada leitura registra 1 unidade em modo{" "}
              {tipo === "SAIDA" ? "Saída" : "Entrada"}.
            </p>
          </div>
        )}
        {!scanSuportado && (
          <p className="text-xs text-amber-600 mt-1">
            Leitura pela câmera indisponível neste navegador — use a busca manual abaixo.
          </p>
        )}
      </div>

      {/* Busca manual */}
      <div className="grid grid-cols-12 gap-2 items-end mb-5">
        <div className={selecaoPorQuantidade ? "col-span-12 sm:col-span-7" : "col-span-12 sm:col-span-9"}>
          <Select
            label={`Buscar unidade manualmente (${tipo === "SAIDA" ? "disponíveis em estoque" : "no evento desta OS"})`}
            searchable
            value={itemSel}
            onChange={(e) => setItemSel(e.target.value)}
            options={itemOptions}
            placeholder="Digite código, nome ou apelido"
          />
        </div>
        {selecaoPorQuantidade && (
          <div className="col-span-4 sm:col-span-2">
            <label className="text-sm font-medium text-slate-700 block mb-1">Qtd</label>
            <input
              type="number"
              min={1}
              value={qtd}
              onChange={(e) => setQtd(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        <div className={selecaoPorQuantidade ? "col-span-8 sm:col-span-3" : "col-span-12 sm:col-span-3"}>
          <Button
            className="w-full"
            loading={registrando}
            disabled={!itemSel}
            onClick={async () => {
              const payload = itemSel.startsWith("u:")
                ? { unidadeId: itemSel.slice(2) }
                : { itemId: itemSel.slice(2), quantidade: qtd };
              const ok = await registrar(payload);
              if (ok) {
                setItemSel("");
                setQtd(1);
              }
            }}
          >
            Registrar {tipo === "SAIDA" ? "saída" : "entrada"}
          </Button>
        </div>
      </div>

      {/* Itens avulsos (fora do orçamento) */}
      <div className="mb-5 border border-dashed border-slate-200 rounded-lg p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Itens avulsos nesta OS (fora do orçamento)
          </p>
          {!addExtra && (
            <Button variant="outline" size="sm" onClick={() => setAddExtra(true)}>
              <Plus className="h-4 w-4" />
              Adicionar item avulso
            </Button>
          )}
        </div>

        {extras.length > 0 && (
          <ul className="mt-2 space-y-1">
            {extras.map((ex) => (
              <li
                key={ex.id}
                className="flex items-center justify-between text-sm text-slate-700 border-b border-slate-50 pb-1"
              >
                <span className="text-red-600">
                  {ex.quantidade}x {ex.item.nome}
                  {ex.item.codigo ? (
                    <span className="text-red-400 text-xs"> ({ex.item.codigo})</span>
                  ) : null}
                  {ex.observacao ? (
                    <span className="text-slate-400 text-xs italic"> — {ex.observacao}</span>
                  ) : null}
                  {ex.adicionadoPor ? (
                    <span className="text-slate-300 text-xs"> · por {ex.adicionadoPor}</span>
                  ) : null}
                </span>
                <button
                  onClick={() => removerExtra(ex.id)}
                  className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors shrink-0"
                  title="Remover item avulso"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {extras.length === 0 && !addExtra && (
          <p className="text-xs text-slate-400 mt-1">
            Item esquecido no orçamento ou acessório operacional (ex.: escada, notebook)?
            Lance aqui para poder dar saída e entrada no estoque.
          </p>
        )}

        {addExtra && (
          <div className="grid grid-cols-12 gap-2 items-end mt-3">
            <div className="col-span-12 sm:col-span-5">
              <Select
                label="Item"
                searchable
                value={extraSel}
                onChange={(e) => setExtraSel(e.target.value)}
                options={catalogo.map((i) => ({
                  value: i.id,
                  label: `${i.codigo ? i.codigo + " — " : ""}${i.nome}`,
                  keywords: i.apelidos || "",
                }))}
                placeholder="Digite código, nome ou apelido"
              />
            </div>
            <div className="col-span-3 sm:col-span-1">
              <label className="text-sm font-medium text-slate-700 block mb-1">Qtd</label>
              <input
                type="number"
                min={1}
                value={extraQtd}
                onChange={(e) => setExtraQtd(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-9 sm:col-span-3">
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Motivo (opcional)
              </label>
              <input
                value={extraObs}
                onChange={(e) => setExtraObs(e.target.value.slice(0, 100))}
                placeholder="Ex: acessório de montagem"
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-6 sm:col-span-2">
              <Button className="w-full" disabled={!extraSel} onClick={adicionarExtra}>
                Adicionar
              </Button>
            </div>
            <div className="col-span-6 sm:col-span-1">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setAddExtra(false);
                  setExtraSel("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Progresso por item */}
      {resumo.length > 0 && (
        <div className="border border-slate-100 rounded-lg overflow-x-auto mb-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Item</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Previsto</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Saída</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Entrada</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {resumo.map((r) => {
                const saiu = r.saida >= r.quantidade;
                const voltou = r.entrada >= r.quantidade;
                return (
                  <tr key={r.itemId}>
                    <td className="px-3 py-2">
                      <span className={`font-medium ${r.extra ? "text-red-600" : "text-slate-800"}`}>
                        {r.nome}
                      </span>
                      {r.codigo && (
                        <span className={`text-xs ${r.extra ? "text-red-400" : "text-slate-400"}`}>
                          {" "}({r.codigo})
                        </span>
                      )}
                      {r.extra && (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                          extra / acessório
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600">{r.quantidade}</td>
                    <td className={`px-3 py-2 text-center font-medium ${saiu ? "text-amber-600" : "text-slate-500"}`}>
                      {r.saida}/{r.quantidade}
                    </td>
                    <td className={`px-3 py-2 text-center font-medium ${voltou ? "text-green-600" : "text-slate-500"}`}>
                      {r.entrada}/{r.quantidade}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {voltou ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Devolvido
                        </span>
                      ) : saiu ? (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          No evento
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Em estoque
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Unidades presas em outros eventos — onde estão */}
      {(() => {
        const emOutraOs = unidades.filter(
          (u) => u.status === "NO_EVENTO" && u.osAtualId !== osId
        );
        if (emOutraOs.length === 0) return null;
        return (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">
              ⚠ Unidades destes equipamentos em outros eventos:
            </p>
            <ul className="text-xs text-amber-700 space-y-0.5">
              {emOutraOs.map((u) => (
                <li key={u.id}>
                  <span className="font-mono font-medium">{u.codigo}</span> — {u.itemNome}:
                  {" "}OS #{u.osAtualNumero ?? "?"}
                  {u.osAtualEvento ? ` (${u.osAtualEvento})` : ""}
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Histórico */}
      {eventos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Últimos registros
          </p>
          <ul className="space-y-1">
            {eventos.slice(0, 8).map((ev) => (
              <li
                key={ev.id}
                className="flex items-center justify-between text-xs text-slate-600 border-b border-slate-50 pb-1"
              >
                <span>
                  <span
                    className={`font-semibold ${
                      ev.tipo === "SAIDA" ? "text-amber-600" : "text-green-600"
                    }`}
                  >
                    {ev.tipo === "SAIDA" ? "Saída" : "Entrada"}
                  </span>{" "}
                  {ev.unidade?.codigo ? (
                    <span className="font-mono font-medium">{ev.unidade.codigo}</span>
                  ) : (
                    `${ev.quantidade}x`
                  )}{" "}
                  {ev.item?.nome} —{" "}
                  {new Date(ev.createdAt).toLocaleString("pt-BR")}
                  {ev.registradoPor ? ` por ${ev.registradoPor}` : ""}
                </span>
                <button
                  onClick={() => desfazer(ev.id)}
                  className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors shrink-0"
                  title="Desfazer registro"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
