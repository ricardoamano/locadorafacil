import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const membros = await prisma.membro.findMany({
    where: { companyId },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json({ membros });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const membro = await prisma.membro.create({
    data: {
      nome: body.nome.trim(),
      telefone: body.telefone || null,
      email: body.email || null,
      rg: body.rg || null,
      cpf: body.cpf || null,
      tipo: body.tipo || "FREELANCER",
      pix: body.pix || null,
      cache: body.cache != null && body.cache !== "" ? Number(body.cache) : null,
      companyId,
    },
  });

  return NextResponse.json(membro, { status: 201 });
}
