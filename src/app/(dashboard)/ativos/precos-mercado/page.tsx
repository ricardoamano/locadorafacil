"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { FileUp, Trash2, Search, Database } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Banco de Preços de Mercado: suba PDFs de orçamentos de concorrentes e
// parceiros — a IA extrai os preços e alimenta as sugestões do sistema.

export default function PrecosMercadoPage() {
  const { toast } = useToast();
  const [registros, setRegistros] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(
    (q?: string) => {
      fetch(`/api/precos-mercado?busca=${encodeURIComponent(q ?? busca)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setRegistros(d.registros || []))
        .catch(() => {});
    },
    [busca]
  );

  useEffect(() => {
    carregar("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => carregar(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  async function enviarPdf(file: File) {
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/precos-mercado", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(
        d.parcial
          ? `⚠️ ${d.importados} preço(s) importado(s) de "${d.fonte}" — o PDF era grande e a leitura foi parcial; revise se faltou algum item.`
          : `✅ ${d.importados} preço(s) importado(s) de "${d.fonte}"!`,
        "success"
      );
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro na importação.", "error");
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function excluir(id: string) {
    await fetch(`/api/precos-mercado?id=${id}`, { method: "DELETE" });
    carregar();
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Ativos" }, { label: "Banco de Preços" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="h-6 w-6 text-violet-600" />
              Banco de Preços de Mercado
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Suba PDFs de orçamentos de concorrentes e parceiros — a IA extrai os preços,
              guarda a empresa de origem e alimenta as sugestões de preço e o chat de Ajuda.
            </p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviarPdf(f);
              }}
            />
            <Button onClick={() => fileRef.current?.click()} loading={enviando}>
              <FileUp className="h-4 w-4" />
              {enviando ? "Analisando PDF..." : "Importar PDF de orçamento"}
            </Button>
          </div>
        </div>

        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar equipamento, modelo, marca ou empresa..."
            className="pl-9"
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          {registros.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <Database className="h-8 w-8" />
              <p className="text-sm">
                {busca
                  ? "Nada encontrado"
                  : "Nenhum preço no banco ainda — importe o primeiro PDF de orçamento."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3">Equipamento</th>
                  <th className="px-4 py-3">Marca / Modelo</th>
                  <th className="px-4 py-3">Empresa (fonte)</th>
                  <th className="px-4 py-3 text-right">Diária</th>
                  <th className="px-4 py-3 text-right">Semana</th>
                  <th className="px-4 py-3 text-right">Mês</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.equipamento}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {[r.marca, r.modelo].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-violet-50 text-violet-700 text-xs font-medium px-2 py-0.5">
                        {r.fonte || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {r.diaria != null ? formatCurrency(r.diaria) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {r.semana != null ? formatCurrency(r.semana) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {r.mes != null ? formatCurrency(r.mes) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[140px] truncate">
                      {r.documento || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => excluir(r.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          {registros.length} registro(s) · valores unitários por diária · a pesquisa de
          mercado do cadastro de itens consulta este banco primeiro
        </p>
      </main>
    </>
  );
}
