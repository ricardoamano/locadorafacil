import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calcularPrecos } from "@/lib/precos";

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

  const diaria = Number(data.valorAluguel) || 0;
  const precoManual = !!data.precoManual;
  const empresa = await prisma.company.findUnique({ where: { id: companyId } });
  const calc = calcularPrecos(diaria, {
    diasSemana: empresa?.diasSemana ?? 7,
    diasQuinzena: empresa?.diasQuinzena ?? 15,
    diasMes: empresa?.diasMes ?? 30,
    descontoSemana: empresa?.descontoSemana ?? 0,
    descontoQuinzena: empresa?.descontoQuinzena ?? 0,
    descontoMes: empresa?.descontoMes ?? 0,
  });

  const item = await prisma.item.update({
    where: { id },
    data: {
      codigo: data.codigo || "",
      nome: data.nome,
      valorAluguel: diaria,
      precoManual,
      valorSemana: precoManual && data.valorSemana != null ? Number(data.valorSemana) : calc.valorSemana,
      valorQuinzena: precoManual && data.valorQuinzena != null ? Number(data.valorQuinzena) : calc.valorQuinzena,
      valorMes: precoManual && data.valorMes != null ? Number(data.valorMes) : calc.valorMes,
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
