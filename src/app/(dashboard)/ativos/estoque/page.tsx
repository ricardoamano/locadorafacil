"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import {
  PackageCheck,
  PackageOpen,
  Wrench,
  AlertTriangle,
  Boxes,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EstoquePage() {
  const [dados, setDados] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/estoque")
      .then((r) => r.json())
      .then(setDados)
      .finally(() => setLoading(false));
  }, []);

  const r = dados?.resumo;

  return (
    <>
      <Header breadcrumbs={[{ label: "Ativos" }, { label: "Estoque em Tempo Real" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Estoque em Tempo Real</h1>
          <p className="text-sm text-slate-500 mt-1">
            Onde cada unidade física está agora — atualizado pelos bipes de saída e
            entrada nas Ordens de Serviço
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <PackageCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Em estoque</p>
                  <p className="text-lg font-bold text-slate-900">
                    {r?.emEstoque ?? 0}
                    <span className="text-xs font-normal text-slate-400"> / {r?.total ?? 0}</span>
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <PackageOpen className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Em eventos</p>
                  <p className="text-lg font-bold text-amber-700">{r?.fora ?? 0}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Wrench className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Em manutenção</p>
                  <p className="text-lg font-bold text-blue-700">{r?.manutencao ?? 0}</p>
                </div>
              </div>
              <div
                className={`rounded-xl border shadow-sm p-4 flex items-center gap-3 ${
                  (r?.atrasadas ?? 0) > 0
                    ? "bg-red-50 border-red-200"
                    : "bg-white border-slate-100"
                }`}
              >
                <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Devolução atrasada</p>
                  <p className="text-lg font-bold text-red-600">{r?.atrasadas ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Unidades fora */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
              <p className="px-4 pt-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Unidades em eventos ({dados?.fora?.length || 0})
              </p>
              {(dados?.fora || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 gap-2 text-slate-400">
                  <Boxes className="h-7 w-7" />
                  <p className="text-sm">Tudo em estoque — nenhuma unidade fora. ✅</p>
                </div>
              ) : (
                <table className="w-full min-w-[640px] text-sm mt-2">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500">
                      <th className="text-left px-4 py-2 font-semibold">Unidade</th>
                      <th className="text-left px-4 py-2 font-semibold">Item</th>
                      <th className="text-left px-4 py-2 font-semibold">Evento / OS</th>
                      <th className="text-left px-4 py-2 font-semibold">Cliente</th>
                      <th className="text-left px-4 py-2 font-semibold">Fim do evento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {dados.fora.map((u: any) => (
                      <tr key={u.id} className={u.atrasada ? "bg-red-50/50" : ""}>
                        <td className="px-4 py-2 font-mono font-medium text-slate-800">
                          {u.codigo}
                        </td>
                        <td className="px-4 py-2 text-slate-700">{u.itemNome}</td>
                        <td className="px-4 py-2">
                          {u.osId ? (
                            <Link
                              href={`/ordens-servico/${u.osId}`}
                              className="text-blue-600 hover:underline"
                            >
                              OS #{u.osNumero}
                              {u.evento ? ` — ${u.evento}` : ""}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-500">{u.cliente || "—"}</td>
                        <td className="px-4 py-2">
                          {u.dataFim ? (
                            <span className={u.atrasada ? "text-red-600 font-semibold" : "text-slate-500"}>
                              {new Date(u.dataFim).toLocaleDateString("pt-BR")}
                              {u.atrasada ? " ⚠ atrasada" : ""}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Manutenção */}
            {(dados?.manutencao || []).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Em manutenção ({dados.manutencao.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {dados.manutencao.map((u: any) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full"
                    >
                      <Wrench className="h-3 w-3" />
                      <span className="font-mono font-medium">{u.codigo}</span>
                      {u.itemNome}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
