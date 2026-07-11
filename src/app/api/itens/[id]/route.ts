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
  const { id: _id, categoria: _c, marca: _m, ...data } = body;

  const existing = await prisma.item.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.item.update({
    where: { id },
    data: {
      codigo: data.codigo || "",
      nome: data.nome,
      valorAluguel: Number(data.valorAluguel) || 0,
      tipo: data.tipo || "PROPRIO",
      quantidade: Number(data.quantidade) || 0,
      especificacoes: data.especificacoes || null,
      emCatalogo: data.emCatalogo ?? true,
      categoriaId: data.categoriaId || null,
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.item.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.item.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
