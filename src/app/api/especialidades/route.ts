import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Especialidades da equipe (ex.: "Técnico de som básico") — por empresa.

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function GET() {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const especialidades = await prisma.especialidade.findMany({
    where: { OR: [{ companyId }, { companyId: null }] },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
  return NextResponse.json({ especialidades });
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const nome = String(body.nome || "").trim();
  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const existe = await prisma.especialidade.findFirst({
    where: {
      nome: { equals: nome, mode: "insensitive" as const },
      OR: [{ companyId }, { companyId: null }],
    },
  });
  if (existe) return NextResponse.json(existe, { status: 200 });

  const especialidade = await prisma.especialidade.create({
    data: { nome, companyId },
    select: { id: true, nome: true },
  });
  return NextResponse.json(especialidade, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") || "";
  const existe = await prisma.especialidade.findFirst({
    where: { id, OR: [{ companyId }, { companyId: null }] },
  });
  if (!existe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.membroEspecialidade.deleteMany({ where: { especialidadeId: id } });
  await prisma.especialidade.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
