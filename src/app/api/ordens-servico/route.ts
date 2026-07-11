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
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(status ? { status } : {}),
  };

  const [ordens, total] = await Promise.all([
    prisma.ordemServico.findMany({
      where,
      include: {
        orcamento: {
          select: {
            id: true,
            numero: true,
            eventoNome: true,
            dataInicio: true,
            dataFim: true,
            total: true,
            cliente: { select: { id: true, nomeFantasia: true } },
            local: { select: { id: true, nome: true } },
          },
        },
        _count: { select: { escala: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.ordemServico.count({ where }),
  ]);

  return NextResponse.json({ ordens, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.orcamentoId)
    return NextResponse.json({ error: "Orçamento obrigatório" }, { status: 400 });

  const orcamento = await prisma.orcamento.findFirst({
    where: { id: body.orcamentoId, companyId },
    include: { os: true },
  });
  if (!orcamento) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
  if (orcamento.os)
    return NextResponse.json({ error: "Este orçamento já possui uma OS" }, { status: 400 });

  const os = await prisma.ordemServico.create({
    data: {
      orcamentoId: orcamento.id,
      status: "ABERTA",
      companyId,
    },
  });

  return NextResponse.json(os, { status: 201 });
}
