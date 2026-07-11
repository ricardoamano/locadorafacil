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

  const modelos = await prisma.modeloContrato.findMany({
    where: { companyId, ...(somenteAtivos ? { ativo: true } : {}) },
    orderBy: [{ padrao: "desc" }, { nome: "asc" }],
  });
  return NextResponse.json({ modelos });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  if (body.padrao) {
    await prisma.modeloContrato.updateMany({
      where: { companyId },
      data: { padrao: false },
    });
  }

  const modelo = await prisma.modeloContrato.create({
    data: {
      nome: body.nome.trim(),
      conteudo: body.conteudo || "",
      padrao: !!body.padrao,
      companyId,
    },
  });
  return NextResponse.json(modelo, { status: 201 });
}
