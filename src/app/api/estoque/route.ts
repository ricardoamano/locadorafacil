import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

// Visão geral do estoque físico em tempo real (unidades serializadas)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const busca = new URL(req.url).searchParams.get("busca")?.trim() || "";

  // Busca de localização: onde está determinada unidade/equipamento (qualquer status)
  let resultadoBusca = null;
  if (busca) {
    const unidadesBusca = await prisma.itemUnidade.findMany({
      where: {
        companyId,
        OR: [
          { codigo: { contains: busca, mode: "insensitive" } },
          { item: { nome: { contains: busca, mode: "insensitive" } } },
          { item: { apelidos: { contains: busca, mode: "insensitive" } } },
        ],
      },
      orderBy: { codigo: "asc" },
      take: 60,
      include: {
        item: { select: { nome: true } },
        os: {
          select: {
            id: true,
            orcamento: {
              select: {
                numero: true,
                eventoNome: true,
                cliente: { select: { nomeFantasia: true } },
              },
            },
          },
        },
      },
    });
    resultadoBusca = unidadesBusca.map((u) => ({
      id: u.id,
      codigo: u.codigo,
      itemNome: u.item.nome,
      status: u.status,
      osId: u.osId,
      osNumero: u.os?.orcamento?.numero ?? null,
      evento: u.os?.orcamento?.eventoNome ?? null,
      cliente: u.os?.orcamento?.cliente?.nomeFantasia ?? null,
    }));
  }

  const unidades = await prisma.itemUnidade.findMany({
    where: { companyId, status: { in: ["NO_EVENTO", "MANUTENCAO"] } },
    orderBy: [{ status: "asc" }, { codigo: "asc" }],
    include: {
      item: { select: { nome: true } },
      os: {
        select: {
          id: true,
          orcamento: {
            select: {
              numero: true,
              eventoNome: true,
              dataFim: true,
              cliente: { select: { nomeFantasia: true } },
            },
          },
        },
      },
    },
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const fora = unidades
    .filter((u) => u.status === "NO_EVENTO")
    .map((u) => ({
      id: u.id,
      codigo: u.codigo,
      itemNome: u.item.nome,
      osId: u.os?.id || null,
      osNumero: u.os?.orcamento?.numero ?? null,
      evento: u.os?.orcamento?.eventoNome ?? null,
      cliente: u.os?.orcamento?.cliente?.nomeFantasia ?? null,
      dataFim: u.os?.orcamento?.dataFim ?? null,
      atrasada: u.os?.orcamento?.dataFim
        ? new Date(u.os.orcamento.dataFim) < hoje
        : false,
    }));

  const manutencao = unidades
    .filter((u) => u.status === "MANUTENCAO")
    .map((u) => ({ id: u.id, codigo: u.codigo, itemNome: u.item.nome }));

  const [totalUnidades, emEstoque, manutencaoVencida] = await Promise.all([
    prisma.itemUnidade.count({ where: { companyId, status: { not: "BAIXADA" } } }),
    prisma.itemUnidade.count({ where: { companyId, status: "EM_ESTOQUE" } }),
    // Manutenção programada vencida (revisão preventiva em atraso)
    prisma.itemUnidade.findMany({
      where: {
        companyId,
        status: { notIn: ["BAIXADA", "MANUTENCAO"] },
        proximaManutencao: { not: null, lte: hoje },
      },
      orderBy: { proximaManutencao: "asc" },
      include: { item: { select: { nome: true } } },
    }),
  ]);

  return NextResponse.json({
    resumo: {
      total: totalUnidades,
      emEstoque,
      fora: fora.length,
      manutencao: manutencao.length,
      atrasadas: fora.filter((f) => f.atrasada).length,
      manutencaoVencida: manutencaoVencida.length,
    },
    busca: resultadoBusca,
    fora,
    manutencao,
    manutencaoVencida: manutencaoVencida.map((u) => ({
      id: u.id,
      codigo: u.codigo,
      itemNome: u.item.nome,
      proximaManutencao: u.proximaManutencao,
    })),
  });
}
