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
  const somenteAtivos = searchParams.get("ativos") === "1";

  const metodos = await prisma.metodoPagamento.findMany({
    where: { companyId, ...(somenteAtivos ? { ativo: true } : {}) },
    orderBy: { ordem: "asc" },
  });
  return NextResponse.json({ metodos });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const last = await prisma.metodoPagamento.findFirst({
    where: { companyId },
    orderBy: { ordem: "desc" },
  });
  const metodo = await prisma.metodoPagamento.create({
    data: {
      nome: body.nome.trim(),
      ordem: (last?.ordem || 0) + 1,
      companyId,
    },
  });
  return NextResponse.json(metodo, { status: 201 });
}
