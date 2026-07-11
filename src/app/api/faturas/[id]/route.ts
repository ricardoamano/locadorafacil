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

  const existing = await prisma.fatura.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fatura = await prisma.fatura.update({
    where: { id },
    data: {
      isPostoServico: !!body.isPostoServico,
      orcamentoId: body.orcamentoId || null,
      clienteId: body.clienteId || null,
      clienteNome: body.clienteNome,
      mesRef: body.mesRef || "",
      dataEmissao: body.dataEmissao ? new Date(body.dataEmissao) : existing.dataEmissao,
      dataVencimento: body.dataVencimento
        ? new Date(body.dataVencimento)
        : existing.dataVencimento,
      valor: Number(body.valor) || 0,
      descritivo: body.descritivo || null,
    },
  });

  return NextResponse.json(fatura);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.fatura.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.fatura.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
