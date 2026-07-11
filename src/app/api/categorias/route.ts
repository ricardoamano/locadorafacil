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
  const tipo = searchParams.get("tipo") || "";

  const categorias = await prisma.categoria.findMany({
    where: { companyId, ...(tipo ? { tipo } : {}) },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json({ categorias });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const categoria = await prisma.categoria.create({
    data: {
      nome: body.nome.trim(),
      tipo: body.tipo || "ITEM",
      companyId,
    },
  });

  return NextResponse.json(categoria, { status: 201 });
}
