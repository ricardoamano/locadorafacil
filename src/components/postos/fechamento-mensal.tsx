"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { FileText, CalendarClock } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Fechamento mensal do posto: soma os eventos aprovados do mês e gera UMA
// única fatura de locação consolidada.

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function FechamentoMensal({ onFaturado }: { onFaturado?: () => void }) {
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [postos, setPostos] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [mes, setMes] = useState(mesAtual());
  const [diasVenc, setDiasVenc] = useState("30");
  const [previa, setPrevia] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    fetch("/api/contacts?type=CLIENTE&postos=1&limit=200")
      .then((r) => r.json())
      .then((d) => setPostos((d.contacts || []).filter((c: any) => c.isPostoServico)))
      .catch(() => {});
  }, [aberto]);

  const carregarPrevia = useCallback(() => {
    if (!clienteId || !/^\d{4}-\d{2}$/.test(mes)) {
      setPrevia(null);
      return;
    }
    setCarregando(true);
    fetch(`/api/postos-servico/fechar-fatura?clienteId=${clienteId}&mes=${mes}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPrevia(d))
      .catch(() => setPrevia(null))
      .finally(() => setCarregando(false));
  }, [clienteId, mes]);

  useEffect(() => {
    carregarPrevia();
  }, [carregarPrevia]);

  async function gerar() {
    setGerando(true);
    try {
      const res = await fetch("/api/postos-servico/fechar-fatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, mes, diasVencimento: Number(diasVenc) || 30 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(
        `✅ Fatura #${d.numero} gerada — ${d.eventos} evento(s), ${formatCurrency(d.valor)}.`,
        "success"
      );
      setAberto(false);
      setPrevia(null);
      onFaturado?.();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao gerar fatura.", "error");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <CalendarClock className="h-4 w-4" />
        Fechar fatura do mês
      </Button>

      <Modal
        open={aberto}
        onClose={() => !gerando && setAberto(false)}
        title="Fechamento mensal do posto"
        size="lg"
      >
        <ModalBody>
          <p className="text-sm text-slate-500 mb-4">
            Some todos os eventos aprovados do posto no mês e gere uma única fatura de
            locação consolidada.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Select
                label="Posto de serviço"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                options={postos.map((p) => ({ value: p.id, label: p.nomeFantasia }))}
                placeholder="Selecione"
                searchable
              />
            </div>
            <Input
              label="Mês (AAAA-MM)"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              placeholder="2026-07"
            />
            <Input
              label="Vencimento (dias)"
              type="number"
              value={diasVenc}
              onChange={(e) => setDiasVenc(e.target.value)}
            />
          </div>

          <div className="mt-4">
            {carregando ? (
              <p className="text-sm text-slate-400 text-center py-6">Carregando eventos...</p>
            ) : previa ? (
              previa.quantidade > 0 ? (
                <div className="rounded-lg border border-slate-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase text-slate-400">
                        <th className="px-3 py-2">Evento</th>
                        <th className="px-3 py-2">Data</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa.eventos.map((e: any, i: number) => (
                        <tr key={i} className="border-t border-slate-50">
                          <td className="px-3 py-2 text-slate-700">
                            <span className="text-slate-400">#{e.numero}</span> {e.evento}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {e.data ? new Date(e.data).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatCurrency(e.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="px-3 py-2 font-semibold" colSpan={2}>
                          Total ({previa.quantidade} evento{previa.quantidade > 1 ? "s" : ""})
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {formatCurrency(previa.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-amber-600 text-center py-6">
                  Nenhum evento aprovado em aberto para este posto neste mês.
                </p>
              )
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">
                Selecione o posto e o mês para ver os eventos.
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setAberto(false)} disabled={gerando}>
            Cancelar
          </Button>
          <Button
            onClick={gerar}
            loading={gerando}
            disabled={!previa || previa.quantidade === 0}
          >
            <FileText className="h-4 w-4" />
            Gerar fatura consolidada
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
