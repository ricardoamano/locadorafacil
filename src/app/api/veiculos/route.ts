import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const veiculos = await prisma.veiculo.findMany({
    where: { companyId },
    orderBy: { modelo: "asc" },
  });
  return NextResponse.json({ veiculos });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.placa?.trim() || !body.modelo?.trim())
    return NextResponse.json({ error: "Placa e modelo obrigatórios" }, { status: 400 });

  const veiculo = await prisma.veiculo.create({
    data: {
      placa: body.placa.trim().toUpperCase(),
      modelo: body.modelo.trim(),
      ano: body.ano ? Number(body.ano) : null,
      tipo: body.tipo || null,
      capacidadeCarga: body.capacidadeCarga || null,
      companyId,
    },
  });
  return NextResponse.json(veiculo, { status: 201 });
}
