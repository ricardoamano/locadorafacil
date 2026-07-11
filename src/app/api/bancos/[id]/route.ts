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
  const existing = await prisma.banco.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const banco = await prisma.banco.update({
    where: { id },
    data: {
      nome: body.nome ?? existing.nome,
      ativo: body.ativo ?? existing.ativo,
      ordem: body.ordem ?? existing.ordem,
    },
  });
  return NextResponse.json(banco);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.banco.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const emUso = await prisma.transacao.count({ where: { bancoId: id } });
  if (emUso > 0)
    return NextResponse.json(
      { error: `Este banco está em ${emUso} transação(ões) — desative-o em vez de excluir.` },
      { status: 400 }
    );

  await prisma.banco.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
