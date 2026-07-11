import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

type SalaInput = {
  nome: string;
  itens: { itemId: string; quantidade: number; valorUnitario: number }[];
};

function computeTotals(salas: SalaInput[], desconto: number, descontoTipo: string) {
  const bruto = salas.reduce(
    (acc, s) =>
      acc +
      s.itens.reduce((a, i) => a + (i.quantidade || 0) * (i.valorUnitario || 0), 0),
    0
  );
  const descValor = descontoTipo === "percentual" ? (bruto * (desconto || 0)) / 100 : desconto || 0;
  return { bruto, total: Math.max(0, bruto - descValor) };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { eventoNome: { contains: search } },
            { cliente: { nomeFantasia: { contains: search } } },
          ],
        }
      : {}),
  };

  const [orcamentos, total] = await Promise.all([
    prisma.orcamento.findMany({
      where,
      include: {
        cliente: { select: { id: true, nomeFantasia: true } },
        local: { select: { id: true, nome: true } },
        _count: { select: { salas: true } },
      },
      orderBy: { numero: "desc" },
      skip,
      take: limit,
    }),
    prisma.orcamento.count({ where }),
  ]);

  return NextResponse.json({ orcamentos, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.clienteId) return NextResponse.json({ error: "Cliente obrigatório" }, { status: 400 });

  const salas: SalaInput[] = body.salas || [];
  const { total } = computeTotals(salas, Number(body.desconto) || 0, body.descontoTipo || "valor");

  const last = await prisma.orcamento.findFirst({
    where: { companyId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const numero = (last?.numero || 0) + 1;

  const orcamento = await prisma.orcamento.create({
    data: {
      numero,
      clienteId: body.clienteId,
      status: body.status || "PENDENTE",
      eventoNome: body.eventoNome || null,
      tipoEvento: body.tipoEvento || null,
      localId: body.localId || null,
      dataInicio: body.dataInicio ? new Date(body.dataInicio) : null,
      dataFim: body.dataFim ? new Date(body.dataFim) : null,
      observacoes: body.observacoes || null,
      obsInternas: body.obsInternas || null,
      formaPagamento: body.formaPagamento || null,
      condicoes: body.condicoes || null,
      desconto: body.desconto != null && body.desconto !== "" ? Number(body.desconto) : null,
      descontoTipo: body.descontoTipo || "valor",
      total,
      companyId,
      salas: {
        create: salas.map((s) => ({
          nome: s.nome || "Sala",
          itens: {
            create: (s.itens || [])
              .filter((i) => i.itemId)
              .map((i) => ({
                itemId: i.itemId,
                quantidade: Number(i.quantidade) || 1,
                valorUnitario: Number(i.valorUnitario) || 0,
                subtotal: (Number(i.quantidade) || 1) * (Number(i.valorUnitario) || 0),
              })),
          },
        })),
      },
    },
    include: { salas: { include: { itens: true } } },
  });

  return NextResponse.json(orcamento, { status: 201 });
}
