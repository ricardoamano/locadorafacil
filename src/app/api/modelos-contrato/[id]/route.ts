import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const existing = await prisma.modeloContrato.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.padrao) {
    await prisma.modeloContrato.updateMany({
      where: { companyId, id: { not: id } },
      data: { padrao: false },
    });
  }

  // Alterar o conteúdo cria nova versão (contratos gerados guardam a versão usada)
  const mudouConteudo =
    body.conteudo !== undefined && body.conteudo !== existing.conteudo;

  const modelo = await prisma.modeloContrato.update({
    where: { id },
    data: {
      nome: body.nome ?? existing.nome,
      conteudo: body.conteudo ?? existing.conteudo,
      ativo: body.ativo ?? existing.ativo,
      padrao: body.padrao ?? existing.padrao,
      ...(mudouConteudo ? { versao: existing.versao + 1 } : {}),
    },
  });
  return NextResponse.json(modelo);
}

// POST /api/modelos-contrato/[id] = duplicar
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.modeloContrato.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const copia = await prisma.modeloContrato.create({
    data: {
      nome: `${existing.nome} (cópia)`,
      conteudo: existing.conteudo,
      ativo: true,
      padrao: false,
      companyId,
    },
  });
  return NextResponse.json(copia, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.modeloContrato.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.modeloContrato.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
