import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Indicadores (KPIs) da locadora por período: dia, semana, quinzena, mês,
// trimestre, semestre e ano — sempre comparando com o período anterior.
// Métricas baseadas no doc de KPIs da Neostore + práticas do setor de locação
// (utilização de tempo por categoria, dollar utilization, PMR, pipeline 90d).

type SessionUser = { companyId?: string };

type TipoPeriodo =
  | "dia"
  | "semana"
  | "quinzena"
  | "mes"
  | "trimestre"
  | "semestre"
  | "ano";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function fmt(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

/** Limites [inicio, fim) do período que contém `ref`, e do período anterior. */
function limitesPeriodo(tipo: TipoPeriodo, ref: Date) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  let inicio: Date, fim: Date, antInicio: Date, antFim: Date, label: string;

  switch (tipo) {
    case "dia": {
      inicio = new Date(y, m, d);
      fim = new Date(y, m, d + 1);
      antInicio = new Date(y, m, d - 1);
      antFim = inicio;
      label = fmt(inicio);
      break;
    }
    case "semana": {
      const dow = (ref.getDay() + 6) % 7; // segunda = 0
      inicio = new Date(y, m, d - dow);
      fim = new Date(y, m, d - dow + 7);
      antInicio = new Date(y, m, d - dow - 7);
      antFim = inicio;
      label = `semana de ${fmt(inicio)} a ${fmt(new Date(fim.getTime() - 1))}`;
      break;
    }
    case "quinzena": {
      if (d <= 15) {
        inicio = new Date(y, m, 1);
        fim = new Date(y, m, 16);
        antInicio = new Date(y, m - 1, 16);
        antFim = new Date(y, m, 1);
        label = `1ª quinzena de ${MESES[m]}/${y}`;
      } else {
        inicio = new Date(y, m, 16);
        fim = new Date(y, m + 1, 1);
        antInicio = new Date(y, m, 1);
        antFim = new Date(y, m, 16);
        label = `2ª quinzena de ${MESES[m]}/${y}`;
      }
      break;
    }
    case "mes": {
      inicio = new Date(y, m, 1);
      fim = new Date(y, m + 1, 1);
      antInicio = new Date(y, m - 1, 1);
      antFim = inicio;
      label = `${MESES[m]}/${y}`;
      break;
    }
    case "trimestre": {
      const t = Math.floor(m / 3);
      inicio = new Date(y, t * 3, 1);
      fim = new Date(y, t * 3 + 3, 1);
      antInicio = new Date(y, t * 3 - 3, 1);
      antFim = inicio;
      label = `${t + 1}º trimestre de ${y}`;
      break;
    }
    case "semestre": {
      const s = m < 6 ? 0 : 1;
      inicio = new Date(y, s * 6, 1);
      fim = new Date(y, s * 6 + 6, 1);
      antInicio = new Date(y, s * 6 - 6, 1);
      antFim = inicio;
      label = `${s + 1}º semestre de ${y}`;
      break;
    }
    default: {
      inicio = new Date(y, 0, 1);
      fim = new Date(y + 1, 0, 1);
      antInicio = new Date(y - 1, 0, 1);
      antFim = inicio;
      label = String(y);
    }
  }
  return { inicio, fim, antInicio, antFim, label };
}

const DIA_MS = 86_400_000;

