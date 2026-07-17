"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import {
  Landmark,
  Upload,
  Check,
  Plus,
  EyeOff,
  ArrowLeft,
  Link2,
  ChevronDown,
  Sparkles,
} from "lucide-react";

// Conciliação bancária: importa o OFX do banco e revisa linha a linha.
// Nada entra no fluxo de caixa sem aprovação — cada linha vira:
// conciliada (casa com lançamento existente), criada (lançamento novo) ou ignorada.

interface Sugestao {
  id: string;
  nome: string;
  valor: number;
  tipo: string;
  status: string;
  dataRecebimento: string;
  score: number;
  forte: boolean;
}

interface Linha {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  arquivoNome: string | null;
  banco: { nome: string } | null;
  sugestoes: Sugestao[];
}

interface BancoOpt {
  id: string;
  nome: string;
}

function fmtData(s: string): string {
  return new Date(s).toLocaleDateString("pt-BR");
}

export default function ConciliacaoPage() {
  const { toast } = useToast();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [totais, setTotais] = useState<Record<string, number>>({});
  const [bancos, setBancos] = useState<BancoOpt[]>([]);
  const [bancoId, setBancoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [agindo, setAgindo] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const d = await fetch("/api/transacoes/extrato").then((r) => r.json());
      setLinhas(d.linhas || []);
      setTotais(d.totais || {});
    } catch {
      toast("Erro ao carregar a conciliação.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregar();
    fetch("/api/bancos")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBancos(Array.isArray(d) ? d : d?.bancos || []))
      .catch(() => {});
  }, [carregar]);

  async function importar(file: File) {
    setImportando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      if (bancoId) fd.append("bancoId", bancoId);
      const res = await fetch("/api/transacoes/extrato", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(
        `${d.importados} lançamentos importados${d.duplicados ? ` (${d.duplicados} já tinham sido importados antes)` : ""}.`,
        "success"
      );
      await carregar();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao importar.", "error");
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function agir(linhaId: string, payload: Record<string, unknown>, otimista = true) {
    setAgindo(linhaId);
    try {
      const res = await fetch(`/api/transacoes/extrato/${linhaId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (otimista) setLinhas((p) => p.filter((l) => l.id !== linhaId));
      else await carregar();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na ação.", "error");
      await carregar();
    } finally {
      setAgindo(null);
    }
  }

  async function conciliarFortes() {
    const fortes = linhas.filter((l) => l.sugestoes[0]?.forte);
    if (fortes.length === 0) return;
    // usa cada transação uma vez só, mesmo se sugerida em duas linhas
    const usadas = new Set<string>();
    let feitos = 0;
    for (const l of fortes) {
      const s = l.sugestoes[0];
      if (usadas.has(s.id)) continue;
      usadas.add(s.id);
      await agir(l.id, { acao: "conciliar", transacaoId: s.id });
      feitos++;
    }
    toast(`${feitos} linhas conciliadas automaticamente. ✅`, "success");
  }

  const fortes = linhas.filter((l) => l.sugestoes[0]?.forte).length;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/financeiro" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <Landmark className="h-5 w-5 text-emerald-700" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Conciliação bancária</h1>
            <p className="text-xs text-slate-500">
              Importe o extrato (OFX) e aprove linha a linha — nada entra sem a sua revisão.
            </p>
          </div>
        </div>
        <div className="flex gap-3 text-xs text-slate-500">
          {totais.CONCILIADA ? <span>✅ {totais.CONCILIADA} conciliadas</span> : null}
          {totais.CRIADA ? <span>➕ {totais.CRIADA} criadas</span> : null}
          {totais.IGNORADA ? <span>🚫 {totais.IGNORADA} ignoradas</span> : null}
        </div>
      </div>

      {/* Importação */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Conta / banco do extrato
            </label>
            <select
              value={bancoId}
              onChange={(e) => setBancoId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— escolher depois —</option>
              {bancos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".ofx,.OFX,application/x-ofx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])}
          />
          <Button onClick={() => fileRef.current?.click()} loading={importando}>
            <Upload className="h-4 w-4" />
            Importar extrato (OFX)
          </Button>
          <p className="text-xs text-slate-400 basis-full">
            Exporte o extrato no app/site do banco em formato <strong>OFX</strong> (Nubank, Itaú,
            Bradesco, BB, Inter...). Reimportar o mesmo arquivo não duplica nada.
          </p>
        </div>
      </div>

      {/* Aprovação em massa */}
      {fortes > 0 && (
        <button
          onClick={conciliarFortes}
          className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium hover:bg-emerald-100 text-left flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Conciliar automaticamente as {fortes} linhas com correspondência forte (valor e data
          batendo)
        </button>
      )}

      {/* Linhas pendentes */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        ) : linhas.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 text-sm">
            Nenhuma linha pendente. Importe um extrato acima para começar. 🎉
          </div>
        ) : (
          linhas.map((l) => {
            const top = l.sugestoes[0];
            return (
              <div key={l.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-52">
                    <p className="text-sm font-medium text-slate-800">{l.descricao}</p>
                    <p className="text-xs text-slate-400">
                      {fmtData(l.data)}
                      {l.banco ? ` · ${l.banco.nome}` : ""}
                      {l.arquivoNome ? ` · ${l.arquivoNome}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold ${l.valor > 0 ? "text-emerald-600" : "text-red-500"}`}
                  >
                    {l.valor > 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(l.valor))}
                  </span>
                </div>

                {/* Sugestão de match */}
                {top ? (
                  <div
                    className={`mt-3 rounded-lg border p-3 ${
                      top.forte ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-xs text-slate-600 flex-1 min-w-40">
                        {top.forte ? "Encontrei no sistema:" : "Talvez seja:"}{" "}
                        <strong>{top.nome}</strong> — {formatCurrency(top.valor)} em{" "}
                        {fmtData(top.dataRecebimento)} ({top.status})
                      </p>
                      <Button
                        size="sm"
                        onClick={() => agir(l.id, { acao: "conciliar", transacaoId: top.id })}
                        loading={agindo === l.id}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Conciliar
                      </Button>
                    </div>
                    {l.sugestoes.length > 1 && (
                      <button
                        onClick={() => setAberto(aberto === l.id ? null : l.id)}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-700"
                      >
                        <ChevronDown className="h-3 w-3" />
                        outras opções ({l.sugestoes.length - 1})
                      </button>
                    )}
                    {aberto === l.id &&
                      l.sugestoes.slice(1).map((s) => (
                        <div key={s.id} className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
                          <span className="flex-1">
                            {s.nome} — {formatCurrency(s.valor)} em {fmtData(s.dataRecebimento)}
                          </span>
                          <button
                            onClick={() => agir(l.id, { acao: "conciliar", transacaoId: s.id })}
                            className="text-emerald-700 hover:underline font-medium"
                          >
                            usar esta
                          </button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    Nenhum lançamento parecido no sistema — crie um novo ou ignore.
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => agir(l.id, { acao: "criar" })}
                    loading={agindo === l.id}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Criar lançamento
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => agir(l.id, { acao: "ignorar" })}
                    loading={agindo === l.id}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Ignorar
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
