import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

/**
 * Disponibilidade por período (checagem de conflito de agenda).
 * Comprometido = itens em orçamentos APROVADOS cujo evento sobrepõe as datas.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.inicio) return NextResponse.json({ comprometidos: {} });

  const inicio = new Date(body.inicio);
  const fim = body.fim ? new Date(body.fim) : inicio;
  const excluirOrcamentoId = body.excluirOrcamentoId || null;

  // Sobreposição: começa antes do fim do período E termina depois do início
  const orcamentos = await prisma.orcamento.findMany({
    where: {
      companyId,
      status: "APROVADO",
      ...(excluirOrcamentoId ? { NOT: { id: excluirOrcamentoId } } : {}),
      dataInicio: { not: null, lte: fim },
      OR: [{ dataFim: { gte: inicio } }, { dataFim: null, dataInicio: { gte: inicio } }],
    },
    select: {
      numero: true,
      eventoNome: true,
      salas: { select: { itens: { select: { itemId: true, quantidade: true } } } },
    },
  });

  const comprometidos: Record<
    string,
    { quantidade: number; eventos: { numero: number; evento: string | null }[] }
  > = {};
  for (const orc of orcamentos) {
    const porItem = new Map<string, number>();
    for (const sala of orc.salas)
      for (const it of sala.itens)
        porItem.set(it.itemId, (porItem.get(it.itemId) || 0) + it.quantidade);
    for (const [itemId, qtd] of porItem) {
      if (!comprometidos[itemId])
        comprometidos[itemId] = { quantidade: 0, eventos: [] };
      comprometidos[itemId].quantidade += qtd;
      comprometidos[itemId].eventos.push({
        numero: orc.numero,
        evento: orc.eventoNome,
      });
    }
  }

  return NextResponse.json({ comprometidos });
}
