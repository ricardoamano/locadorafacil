"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Wrench, Pencil } from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  PENDENTE: { label: "Pendente", variant: "warning" },
  AGUARDANDO: { label: "Aguardando", variant: "info" },
  APROVADO: { label: "Aprovado", variant: "success" },
  REPROVADO: { label: "Reprovado", variant: "danger" },
  CANCELADO: { label: "Cancelado", variant: "neutral" },
};

interface Orcamento {
  id: string;
  numero: number;
  status: string;
  eventoNome: string | null;
  dataInicio: string | null;
  total: number;
  cliente: { id: string; nomeFantasia: string };
  local: { id: string; nome: string } | null;
}

export default function PostosServicoPage() {
  const { toast } = useToast();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orcamentos?postos=1&limit=100");
      const data = await res.json();
      setOrcamentos(data.orcamentos || []);
    } catch {
      toast("Erro ao carregar dados.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <>
      <Header breadcrumbs={[{ label: "Postos de Serviço" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Postos de Serviço</h1>
            <p className="text-sm text-slate-500 mt-1">
              Eventos e orçamentos de clientes marcados como posto de serviço oficial
            </p>
          </div>
          <Link href="/orcamentos/novo">
            <Button>
              <Plus className="h-4 w-4" />
              Novo Evento de Posto
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : orcamentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400 text-center px-6">
              <Wrench className="h-8 w-8" />
              <p className="text-sm">
                Nenhum orçamento de posto de serviço ainda.
              </p>
              <p className="text-xs">
                Marque um cliente como &quot;Posto de Serviço Oficial&quot; no cadastro e
                crie orçamentos para ele — eles aparecerão aqui.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Nº", "Posto / Evento", "Data", "Status", "Total", "Ações"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                        i >= 4 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orcamentos.map((orc) => {
                  const cfg = statusConfig[orc.status] || statusConfig.PENDENTE;
                  return (
                    <tr key={orc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono font-medium text-slate-700">
                          #{orc.numero}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">
                          {orc.cliente?.nomeFantasia}
                        </p>
                        <p className="text-xs text-slate-400">
                          {orc.eventoNome || "—"}
                          {orc.local ? ` · ${orc.local.nome}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {orc.dataInicio
                          ? new Date(orc.dataInicio).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                        {formatCurrency(orc.total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/orcamentos/${orc.id}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Abrir"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
