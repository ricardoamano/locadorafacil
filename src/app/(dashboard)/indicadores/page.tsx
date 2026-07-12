"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { mdParaHtml } from "@/lib/markdown";
import {
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Target,
  Gauge,
  CalendarClock,
  Percent,
  Clock,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Indicadores (KPIs) por período — dia, semana, quinzena, mês, trimestre,
// semestre e ano — com comparação ao período anterior, benchmarks do setor
// e análise executiva por IA.

const PERIODOS: { key: string; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "quinzena", label: "Quinzena" },
  { key: "mes", label: "Mês" },
  { key: "trimestre", label: "Trimestre" },
  { key: "semestre", label: "Semestre" },
  { key: "ano", label: "Ano" },
];

function fmtPct(v: number | null | undefined, casas = 1) {
  return v == null ? "—" : `${v.toFixed(casas).replace(".", ",")}%`;
}
function fmtDias(v: number | null | undefined) {
  return v == null ? "—" : `${Math.round(v)} dias`;
}

// Variação vs período anterior. `menorMelhor` inverte a cor (ex.: PMR).
function Variacao({
  atual,
  anterior,
  menorMelhor = false,
}: {
  atual: number | null | undefined;
  anterior: number | null | undefined;
  menorMelhor?: boolean;
}) {
  if (atual == null || anterior == null || anterior === 0) return null;
  const pct = ((atual - anterior) / Math.abs(anterior)) * 100;
  if (!isFinite(pct) || Math.abs(pct) < 0.05) return null;
  const subiu = pct > 0;
  const bom = menorMelhor ? !subiu : subiu;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        bom ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {subiu ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function Card({
  titulo,
  valor,
  sub,
  variacao,
  destaque = false,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  sub?: React.ReactNode;
  variacao?: React.ReactNode;
  destaque?: boolean;
  icone?: React.ElementType;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        destaque
          ? "bg-gradient-to-br from-violet-50 to-white border-violet-100"
          : "bg-white border-slate-100"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        {Icone && <Icone className="h-3.5 w-3.5" />}
        {titulo}
      </p>
      <div className="flex items-baseline gap-2 mt-1.5">
        <p className={`font-bold text-slate-900 ${destaque ? "text-2xl" : "text-xl"}`}>{valor}</p>
        {variacao}
      </div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function IndicadoresPage() {
  const { toast } = useToast();
  const [periodo, setPeriodo] = useState("mes");
  const [ref, setRef] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analise, setAnalise] = useState("");
  const [analisando, setAnalisando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/indicadores?periodo=${periodo}&ref=${ref}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao carregar.", "error");
    } finally {
      setLoading(false);
    }
  }, [periodo, ref, toast]);

  useEffect(() => {
    setAnalise("");
    carregar();
  }, [carregar]);

  function navegar(direcao: -1 | 1) {
    if (!data) return;
    const alvo =
      direcao === -1
        ? new Date(data.periodo.anteriorInicio)
        : new Date(new Date(data.periodo.fim).getTime() + 12 * 3600 * 1000);
    setRef(alvo.toISOString().slice(0, 10));
  }

  async function analisarComIa() {
    if (!data) return;
    setAnalisando(true);
    try {
      const res = await fetch("/api/indicadores/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados: data }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAnalise(d.analise);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro na análise.", "error");
    } finally {
      setAnalisando(false);
    }
  }

  const a = data?.atual;
  const ant = data?.anterior;

  return (
    <>
      <Header breadcrumbs={[{ label: "Indicadores" }]} />
      <main className="pt-14 p-6 max-w-7xl">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Indicadores</h1>
            <p className="text-sm text-slate-500 mt-1">
              KPIs da operação por período, comparados ao período anterior e aos
              benchmarks do setor de locação.
            </p>
          </div>
          <Button onClick={analisarComIa} loading={analisando} disabled={loading || !data}>
            <Sparkles className="h-4 w-4" />
            {analisando ? "Analisando..." : "Analisar com IA"}
          </Button>
        </div>

        {/* Seletor de período */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  periodo === p.key
                    ? "bg-violet-600 text-white font-medium"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navegar(-1)}
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50"
              aria-label="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[180px] text-center capitalize">
              {data?.periodo?.label || "..."}
            </span>
            <button
              onClick={() => navegar(1)}
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50"
              aria-label="Próximo período"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading || !a ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-6 w-6 border-2 border-violet-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Os 5 essenciais */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              <Card
                destaque
                icone={Target}
                titulo="Margem média por evento"
                valor={a.margemMediaEvento != null ? formatCurrency(a.margemMediaEvento) : "—"}
                variacao={
                  <Variacao atual={a.margemMediaEvento} anterior={ant?.margemMediaEvento} />
                }
                sub={
                  a.eventosComCusto === 0 && a.nEventos > 0
                    ? "⚠ sem custos lançados nos eventos"
                    : `margem total ${fmtPct(a.margemPct)}`
                }
              />
              <Card
                destaque
                icone={Gauge}
                titulo="Utilização do parque"
                valor={fmtPct(a.utilizacaoPct)}
                variacao={<Variacao atual={a.utilizacaoPct} anterior={ant?.utilizacaoPct} />}
                sub="benchmark do setor: 65–75%"
              />
              <Card
                destaque
                icone={CalendarClock}
                titulo="Pipeline 90 dias"
                valor={formatCurrency(data.pipeline90.valor)}
                sub={`${data.pipeline90.eventos} evento(s) já fechado(s)`}
              />
              <Card
                destaque
                icone={Percent}
                titulo="Conversão de propostas"
                valor={fmtPct(a.conversaoPct)}
                variacao={<Variacao atual={a.conversaoPct} anterior={ant?.conversaoPct} />}
                sub="saudável: 30–50%"
              />
              <Card
                destaque
                icone={Clock}
                titulo="PMR (prazo de recebimento)"
                valor={fmtDias(a.pmrDias)}
                variacao={<Variacao atual={a.pmrDias} anterior={ant?.pmrDias} menorMelhor />}
                sub="agências: 45–60 dias"
              />
            </div>

            {/* Análise da IA */}
            {analise && (
              <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-5">
                <p className="text-sm font-semibold text-violet-800 flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-4 w-4" /> Análise executiva (IA)
                </p>
                <div
                  className="prose prose-sm prose-slate max-w-none [&_h2]:text-base [&_h2]:mt-3 [&_h2]:mb-1"
                  dangerouslySetInnerHTML={{ __html: mdParaHtml(analise) }}
                />
              </div>
            )}

            {/* Comercial */}
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Comercial
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card
                  titulo="Propostas enviadas"
                  valor={String(a.enviadas)}
                  variacao={<Variacao atual={a.enviadas} anterior={ant?.enviadas} />}
                  sub={`${a.aprovadas} aprovada(s) · ${a.perdidas} perdida(s)`}
                />
                <Card
                  titulo="Ticket médio por evento"
                  valor={a.nEventos ? formatCurrency(a.ticketMedio) : "—"}
                  variacao={<Variacao atual={a.ticketMedio} anterior={ant?.ticketMedio} />}
                  sub={`${a.nEventos} evento(s) no período`}
                />
                <Card
                  titulo="Demanda perdida"
                  valor={formatCurrency(a.demandaPerdidaValor)}
                  variacao={
                    <Variacao
                      atual={a.demandaPerdidaValor}
                      anterior={ant?.demandaPerdidaValor}
                      menorMelhor
                    />
                  }
                  sub={`${a.perdidas} proposta(s) reprovada(s)/cancelada(s)`}
                />
                <Card
                  titulo="Taxa de recompra"
                  valor={fmtPct(a.recompraPct)}
                  sub="clientes do período que já eram clientes"
                />
              </div>
              {a.topClientes?.length > 0 && (
                <div className="mt-3 bg-white rounded-xl border border-slate-100 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                    Concentração de receita — top clientes ({fmtPct(a.concentracaoTop3, 0)} do
                    faturamento{a.concentracaoTop3 > 60 ? " · ⚠ risco de concentração" : ""})
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {a.topClientes.map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate text-slate-700">{c.nome}</span>
                        <div className="w-40 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-violet-500"
                            style={{
                              width: `${a.faturamento ? Math.min(100, (c.receita / a.faturamento) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <span className="w-28 text-right font-medium text-slate-800">
                          {formatCurrency(c.receita)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Financeiro */}
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Financeiro
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card
                  titulo="Faturamento (eventos do período)"
                  valor={formatCurrency(a.faturamento)}
                  variacao={<Variacao atual={a.faturamento} anterior={ant?.faturamento} />}
                  sub={`recebido no período: ${formatCurrency(a.recebido)}`}
                />
                <Card
                  titulo="% de sublocação"
                  valor={fmtPct(a.sublocacaoPct)}
                  variacao={
                    <Variacao atual={a.sublocacaoPct} anterior={ant?.sublocacaoPct} menorMelhor />
                  }
                  sub={`${formatCurrency(a.sublocacaoTotal)} em cross-hire`}
                />
                <Card
                  titulo="Dollar utilization (anualizada)"
                  valor={fmtPct(a.dollarUtilizationPct)}
                  sub="setor: 55–65% · exige valor de reposição nos itens"
                />
                <Card
                  titulo="Inadimplência (hoje)"
                  valor={formatCurrency(data.inadimplencia.valor)}
                  sub={`${data.inadimplencia.titulos} título(s) vencido(s) em aberto`}
                />
              </div>
            </section>

            {/* Operacional */}
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Operacional
              </h2>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-slate-100 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                    Utilização por categoria (dias locados ÷ capacidade)
                  </p>
                  {a.utilizacaoPorCategoria?.length ? (
                    <div className="flex flex-col gap-1.5">
                      {a.utilizacaoPorCategoria.map((c: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 truncate text-slate-700">{c.categoria}</span>
                          <div className="w-36 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full ${
                                c.utilizacaoPct > 80
                                  ? "bg-red-500"
                                  : c.utilizacaoPct >= 60
                                    ? "bg-emerald-500"
                                    : "bg-amber-400"
                              }`}
                              style={{ width: `${Math.min(100, c.utilizacaoPct)}%` }}
                            />
                          </div>
                          <span className="w-14 text-right font-medium text-slate-800">
                            {fmtPct(c.utilizacaoPct, 0)}
                          </span>
                        </div>
                      ))}
                      <p className="text-[11px] text-slate-400 mt-1">
                        verde 60–80% · âmbar &lt;60% (estoque parado) · vermelho &gt;80%
                        (demanda reprimida — avaliar compra)
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Sem locações no período.</p>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                    Top equipamentos por receita
                  </p>
                  {a.topEquipamentos?.length ? (
                    <div className="flex flex-col gap-1.5">
                      {a.topEquipamentos.map((t: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="truncate text-slate-700">{t.nome}</span>
                          <span className="font-medium text-slate-800">
                            {formatCurrency(t.receita)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Sem locações no período.</p>
                  )}
                  <p className="text-xs uppercase tracking-wider text-slate-400 mt-4 mb-1">
                    Custo médio de equipe por evento
                  </p>
                  <p className="text-lg font-bold text-slate-900">
                    {a.custoEquipeMedio != null && a.cachesTotal > 0
                      ? formatCurrency(a.custoEquipeMedio)
                      : "— (lance cachês na escala das OS)"}
                  </p>
                </div>
              </div>
            </section>

            {/* Margem por evento */}
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Margem de contribuição por evento
              </h2>
              <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
                {a.porEvento?.length ? (
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="px-4 py-2.5">Evento</th>
                        <th className="px-4 py-2.5 text-right">Receita</th>
                        <th className="px-4 py-2.5 text-right">Custos diretos</th>
                        <th className="px-4 py-2.5 text-right">Margem</th>
                        <th className="px-4 py-2.5 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.porEvento.map((e: any, i: number) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-slate-800">{e.evento}</span>
                            <span className="text-xs text-slate-400"> · {e.cliente}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">{formatCurrency(e.receita)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">
                            {e.custos ? formatCurrency(e.custos) : "—"}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-medium ${
                              e.margem < 0 ? "text-red-600" : "text-slate-900"
                            }`}
                          >
                            {formatCurrency(e.margem)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-500">
                            {fmtPct(e.margemPct, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-slate-400 p-6 text-center">
                    Nenhum evento aprovado com início neste período.
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Custos diretos por evento = despesas do Financeiro vinculadas ao orçamento +
                cachês lançados na escala da OS + sublocação (itens extras com custo). Sem
                custo lançado, a margem aparece igual à receita — alimente os custos por
                evento para o número mais importante da empresa ser real.
              </p>
            </section>

            {/* Freelancers: frequência e cachês no período */}
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Freelancers — frequência e cachês
              </h2>
              <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
                {a.freelancers?.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
                        <th className="px-4 py-2.5">Freelancer</th>
                        <th className="px-4 py-2.5 text-right">Eventos</th>
                        <th className="px-4 py-2.5 text-right">% dos eventos</th>
                        <th className="px-4 py-2.5 text-right">Cachê médio</th>
                        <th className="px-4 py-2.5 text-right">Cachê padrão</th>
                        <th className="px-4 py-2.5 text-right">Total pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.freelancers.map((f: any, i: number) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-800">{f.nome}</td>
                          <td className="px-4 py-2.5 text-right">{f.eventos}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">
                            {fmtPct(f.frequenciaPct, 0)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {f.cacheMedio ? formatCurrency(f.cacheMedio) : "—"}
                            {f.cachePadrao != null &&
                              f.cacheMedio > f.cachePadrao * 1.1 && (
                                <span className="ml-1 text-xs text-amber-600" title="Cachê médio acima do padrão cadastrado">
                                  ▲
                                </span>
                              )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-500">
                            {f.cachePadrao != null ? formatCurrency(f.cachePadrao) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">
                            {formatCurrency(f.cacheTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-slate-400 p-6 text-center">
                    Nenhum freelancer escalado em eventos deste período (lance os cachês na
                    escala da OS para este quadro funcionar).
                  </p>
                )}
              </div>
              {a.freelancersResumo?.ativos > 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  {a.freelancersResumo.ativos} freelancer(s) ativos · total pago{" "}
                  {formatCurrency(a.freelancersResumo.cacheTotal)}
                  {a.freelancersResumo.cacheMedioEvento != null &&
                    ` · custo médio de freelancers por evento ${formatCurrency(a.freelancersResumo.cacheMedioEvento)}`}
                </p>
              )}
            </section>

            {/* Análises estratégicas — últimos 12 meses */}
            {data.estrategico && (
              <section>
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Análise estratégica — últimos 12 meses
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Perfis de evento que mais valem a pena */}
                  <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-500 uppercase">
                      Perfis de evento que mais valem a pena
                    </p>
                    {data.estrategico.perfisEvento?.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
                            <th className="px-4 py-2">Tipo de evento</th>
                            <th className="px-4 py-2 text-right">Eventos</th>
                            <th className="px-4 py-2 text-right">Ticket médio</th>
                            <th className="px-4 py-2 text-right">Margem</th>
                            <th className="px-4 py-2 text-right">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.estrategico.perfisEvento.slice(0, 8).map((t: any, i: number) => (
                            <tr key={i} className="border-b border-slate-50">
                              <td className="px-4 py-2 font-medium text-slate-800">
                                {i === 0 && "🏆 "}
                                {t.tipo}
                              </td>
                              <td className="px-4 py-2 text-right">{t.eventos}</td>
                              <td className="px-4 py-2 text-right text-slate-500">
                                {formatCurrency(t.ticketMedio)}
                              </td>
                              <td className="px-4 py-2 text-right font-medium">
                                {formatCurrency(t.margem)}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-500">
                                {fmtPct(t.margemPct, 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-sm text-slate-400 p-6 text-center">
                        Sem eventos aprovados nos últimos 12 meses.
                      </p>
                    )}
                  </div>

                  {/* Clientes que mais valem a pena */}
                  <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-500 uppercase">
                      Clientes que mais valem a pena
                    </p>
                    {data.estrategico.perfilClientes?.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
                            <th className="px-4 py-2">Cliente</th>
                            <th className="px-4 py-2 text-right">Eventos</th>
                            <th className="px-4 py-2 text-right">Margem</th>
                            <th className="px-4 py-2 text-right">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.estrategico.perfilClientes.map((c: any, i: number) => (
                            <tr key={i} className="border-b border-slate-50">
                              <td className="px-4 py-2">
                                <span className="font-medium text-slate-800">
                                  {i === 0 && "🏆 "}
                                  {c.nome}
                                </span>
                                <span
                                  className={`ml-1.5 rounded-full text-[10px] font-medium px-1.5 py-0.5 ${
                                    c.tipo === "Posto de serviço"
                                      ? "bg-sky-50 text-sky-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {c.tipo === "Posto de serviço" ? "posto" : "externo"}
                                </span>
                                {c.recorrente && (
                                  <span className="ml-1 text-[10px] text-emerald-600">↻ recorrente</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right">{c.eventos}</td>
                              <td className="px-4 py-2 text-right font-medium">
                                {formatCurrency(c.margem)}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-500">
                                {fmtPct(c.margemPct, 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-sm text-slate-400 p-6 text-center">Sem dados ainda.</p>
                    )}
                  </div>

                  {/* Eventos que se repetem */}
                  <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-500 uppercase">
                      Clientes que repetem o mesmo evento
                    </p>
                    {data.estrategico.eventosRepetidos?.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
                            <th className="px-4 py-2">Evento</th>
                            <th className="px-4 py-2">Cliente</th>
                            <th className="px-4 py-2 text-right">Vezes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.estrategico.eventosRepetidos.map((r: any, i: number) => (
                            <tr key={i} className="border-b border-slate-50">
                              <td className="px-4 py-2 font-medium text-slate-800">{r.evento}</td>
                              <td className="px-4 py-2 text-slate-500">
                                {r.cliente}
                                <span className="ml-1 text-[10px] text-slate-400">
                                  ({r.isPosto ? "posto" : "externo"})
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right font-bold">{r.vezes}x</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-sm text-slate-400 p-6 text-center">
                        Nenhum evento repetido identificado ainda (compara o nome do evento
                        por cliente).
                      </p>
                    )}
                  </div>

                  {/* Mix externos × postos */}
                  <div className="bg-white rounded-xl border border-slate-100 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-3">
                      Clientes externos × postos de serviço
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { rotulo: "Clientes externos", d: data.estrategico.mixClientes?.externos, cor: "slate" },
                        { rotulo: "Postos de serviço", d: data.estrategico.mixClientes?.postos, cor: "sky" },
                      ].map((b: any) => (
                        <div
                          key={b.rotulo}
                          className={`rounded-lg border p-3 ${
                            b.cor === "sky" ? "border-sky-100 bg-sky-50/40" : "border-slate-100 bg-slate-50/40"
                          }`}
                        >
                          <p className="text-xs font-semibold text-slate-600">{b.rotulo}</p>
                          <p className="text-lg font-bold text-slate-900 mt-1">
                            {formatCurrency(b.d?.receita || 0)}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {b.d?.clientes || 0} cliente(s) · {b.d?.eventos || 0} evento(s)
                            <br />
                            {b.d?.recorrentes || 0} recorrente(s) (2+ eventos)
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-3">
                      {data.estrategico.clientesQueRepetem} cliente(s) repetem o mesmo evento.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}
