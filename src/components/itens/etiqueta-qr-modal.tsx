"use client";

import React, { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Printer, Wrench, Undo2, Ban } from "lucide-react";

interface EtiquetaItem {
  id: string;
  codigo: string;
  nome: string;
  apelidos?: string | null;
}

interface Unidade {
  id: string;
  numero: number;
  codigo: string;
  status: string;
  os?: { id: string; orcamento?: { numero: number; eventoNome: string | null } } | null;
}

interface EtiquetaQrModalProps {
  open: boolean;
  onClose: () => void;
  item: EtiquetaItem | null;
}

const statusCfg: Record<string, { label: string; cls: string }> = {
  EM_ESTOQUE: { label: "Em estoque", cls: "bg-slate-100 text-slate-600" },
  NO_EVENTO: { label: "No evento", cls: "bg-amber-50 text-amber-700" },
  MANUTENCAO: { label: "Manutenção", cls: "bg-blue-50 text-blue-700" },
  BAIXADA: { label: "Baixada", cls: "bg-red-50 text-red-600" },
};

export function EtiquetaQrModal({ open, onClose, item }: EtiquetaQrModalProps) {
  const { toast } = useToast();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);

  const carregar = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/itens/${item.id}/unidades`);
      const d = await res.json();
      const lista: Unidade[] = d.unidades || [];
      setUnidades(lista);
      setSelecionadas(
        new Set(lista.filter((u) => u.status !== "BAIXADA").map((u) => u.id))
      );
    } catch {
      setUnidades([]);
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    if (open) carregar();
  }, [open, carregar]);

  function alternar(id: string) {
    setSelecionadas((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function mudarStatus(u: Unidade, status: string) {
    if (!item) return;
    try {
      const res = await fetch(`/api/itens/${item.id}/unidades`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unidadeId: u.id, status }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Erro ao atualizar unidade.", "error");
        return;
      }
      carregar();
    } catch {
      toast("Erro ao atualizar unidade.", "error");
    }
  }

  async function imprimir() {
    if (!item) return;
    const alvo = unidades.filter((u) => selecionadas.has(u.id));
    if (alvo.length === 0) {
      toast("Selecione ao menos uma unidade.", "error");
      return;
    }
    setImprimindo(true);
    try {
      const blocos: string[] = [];
      for (const u of alvo) {
        const url = `${window.location.origin}/ativos/itens?search=${encodeURIComponent(u.codigo)}`;
        const qr = await QRCode.toDataURL(url, { width: 480, margin: 1 });
        blocos.push(`
          <div class="etiqueta">
            <img src="${qr}" alt="QR" />
            <div class="info">
              <p class="codigo">${u.codigo}</p>
              <p class="nome">${item.nome}</p>
              ${item.apelidos ? `<p class="apelido">${item.apelidos}</p>` : ""}
            </div>
          </div>`);
      }
      const w = window.open("", "_blank", "width=480,height=640");
      if (!w) return;
      w.document.write(`<!doctype html>
<html><head><title>Etiquetas ${item.codigo || item.nome}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 8mm; }
  .etiqueta {
    display: flex; align-items: center; gap: 6mm;
    border: 1px dashed #999; border-radius: 3mm;
    padding: 5mm; margin-bottom: 5mm;
    width: 90mm; height: 40mm; overflow: hidden;
    page-break-inside: avoid;
  }
  .etiqueta img { width: 28mm; height: 28mm; }
  .codigo { font-size: 14pt; font-weight: bold; font-family: monospace; }
  .nome { font-size: 10pt; margin-top: 2mm; }
  .apelido { font-size: 8pt; font-style: italic; color: #555; margin-top: 1mm; }
  @media print { body { padding: 0; } }
</style></head>
<body>${blocos.join("")}
<script>window.onload = function(){ window.print(); }</script>
</body></html>`);
      w.document.close();
    } finally {
      setImprimindo(false);
    }
  }

  if (!item) return null;

  return (
    <Modal open={open} onClose={onClose} title="Unidades e Etiquetas QR" size="lg">
      <ModalBody>
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-900">
            {item.nome}{" "}
            <span className="font-mono text-slate-400 font-normal">({item.codigo})</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Cada unidade física tem código e QR próprios — bipe na OS para registrar
            saída e entrada e saber exatamente onde cada unidade está.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : unidades.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Nenhuma unidade — informe a quantidade no cadastro do item que as unidades
            são geradas automaticamente.
          </p>
        ) : (
          <div className="border border-slate-100 rounded-lg divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {unidades.map((u) => {
              const cfg = statusCfg[u.status] || statusCfg.EM_ESTOQUE;
              return (
                <div key={u.id} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selecionadas.has(u.id)}
                    onChange={() => alternar(u.id)}
                    className="h-4 w-4 rounded"
                    title="Incluir na impressão"
                  />
                  <span className="font-mono text-sm font-medium text-slate-800 w-24 shrink-0">
                    {u.codigo}
                  </span>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}
                  >
                    {cfg.label}
                  </span>
                  {u.status === "NO_EVENTO" && u.os?.orcamento && (
                    <span className="text-xs text-slate-400 truncate">
                      OS #{u.os.orcamento.numero}
                      {u.os.orcamento.eventoNome ? ` — ${u.os.orcamento.eventoNome}` : ""}
                    </span>
                  )}
                  <span className="flex-1" />
                  {u.status === "EM_ESTOQUE" && (
                    <>
                      <button
                        onClick={() => mudarStatus(u, "MANUTENCAO")}
                        className="p-1 rounded text-slate-300 hover:text-blue-600 transition-colors"
                        title="Enviar para manutenção"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => mudarStatus(u, "BAIXADA")}
                        className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors"
                        title="Baixar unidade (perda/descarte)"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {(u.status === "MANUTENCAO" || u.status === "BAIXADA") && (
                    <button
                      onClick={() => mudarStatus(u, "EM_ESTOQUE")}
                      className="p-1 rounded text-slate-300 hover:text-green-600 transition-colors"
                      title="Retornar ao estoque"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button onClick={imprimir} loading={imprimindo} disabled={unidades.length === 0}>
          <Printer className="h-4 w-4" />
          Imprimir {selecionadas.size} etiqueta{selecionadas.size === 1 ? "" : "s"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
