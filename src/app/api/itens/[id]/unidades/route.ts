import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sincronizarUnidades } from "@/lib/unidades";

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.item.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Garante que itens antigos ganhem unidades ao abrir a tela
  await sincronizarUnidades(id);

  const unidades = await prisma.itemUnidade.findMany({
    where: { itemId: id },
    orderBy: { numero: "asc" },
    include: {
      os: {
        select: {
          id: true,
          orcamento: { select: { numero: true, eventoNome: true } },
        },
      },
    },
  });
  return NextResponse.json({ unidades });
}

// Ajuste manual de status da unidade (manutenção, baixa, volta ao estoque)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const status = ["EM_ESTOQUE", "MANUTENCAO", "BAIXADA"].includes(body.status)
    ? body.status
    : null;
  const temManutencao = body.proximaManutencao !== undefined;
  if (!body.unidadeId || (!status && !temManutencao))
    return NextResponse.json(
      { error: "unidadeId e status ou proximaManutencao são obrigatórios" },
      { status: 400 }
    );

  const unidade = await prisma.itemUnidade.findFirst({
    where: { id: body.unidadeId, itemId: id, companyId },
  });
  if (!unidade) return NextResponse.json({ error: "Unidade não encontrada" }, { status: 404 });
  if (status && unidade.status === "NO_EVENTO")
    return NextResponse.json(
      { error: "Unidade está em evento — registre a entrada na OS antes de alterar." },
      { status: 400 }
    );

  const atualizada = await prisma.itemUnidade.update({
    where: { id: unidade.id },
    data: {
      ...(status ? { status, osId: null } : {}),
      ...(temManutencao
        ? {
            proximaManutencao: body.proximaManutencao
              ? new Date(body.proximaManutencao)
              : null,
          }
        : {}),
    },
  });

  // Alimenta o histórico individual da unidade
  if (status && status !== unidade.status) {
    const session = await auth();
    const nome =
      (session?.user as { name?: string | null; email?: string | null } | undefined)?.name ||
      (session?.user as { email?: string | null } | undefined)?.email ||
      null;
    await prisma.unidadeEvento.create({
      data: {
        unidadeId: unidade.id,
        tipo:
          status === "MANUTENCAO"
            ? "MANUTENCAO"
            : status === "BAIXADA"
              ? "BAIXA"
              : "RETORNO_ESTOQUE",
        autor: nome,
      },
    });
  }
  return NextResponse.json(atualizada);
}