/** Calcula todos os KPIs de um período [inicio, fim). */
async function calcularKpis(companyId: string, inicio: Date, fim: Date) {
  const dias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / DIA_MS));

  // Eventos do período = orçamentos aprovados com início do evento no período.
  const eventos = await prisma.orcamento.findMany({
    where: {
      companyId,
      status: "APROVADO",
      dataInicio: { gte: inicio, lt: fim },
    },
    select: {
      id: true,
      numero: true,
      eventoNome: true,
      total: true,
      clienteId: true,
      cliente: { select: { nomeFantasia: true } },
      transacoes: { select: { tipo: true, valor: true } },
      os: {
        select: {
          escala: { select: { cache: true } },
          itensExtras: { select: { custo: true } },
        },
      },
    },
  });

  const faturamento = eventos.reduce((s, e) => s + (e.total || 0), 0);
  const nEventos = eventos.length;
  const ticketMedio = nEventos ? faturamento / nEventos : 0;

  // Margem de contribuição por evento: receita − custos diretos lançados
  // (despesas vinculadas ao orçamento + cachês da escala + sublocação).
  const porEvento = eventos.map((e) => {
    const despesas = e.transacoes
      .filter((t) => t.tipo === "DESPESA")
      .reduce((s, t) => s + t.valor, 0);
    const caches = (e.os?.escala || []).reduce((s, x) => s + (x.cache || 0), 0);
    const sublocacao = (e.os?.itensExtras || []).reduce((s, x) => s + (x.custo || 0), 0);
    const custos = despesas + caches + sublocacao;
    return {
      numero: e.numero,
      evento: e.eventoNome || e.cliente?.nomeFantasia || `#${e.numero}`,
      cliente: e.cliente?.nomeFantasia || "",
      receita: e.total || 0,
      custos,
      caches,
      sublocacao,
      margem: (e.total || 0) - custos,
      margemPct: e.total ? (((e.total || 0) - custos) / e.total) * 100 : null,
    };
  });
  const custosTotais = porEvento.reduce((s, e) => s + e.custos, 0);
  const margemTotal = faturamento - custosTotais;
  const eventosComCusto = porEvento.filter((e) => e.custos > 0).length;
  const sublocacaoTotal = porEvento.reduce((s, e) => s + e.sublocacao, 0);
  const cachesTotal = porEvento.reduce((s, e) => s + e.caches, 0);

  // Concentração de receita: top 3 clientes.
  const porCliente = new Map<string, { nome: string; receita: number }>();
  for (const e of eventos) {
    const atual = porCliente.get(e.clienteId) || {
      nome: e.cliente?.nomeFantasia || "?",
      receita: 0,
    };
    atual.receita += e.total || 0;
    porCliente.set(e.clienteId, atual);
  }
  const topClientes = [...porCliente.values()]
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 3);
  const concentracaoTop3 = faturamento
    ? (topClientes.reduce((s, c) => s + c.receita, 0) / faturamento) * 100
    : 0;

  // Recompra: % dos clientes do período que já tinham evento aprovado antes.
  const clientesPeriodo = [...porCliente.keys()];
  let recompraPct = null as number | null;
  if (clientesPeriodo.length) {
    const antigos = await prisma.orcamento.groupBy({
      by: ["clienteId"],
      where: {
        companyId,
        status: "APROVADO",
        clienteId: { in: clientesPeriodo },
        dataInicio: { lt: inicio },
      },
    });
    recompraPct = (antigos.length / clientesPeriodo.length) * 100;
  }

  // Funil comercial no período.
  const [enviadas, aprovadas, perdidasAgg] = await Promise.all([
    prisma.orcamento.count({ where: { companyId, createdAt: { gte: inicio, lt: fim } } }),
    prisma.orcamento.count({
      where: { companyId, status: "APROVADO", aprovadoEm: { gte: inicio, lt: fim } },
    }),
    prisma.orcamento.aggregate({
      where: {
        companyId,
        status: { in: ["REPROVADO", "CANCELADO"] },
        updatedAt: { gte: inicio, lt: fim },
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
  ]);
  const perdidas = perdidasAgg._count._all;
  const demandaPerdidaValor = perdidasAgg._sum.total || 0;
  const conversaoPct = enviadas ? (aprovadas / enviadas) * 100 : null;

  // Caixa: recebido (RECEITA paga) e a receber com vencimento no período.
  const [recebidoAgg, aReceberAgg] = await Promise.all([
    prisma.transacao.aggregate({
      where: {
        companyId,
        tipo: "RECEITA",
        status: "PAGO",
        dataRecebimento: { gte: inicio, lt: fim },
      },
      _sum: { valor: true },
    }),
    prisma.transacao.aggregate({
      where: {
        companyId,
        tipo: "RECEITA",
        status: { not: "PAGO" },
        dataRecebimento: { gte: inicio, lt: fim },
      },
      _sum: { valor: true },
    }),
  ]);
  const recebido = recebidoAgg._sum.valor || 0;
  const aReceber = aReceberAgg._sum.valor || 0;

  // PMR: dias entre aprovação do orçamento e o recebimento das receitas pagas.
  const receitasPagas = await prisma.transacao.findMany({
    where: {
      companyId,
      tipo: "RECEITA",
      status: "PAGO",
      dataRecebimento: { gte: inicio, lt: fim },
      orcamentoId: { not: null },
    },
    select: {
      dataRecebimento: true,
      orcamento: { select: { aprovadoEm: true } },
    },
  });
  const prazos = receitasPagas
    .filter((t) => t.orcamento?.aprovadoEm)
    .map((t) =>
      Math.max(0, (t.dataRecebimento.getTime() - t.orcamento!.aprovadoEm!.getTime()) / DIA_MS)
    );
  const pmrDias = prazos.length
    ? prazos.reduce((s, v) => s + v, 0) / prazos.length
    : null;

  // Utilização por categoria: dias-equipamento locados ÷ capacidade do parque.
  const [salaItens, parque] = await Promise.all([
    eventos.length
      ? prisma.salaItem.findMany({
          where: { sala: { orcamentoId: { in: eventos.map((e) => e.id) } } },
          select: {
            quantidade: true,
            diarias: true,
            subtotal: true,
            item: {
              select: {
                nome: true,
                natureza: true,
                categoria: { select: { nome: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.item.findMany({
      where: { companyId, natureza: "EQUIPAMENTO" },
      select: {
        quantidade: true,
        valorReposicao: true,
        categoria: { select: { nome: true } },
      },
    }),
  ]);

  const capacidadePorCat = new Map<string, number>();
  let parqueReposicao = 0;
  for (const it of parque) {
    const cat = it.categoria?.nome || "Sem categoria";
    capacidadePorCat.set(cat, (capacidadePorCat.get(cat) || 0) + it.quantidade);
    parqueReposicao += (it.valorReposicao || 0) * Math.max(1, it.quantidade);
  }
  const locadoPorCat = new Map<string, number>();
  const receitaPorItem = new Map<string, number>();
  let diasEquipLocados = 0;
  for (const si of salaItens) {
    if (si.item.natureza !== "EQUIPAMENTO") continue;
    const cat = si.item.categoria?.nome || "Sem categoria";
    const diasEquip = si.quantidade * si.diarias;
    locadoPorCat.set(cat, (locadoPorCat.get(cat) || 0) + diasEquip);
    diasEquipLocados += diasEquip;
    receitaPorItem.set(si.item.nome, (receitaPorItem.get(si.item.nome) || 0) + si.subtotal);
  }
  const capacidadeTotal = [...capacidadePorCat.values()].reduce((s, v) => s + v, 0) * dias;
  const utilizacaoPct = capacidadeTotal ? (diasEquipLocados / capacidadeTotal) * 100 : null;
  const utilizacaoPorCategoria = [...capacidadePorCat.entries()]
    .map(([cat, estoque]) => ({
      categoria: cat,
      estoque,
      diasLocados: locadoPorCat.get(cat) || 0,
      utilizacaoPct: estoque * dias ? ((locadoPorCat.get(cat) || 0) / (estoque * dias)) * 100 : 0,
    }))
    .filter((c) => c.estoque > 0)
    .sort((a, b) => b.utilizacaoPct - a.utilizacaoPct);

  const topEquipamentos = [...receitaPorItem.entries()]
    .map(([nome, receita]) => ({ nome, receita }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 5);

  // Dollar utilization (setor de locação): receita anualizada ÷ valor do parque.
  const dollarUtilizationPct = parqueReposicao
    ? ((faturamento * (365 / dias)) / parqueReposicao) * 100
    : null;

  // Freelancers: frequência de trabalho e cachês no período.
  const escalasPeriodo = await prisma.escalaMembro.findMany({
    where: {
      os: {
        companyId,
        orcamento: { status: "APROVADO", dataInicio: { gte: inicio, lt: fim } },
      },
    },
    select: {
      osId: true,
      cache: true,
      membro: { select: { id: true, nome: true, tipo: true, cache: true } },
    },
  });
  const porFreela = new Map<
    string,
    { nome: string; tipo: string; eventos: Set<string>; cacheTotal: number; cachePadrao: number | null }
  >();
  for (const e of escalasPeriodo) {
    const atual = porFreela.get(e.membro.id) || {
      nome: e.membro.nome,
      tipo: e.membro.tipo,
      eventos: new Set<string>(),
      cacheTotal: 0,
      cachePadrao: e.membro.cache,
    };
    atual.eventos.add(e.osId);
    atual.cacheTotal += e.cache || 0;
    porFreela.set(e.membro.id, atual);
  }
  const freelancers = [...porFreela.values()]
    .filter((f) => f.tipo === "FREELANCER")
    .map((f) => ({
      nome: f.nome,
      eventos: f.eventos.size,
      frequenciaPct: nEventos ? (f.eventos.size / nEventos) * 100 : null,
      cacheTotal: f.cacheTotal,
      cacheMedio: f.eventos.size ? f.cacheTotal / f.eventos.size : 0,
      cachePadrao: f.cachePadrao,
    }))
    .sort((a, b) => b.eventos - a.eventos || b.cacheTotal - a.cacheTotal)
    .slice(0, 15);
  const freelancersResumo = {
    ativos: freelancers.length,
    cacheTotal: freelancers.reduce((s, f) => s + f.cacheTotal, 0),
    cacheMedioEvento:
      escalasPeriodo.filter((e) => e.membro.tipo === "FREELANCER").length > 0
        ? freelancers.reduce((s, f) => s + f.cacheTotal, 0) /
          new Set(
            escalasPeriodo.filter((e) => e.membro.tipo === "FREELANCER").map((e) => e.osId)
          ).size
        : null,
  };

  return {
    dias,
    faturamento,
    nEventos,
    ticketMedio,
    margemTotal,
    margemPct: faturamento ? (margemTotal / faturamento) * 100 : null,
    margemMediaEvento: nEventos ? margemTotal / nEventos : null,
    eventosComCusto,
    custosTotais,
    cachesTotal,
    sublocacaoTotal,
    sublocacaoPct: faturamento ? (sublocacaoTotal / faturamento) * 100 : null,
    custoEquipeMedio: nEventos ? cachesTotal / nEventos : null,
    porEvento: porEvento.sort((a, b) => b.receita - a.receita).slice(0, 10),
    topClientes,
    concentracaoTop3,
    recompraPct,
    enviadas,
    aprovadas,
    perdidas,
    demandaPerdidaValor,
    conversaoPct,
    recebido,
    aReceber,
    pmrDias,
    utilizacaoPct,
    utilizacaoPorCategoria: utilizacaoPorCategoria.slice(0, 12),
    topEquipamentos,
    dollarUtilizationPct,
    freelancers,
    freelancersResumo,
  };
}

/**
 * Análises estratégicas (foto dos últimos 12 meses, independente do período):
 * perfis de evento e de cliente que mais valem a pena, e recorrência —
 * clientes que repetem o mesmo evento, separando externos de postos de serviço.
 */
async function analisesEstrategicas(companyId: string) {
  const hoje = new Date();
  const desde = new Date(hoje.getTime() - 365 * DIA_MS);

  const aprovados = await prisma.orcamento.findMany({
    where: { companyId, status: "APROVADO", dataInicio: { gte: desde } },
    select: {
      id: true,
      tipoEvento: true,
      eventoNome: true,
      total: true,
      clienteId: true,
      cliente: { select: { nomeFantasia: true, isPostoServico: true } },
      transacoes: { select: { tipo: true, valor: true } },
      os: {
        select: {
          escala: { select: { cache: true } },
          itensExtras: { select: { custo: true } },
        },
      },
    },
  });

  const custosDe = (e: (typeof aprovados)[number]) =>
    e.transacoes.filter((t) => t.tipo === "DESPESA").reduce((s, t) => s + t.valor, 0) +
    (e.os?.escala || []).reduce((s, x) => s + (x.cache || 0), 0) +
    (e.os?.itensExtras || []).reduce((s, x) => s + (x.custo || 0), 0);

  // Perfis de evento (por tipo de evento): qual perfil mais vale a pena.
  const porTipo = new Map<
    string,
    { n: number; receita: number; custos: number }
  >();
  for (const e of aprovados) {
    const tipo = e.tipoEvento?.trim() || "Sem tipo";
    const atual = porTipo.get(tipo) || { n: 0, receita: 0, custos: 0 };
    atual.n += 1;
    atual.receita += e.total || 0;
    atual.custos += custosDe(e);
    porTipo.set(tipo, atual);
  }
  const perfisEvento = [...porTipo.entries()]
    .map(([tipo, v]) => ({
      tipo,
      eventos: v.n,
      receita: v.receita,
      margem: v.receita - v.custos,
      margemPct: v.receita ? ((v.receita - v.custos) / v.receita) * 100 : null,
      ticketMedio: v.n ? v.receita / v.n : 0,
      margemMediaEvento: v.n ? (v.receita - v.custos) / v.n : 0,
    }))
    .sort((a, b) => b.margem - a.margem);

  // Perfil de cliente: quem mais vale a pena (margem, ticket, recorrência).
  const porCliente = new Map<
    string,
    { nome: string; isPosto: boolean; n: number; receita: number; custos: number }
  >();
  for (const e of aprovados) {
    const atual = porCliente.get(e.clienteId) || {
      nome: e.cliente?.nomeFantasia || "?",
      isPosto: !!e.cliente?.isPostoServico,
      n: 0,
      receita: 0,
      custos: 0,
    };
    atual.n += 1;
    atual.receita += e.total || 0;
    atual.custos += custosDe(e);
    porCliente.set(e.clienteId, atual);
  }
  const perfilClientes = [...porCliente.values()]
    .map((c) => ({
      nome: c.nome,
      tipo: c.isPosto ? "Posto de serviço" : "Cliente externo",
      eventos: c.n,
      receita: c.receita,
      margem: c.receita - c.custos,
      margemPct: c.receita ? ((c.receita - c.custos) / c.receita) * 100 : null,
      ticketMedio: c.n ? c.receita / c.n : 0,
      recorrente: c.n >= 2,
    }))
    .sort((a, b) => b.margem - a.margem)
    .slice(0, 10);

  // Recorrência: clientes que repetem O MESMO evento (mesmo nome normalizado).
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .replace(/\b(20\d\d|\d+ª?|edicao|edição)\b/g, "")
      .trim();
  const porEventoCliente = new Map<
    string,
    { cliente: string; isPosto: boolean; evento: string; vezes: number }
  >();
  for (const e of aprovados) {
    if (!e.eventoNome?.trim()) continue;
    const chave = `${e.clienteId}::${norm(e.eventoNome)}`;
    const atual = porEventoCliente.get(chave) || {
      cliente: e.cliente?.nomeFantasia || "?",
      isPosto: !!e.cliente?.isPostoServico,
      evento: e.eventoNome.trim(),
      vezes: 0,
    };
    atual.vezes += 1;
    porEventoCliente.set(chave, atual);
  }
  const eventosRepetidos = [...porEventoCliente.values()]
    .filter((r) => r.vezes >= 2)
    .sort((a, b) => b.vezes - a.vezes)
    .slice(0, 10);
  const clientesQueRepetem = new Set(
    eventosRepetidos.map((r) => r.cliente)
  ).size;

  // Mix externos × postos de serviço.
  const clientes = [...porCliente.values()];
  const externos = clientes.filter((c) => !c.isPosto);
  const postos = clientes.filter((c) => c.isPosto);
  const mixClientes = {
    externos: {
      clientes: externos.length,
      eventos: externos.reduce((s, c) => s + c.n, 0),
      receita: externos.reduce((s, c) => s + c.receita, 0),
      recorrentes: externos.filter((c) => c.n >= 2).length,
    },
    postos: {
      clientes: postos.length,
      eventos: postos.reduce((s, c) => s + c.n, 0),
      receita: postos.reduce((s, c) => s + c.receita, 0),
      recorrentes: postos.filter((c) => c.n >= 2).length,
    },
  };

  return { perfisEvento, perfilClientes, eventosRepetidos, clientesQueRepetem, mixClientes };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const tipo = (req.nextUrl.searchParams.get("periodo") || "mes") as TipoPeriodo;
  const refStr = req.nextUrl.searchParams.get("ref") || "";
  const ref = refStr ? new Date(`${refStr}T12:00:00`) : new Date();
  if (isNaN(ref.getTime()))
    return NextResponse.json({ error: "Data de referência inválida" }, { status: 400 });

  const { inicio, fim, antInicio, antFim, label } = limitesPeriodo(tipo, ref);

  const hoje = new Date();
  const [atual, anterior, estrategico, pipelineAgg, inadimplenciaAgg] = await Promise.all([
    calcularKpis(companyId, inicio, fim),
    calcularKpis(companyId, antInicio, antFim),
    analisesEstrategicas(companyId),
    // Pipeline 90 dias e inadimplência são fotos de HOJE, não do período.
    prisma.orcamento.aggregate({
      where: {
        companyId,
        status: "APROVADO",
        dataInicio: { gte: hoje, lt: new Date(hoje.getTime() + 90 * DIA_MS) },
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.transacao.aggregate({
      where: {
        companyId,
        tipo: "RECEITA",
        status: { not: "PAGO" },
        dataRecebimento: { lt: hoje },
      },
      _count: { _all: true },
      _sum: { valor: true },
    }),
  ]);

  return NextResponse.json({
    periodo: {
      tipo,
      label,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      anteriorInicio: antInicio.toISOString(),
      anteriorFim: antFim.toISOString(),
    },
    atual,
    anterior,
    estrategico,
    pipeline90: {
      valor: pipelineAgg._sum.total || 0,
      eventos: pipelineAgg._count._all,
    },
    inadimplencia: {
      valor: inadimplenciaAgg._sum.valor || 0,
      titulos: inadimplenciaAgg._count._all,
    },
  });
}
