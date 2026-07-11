import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const tipo = searchParams.get("tipo") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(tipo ? { tipo } : {}),
    ...(status ? { status } : {}),
    ...(search ? { nome: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [transacoes, total, receitas, despesas] = await Promise.all([
    prisma.transacao.findMany({
      where,
      include: {
        categoria: { select: { id: true, nome: true } },
        orcamento: { select: { id: true, numero: true } },
        banco: { select: { id: true, nome: true } },
      },
      orderBy: { dataRecebimento: "desc" },
      skip,
      take: limit,
    }),
    prisma.transacao.count({ where }),
    prisma.transacao.aggregate({
      where: { companyId, tipo: "RECEITA" },
      _sum: { valor: true },
    }),
    prisma.transacao.aggregate({
      where: { companyId, tipo: "DESPESA" },
      _sum: { valor: true },
    }),
  ]);

  const entradas = receitas._sum.valor || 0;
  const saidas = despesas._sum.valor || 0;

  return NextResponse.json({
    transacoes,
    total,
    page,
    limit,
    saldo: { entradas, saidas, total: entradas - saidas },
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

  const transacao = await prisma.transacao.create({
    data: {
      nome: body.nome.trim(),
      dataRecebimento: new Date(body.dataRecebimento),
      tipo: body.tipo || "RECEITA",
      categoriaId: body.categoriaId || null,
      orcamentoId: body.orcamentoId || null,
      valor: Number(body.valor) || 0,
      bancoId: body.bancoId || null,
      observacao: body.observacao || null,
      notaFiscal: !!body.notaFiscal,
      status: body.status || "PENDENTE",
      companyId,
    },
  });

  return NextResponse.json(transacao, { status: 201 });
}
