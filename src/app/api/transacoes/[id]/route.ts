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

  const existing = await prisma.transacao.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const transacao = await prisma.transacao.update({
    where: { id },
    data: {
      nome: body.nome,
      dataRecebimento: body.dataRecebimento ? new Date(body.dataRecebimento) : existing.dataRecebimento,
      tipo: body.tipo || existing.tipo,
      categoriaId: body.categoriaId || null,
      orcamentoId: body.orcamentoId || null,
      valor: Number(body.valor) || 0,
      observacao: body.observacao || null,
      notaFiscal: !!body.notaFiscal,
      status: body.status || existing.status,
    },
  });

  return NextResponse.json(transacao);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.transacao.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.transacao.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
