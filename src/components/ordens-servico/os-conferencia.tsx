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
}

interface Evento {
  id: string;
  tipo: string;
  quantidade: number;
  registradoPor: string | null;
  createdAt: string;
  item: { nome: string; codigo: string };
}

// BarcodeDetector ainda não está nas typings padrão
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const BarcodeDetector: any;

export function OsConferencia({ osId }: { osId: string }) {
  const { toast } = useToast();
  const [resumo, setResumo] = useState<ResumoItem[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
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
    } catch {}
  }, [osId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const registrar = useCallback(
    async (payload: { itemId?: string; codigo?: string; quantidade?: number }) => {
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
            d.evento?.item?.nome || "item"
          }`,
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

  const itemOptions = resumo.map((r) => ({
    value: r.itemId,
    label: `${r.codigo ? r.codigo + " — " : ""}${r.nome}`,
    keywords: [r.apelidos, r.descricaoComercial].filter(Boolean).join(" "),
  }));

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
          onClick={() => setTipo("SAIDA")}
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
          onClick={() => setTipo("ENTRADA")}
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
        <div className="col-span-12 sm:col-span-7">
          <Select
            label="Buscar item manualmente"
            searchable
            value={itemSel}
            onChange={(e) => setItemSel(e.target.value)}
            options={itemOptions}
            placeholder="Digite código, nome ou apelido"
          />
        </div>
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
        <div className="col-span-8 sm:col-span-3">
          <Button
            className="w-full"
            loading={registrando}
            disabled={!itemSel}
            onClick={async () => {
              const ok = await registrar({ itemId: itemSel, quantidade: qtd });
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
                      <span className="font-medium text-slate-800">{r.nome}</span>
                      {r.codigo && (
                        <span className="text-slate-400 text-xs"> ({r.codigo})</span>
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
                  {ev.quantidade}x {ev.item?.nome}
                  {ev.item?.codigo ? ` (${ev.item.codigo})` : ""} —{" "}
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
