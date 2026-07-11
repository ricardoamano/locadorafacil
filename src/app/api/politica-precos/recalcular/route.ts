import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calcularPrecos } from "@/lib/precos";

type SessionUser = { companyId?: string };

// GET: quantos itens automáticos serão afetados
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const afetados = await prisma.item.count({
    where: { companyId, precoManual: false },
  });
  const manuais = await prisma.item.count({
    where: { companyId, precoManual: true },
  });
  return NextResponse.json({ afetados, manuais });
}

// POST: recalcula os preços de todos os itens automáticos com a política vigente
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const empresa = await prisma.company.findUnique({ where: { id: companyId } });
  if (!empresa) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const politica = {
    diasSemana: empresa.diasSemana,
    diasQuinzena: empresa.diasQuinzena,
    diasMes: empresa.diasMes,
    descontoSemana: empresa.descontoSemana,
    descontoQuinzena: empresa.descontoQuinzena,
    descontoMes: empresa.descontoMes,
  };

  const itens = await prisma.item.findMany({
    where: { companyId, precoManual: false },
    select: { id: true, valorAluguel: true },
  });

  // Documentos já emitidos (orçamentos, faturas, contratos) não são alterados:
  // eles guardam os valores da época (SalaItem.valorUnitario, Fatura.valor, snapshots)
  await prisma.$transaction(
    itens.map((it) => {
      const calc = calcularPrecos(it.valorAluguel, politica);
      return prisma.item.update({
        where: { id: it.id },
        data: {
          valorSemana: calc.valorSemana,
          valorQuinzena: calc.valorQuinzena,
          valorMes: calc.valorMes,
        },
      });
    })
  );

  return NextResponse.json({ recalculados: itens.length });
}
