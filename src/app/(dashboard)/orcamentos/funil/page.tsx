"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { Kanban, List, GripVertical } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Funil visual (Kanban) de orçamentos — arraste o card entre as colunas para
// mudar o status. Aprovar dispara os mesmos efeitos da lista (OS + receita).

const COLUNAS: { key: string; label: string; cor: string; corTopo: string }[] = [
  { key: "PENDENTE", label: "Pendente", cor: "bg-amber-50", corTopo: "border-amber-400" },
  { key: "AGUARDANDO", label: "Aguardando cliente", cor: "bg-blue-50", corTopo: "border-blue-400" },
  { key: "APROVADO", label: "Aprovado", cor: "bg-emerald-50", corTopo: "border-emerald-400" },
  { key: "REPROVADO", label: "Perdido", cor: "bg-red-50", corTopo: "border-red-300" },
  { key: "CANCELADO", label: "Cancelado", cor: "bg-slate-50", corTopo: "border-slate-300" },
];

interface Orc {
  id: string;
  numero: number;
  status: string;
  eventoNome: string | null;
  dataInicio: string | null;
  total: number;
  projetoEspecial?: boolean;
  cliente: { nomeFantasia: string } | null;
}

export default function FunilPage() {
  const { toast } = useToast();
  const [orcamentos, setOrcamentos] = useState<Orc[]>([]);
  const [loading, setLoading] = useState(true);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [movendo, setMovendo] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orcamentos?limit=200");
      const d = await res.json();
      setOrcamentos(d.orcamentos || []);
    } catch {
      toast("Erro ao carregar o funil.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mover(id: string, novoStatus: string) {
    const orc = orcamentos.find((o) => o.id === id);
    if (!orc || orc.status === novoStatus || movendo) return;
    const anterior = orc.status;
    setMovendo(true);
    // Otimista: move o card na hora
    setOrcamentos((p) => p.map((o) => (o.id === id ? { ...o, status: novoStatus } : o)));
    try {
      const res = await fetch(`/api/orcamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (novoStatus === "APROVADO") {
        toast(`🎉 Orçamento #${orc.numero} aprovado — OS e financeiro gerados.`, "success");
      } else {
        toast(`Orçamento #${orc.numero} movido para ${COLUNAS.find((c) => c.key === novoStatus)?.label}.`, "success");
      }
    } catch (e) {
      setOrcamentos((p) => p.map((o) => (o.id === id ? { ...o, status: anterior } : o)));
      toast(e instanceof Error && e.message ? e.message : "Erro ao mover.", "error");
    } finally {
      setMovendo(false);
    }
  }

  const fechados =
    orcamentos.filter((o) => o.status === "APROVADO").length +
    orcamentos.filter((o) => ["REPROVADO", "CANCELADO"].includes(o.status)).length;
  const taxa =
    fechados > 0
      ? Math.round((orcamentos.filter((o) => o.status === "APROVADO").length / fechados) * 100)
      : null;

  return (
    <>
      <Header breadcrumbs={[{ label: "Orçamentos", href: "/orcamentos" }, { label: "Funil" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Kanban className="h-6 w-6 text-blue-600" />
              Funil de orçamentos
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Arraste os cards entre as colunas para mudar o status.
              {taxa !== null && (
                <span className="ml-2 font-medium text-slate-700">
                  Taxa de conversão: {taxa}%
                </span>
              )}
            </p>
          </div>
          <Link href="/orcamentos">
            <Button variant="outline">
              <List className="h-4 w-4" />
              Ver em lista
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUNAS.map((col) => {
              const cards = orcamentos.filter((o) => o.status === col.key);
              const totalCol = cards.reduce((s, o) => s + (o.total || 0), 0);
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSobre(col.key);
                  }}
                  onDragLeave={() => setSobre((s) => (s === col.key ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setSobre(null);
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) mover(id, col.key);
                  }}
                  className={`w-72 shrink-0 rounded-xl border-t-4 ${col.corTopo} ${col.cor} border border-slate-100 transition-shadow ${
                    sobre === col.key ? "ring-2 ring-blue-400 shadow-md" : ""
                  }`}
                >
                  <div className="px-3 pt-3 pb-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">{col.label}</h3>
                      <span className="text-xs font-medium text-slate-500 bg-white/70 rounded-full px-2 py-0.5">
                        {cards.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(totalCol)}</p>
                  </div>
                  <div className="px-2 pb-2 space-y-2 min-h-24 max-h-[calc(100vh-320px)] overflow-y-auto">
                    {cards.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-6">
                        Solte um card aqui
                      </p>
                    )}
                    {cards.map((o) => (
                      <div
                        key={o.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", o.id);
                          setArrastando(o.id);
                        }}
                        onDragEnd={() => setArrastando(null)}
                        className={`group bg-white rounded-lg border border-slate-100 shadow-sm p-3 cursor-grab active:cursor-grabbing transition-opacity ${
                          arrastando === o.id ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="h-4 w-4 text-slate-200 group-hover:text-slate-400 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <Link
                              href={
                                o.projetoEspecial
                                  ? `/orcamentos/projeto/${o.id}`
                                  : `/orcamentos/${o.id}`
                              }
                              className="text-sm font-semibold text-slate-900 hover:text-blue-600"
                            >
                              #{o.numero}
                              {o.projetoEspecial && (
                                <span className="ml-1 text-[10px] font-medium text-violet-600">
                                  projeto
                                </span>
                              )}
                            </Link>
                            <p className="text-xs text-slate-600 truncate">
                              {o.cliente?.nomeFantasia || "—"}
                            </p>
                            {o.eventoNome && (
                              <p className="text-xs text-slate-400 truncate">{o.eventoNome}</p>
                            )}
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-xs font-semibold text-slate-800">
                                {formatCurrency(o.total)}
                              </span>
                              {o.dataInicio && (
                                <span className="text-[11px] text-slate-400">
                                  {new Date(o.dataInicio).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
