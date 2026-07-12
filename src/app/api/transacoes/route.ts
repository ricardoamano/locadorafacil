import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

function inicioHoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const tipo = searchParams.get("tipo") || "";
  const status = searchParams.get("status") || "";
  const bancoId = searchParams.get("bancoId") || "";
  const mes = searchParams.get("mes") || ""; // formato YYYY-MM
  const sort = searchParams.get("sort") || "data";
  const dir = searchParams.get("dir") === "asc" ? ("asc" as const) : ("desc" as const);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(1000, parseInt(searchParams.get("limit") || "20"));
  const skip = (page - 1) * limit;

  const hoje = inicioHoje();

  let periodo = {};
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split("-").map(Number);
    periodo = {
      dataRecebimento: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) },
    };
  }

  // "Atrasado" é automático: pendente com data anterior a hoje
  let statusWhere = {};
  if (status === "ATRASADO") {
    statusWhere = {
      OR: [
        { status: "ATRASADO" },
        { status: "PENDENTE", dataRecebimento: { lt: hoje } },
      ],
    };
  } else if (status) {
    statusWhere = { status };
  }

  const where = {
    companyId,
    ...(tipo ? { tipo } : {}),
    ...(bancoId ? { bancoId } : {}),
    ...periodo,
    ...statusWhere,
    ...(search ? { nome: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const seisMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);

  const [transacoes, total, pagoReceita, pagoDespesa, aReceber, aPagar, atrasadas, porBancoRaw, ultimos6m, porCategoriaRaw] =
    await Promise.all([
      prisma.transacao.findMany({
        where,
        include: {
          categoria: { select: { id: true, nome: true } },
          orcamento: { select: { id: true, numero: true } },
          banco: { select: { id: true, nome: true } },
        },
        orderBy:
          sort === "nome"
            ? { nome: dir }
            : sort === "status"
            ? { status: dir }
            : sort === "valor"
            ? { valor: dir }
            : sort === "orcamento"
            ? { orcamento: { numero: dir } }
            : { dataRecebimento: dir },
        skip,
        take: limit,
      }),
      prisma.transacao.count({ where }),
      prisma.transacao.aggregate({
        where: { companyId, tipo: "RECEITA", status: "PAGO" },
        _sum: { valor: true },
      }),
      prisma.transacao.aggregate({
        where: { companyId, tipo: "DESPESA", status: "PAGO" },
        _sum: { valor: true },
      }),
      prisma.transacao.aggregate({
        where: { companyId, tipo: "RECEITA", status: { not: "PAGO" } },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.transacao.aggregate({
        where: { companyId, tipo: "DESPESA", status: { not: "PAGO" } },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.transacao.aggregate({
        where: {
          companyId,
          status: { not: "PAGO" },
          dataRecebimento: { lt: hoje },
        },
        _sum: { valor: true },
        _count: true,
      }),
      prisma.transacao.groupBy({
        by: ["bancoId", "tipo"],
        where: { companyId, status: "PAGO", bancoId: { not: null } },
        _sum: { valor: true },
      }),
      prisma.transacao.findMany({
        where: { companyId, status: "PAGO", dataRecebimento: { gte: seisMesesAtras } },
        select: { dataRecebimento: true, tipo: true, valor: true },
      }),
      prisma.transacao.groupBy({
        by: ["categoriaId", "tipo"],
        where: { companyId, ...periodo },
        _sum: { valor: true },
      }),
    ]);

  // Saldo por banco (só transações pagas)
  const bancos = await prisma.banco.findMany({
    where: { companyId },
    select: { id: true, nome: true },
  });
  const porBanco = bancos
    .map((b) => {
      const entrada = porBancoRaw
        .filter((r) => r.bancoId === b.id && r.tipo === "RECEITA")
        .reduce((a, r) => a + (r._sum.valor || 0), 0);
      const saida = porBancoRaw
        .filter((r) => r.bancoId === b.id && r.tipo === "DESPESA")
        .reduce((a, r) => a + (r._sum.valor || 0), 0);
      return { id: b.id, nome: b.nome, saldo: entrada - saida, movimentado: entrada + saida };
    })
    .filter((b) => b.movimentado > 0);

  // Fluxo mensal (últimos 6 meses, pagas)
  const fluxoMensal: { mes: string; entradas: number; saidas: number }[] = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - k, 1);
    fluxoMensal.push({
      mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      entradas: 0,
      saidas: 0,
    });
  }
  for (const t of ultimos6m) {
    const d = new Date(t.dataRecebimento);
    const idx = 5 - ((hoje.getFullYear() - d.getFullYear()) * 12 + hoje.getMonth() - d.getMonth());
    if (idx < 0 || idx > 5) continue;
    if (t.tipo === "RECEITA") fluxoMensal[idx].entradas += t.valor;
    else fluxoMensal[idx].saidas += t.valor;
  }

  // Por categoria (período filtrado; sem categoria = "Sem categoria")
  const categorias = await prisma.categoria.findMany({
    where: { companyId },
    select: { id: true, nome: true },
  });
  const nomeCat = new Map(categorias.map((c) => [c.id, c.nome]));
  const porCategoria = porCategoriaRaw
    .map((r) => ({
      categoria: r.categoriaId ? nomeCat.get(r.categoriaId) || "Sem categoria" : "Sem categoria",
      tipo: r.tipo,
      valor: r._sum.valor || 0,
    }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const entradas = pagoReceita._sum.valor || 0;
  const saidas = pagoDespesa._sum.valor || 0;

  return NextResponse.json({
    transacoes,
    total,
    page,
    limit,
    saldo: { entradas, saidas, total: entradas - saidas },
    resumo: {
      saldoCaixa: entradas - saidas,
      aReceber: { valor: aReceber._sum.valor || 0, qtd: aReceber._count },
      aPagar: { valor: aPagar._sum.valor || 0, qtd: aPagar._count },
      atrasadas: { valor: atrasadas._sum.valor || 0, qtd: atrasadas._count },
      porBanco,
      fluxoMensal,
      porCategoria,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (!body.dataRecebimento) return NextResponse.json({ error: "Data obrigatória" }, { status: 400 });

  // Recorrência: repete o lançamento mensalmente (ex.: aluguel, assinatura)
  const repetir = Math.max(1, Math.min(36, parseInt(body.repetirMeses) || 1));
  const base = new Date(body.dataRecebimento);

  const dados = [];
  for (let k = 0; k < repetir; k++) {
    const data = new Date(base);
    data.setMonth(base.getMonth() + k);
    dados.push({
      nome:
        repetir > 1
          ? `${body.nome.trim()} (${k + 1}/${repetir})`
          : body.nome.trim(),
      dataRecebimento: data,
      tipo: body.tipo || "RECEITA",
      categoriaId: body.categoriaId || null,
      orcamentoId: body.orcamentoId || null,
      valor: Number(body.valor) || 0,
      bancoId: body.bancoId || null,
      observacao: body.observacao || null,
      notaFiscal: !!body.notaFiscal,
      status: k === 0 ? body.status || "PENDENTE" : "PENDENTE",
      companyId,
    });
  }

  if (dados.length === 1) {
    const transacao = await prisma.transacao.create({ data: dados[0] });
    return NextResponse.json(transacao, { status: 201 });
  }

  await prisma.transacao.createMany({ data: dados });
  return NextResponse.json({ criadas: dados.length }, { status: 201 });
}
