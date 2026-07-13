import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

type ItemInput = {
  itemId?: string | null;
  descricao: string;
  periodo?: string;
  quantidade?: number;
  valorUnitario?: number;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(search
      ? {
          OR: [
            { clienteNome: { contains: search, mode: "insensitive" as const } },
            { mesRef: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [faturas, total] = await Promise.all([
    prisma.fatura.findMany({
      where,
      include: {
        orcamento: { select: { id: true, numero: true } },
        itens: true,
      },
      orderBy: { numero: "desc" },
      skip,
      take: limit,
    }),
    prisma.fatura.count({ where }),
  ]);

  return NextResponse.json({ faturas, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.clienteNome?.trim())
    return NextResponse.json({ error: "Destinatário obrigatório" }, { status: 400 });
  if (!body.dataEmissao || !body.dataVencimento)
    return NextResponse.json({ error: "Datas obrigatórias" }, { status: 400 });

  const itens: ItemInput[] = (body.itens || []).filter(
    (i: ItemInput) => i.descricao?.trim()
  );
  const totalItens = itens.reduce(
    (acc, i) => acc + (Number(i.quantidade) || 1) * (Number(i.valorUnitario) || 0),
    0
  );
  const valor = itens.length > 0 ? totalItens : Number(body.valor) || 0;
  const origem = body.orcamentoId ? "ORCAMENTO" : "DIRETA";
  const usuario = session.user.email || session.user.name || "desconhecido";

  // Numeração sequencial + criação de itens + receita (emissão direta) em transação
  const fatura = await prisma.$transaction(async (tx) => {
    const last = await tx.fatura.findFirst({
      where: { companyId },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    const empresaNum = await tx.company.findUnique({
      where: { id: companyId },
      select: { faturaNumeroInicial: true },
    });
    const numero = Math.max((last?.numero || 0) + 1, empresaNum?.faturaNumeroInicial || 1);

    const nova = await tx.fatura.create({
      data: {
        numero,
        isPostoServico:
          body.tipoDestinatario === "POSTO" || !!body.isPostoServico,
        tipoDestinatario: body.tipoDestinatario === "POSTO" ? "POSTO" : "CLIENTE",
        origem,
        justificativa: body.justificativa || null,
        orcamentoId: body.orcamentoId || null,
        clienteId: body.clienteId || null,
        clienteNome: body.clienteNome.trim(),
        mesRef: body.mesRef || "",
        dataEmissao: new Date(body.dataEmissao),
        dataVencimento: new Date(body.dataVencimento),
        valor,
        descritivo: body.descritivo || null,
        companyId,
        itens: {
          create: itens.map((i) => ({
            itemId: i.itemId || null,
            descricao: i.descricao.trim(),
            periodo: i.periodo || "DIARIA",
            quantidade: Number(i.quantidade) || 1,
            valorUnitario: Number(i.valorUnitario) || 0,
            subtotal:
              (Number(i.quantidade) || 1) * (Number(i.valorUnitario) || 0),
          })),
        },
      },
      include: { itens: true },
    });

    // Emissão direta (sem orçamento): cria a receita correspondente,
    // vinculada à fatura para nunca duplicar
    if (origem === "DIRETA") {
      const receitaExistente = await tx.transacao.findFirst({
        where: { faturaId: nova.id },
      });
      if (!receitaExistente) {
        await tx.transacao.create({
          data: {
            nome: `Fatura #${numero} — ${nova.clienteNome}`,
            dataRecebimento: new Date(body.dataVencimento),
            tipo: "RECEITA",
            faturaId: nova.id,
            valor,
            observacao: `Gerada automaticamente na emissão direta da fatura #${numero} por ${usuario}${
              body.justificativa ? ` — Justificativa: ${body.justificativa}` : ""
            }`,
            status: "PENDENTE",
            companyId,
          },
        });
      }
    }

    return nova;
  });

  return NextResponse.json(fatura, { status: 201 });
}
