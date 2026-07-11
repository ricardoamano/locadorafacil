import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

type SalaInput = {
  nome: string;
  itens: { itemId: string; quantidade: number; valorUnitario: number }[];
};

function computeTotal(salas: SalaInput[], desconto: number, descontoTipo: string) {
  const bruto = salas.reduce(
    (acc, s) =>
      acc +
      s.itens.reduce((a, i) => a + (i.quantidade || 0) * (i.valorUnitario || 0), 0),
    0
  );
  const descValor = descontoTipo === "percentual" ? (bruto * (desconto || 0)) / 100 : desconto || 0;
  return Math.max(0, bruto - descValor);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const orcamento = await prisma.orcamento.findFirst({
    where: { id, companyId },
    include: {
      cliente: { select: { id: true, nomeFantasia: true, razaoSocial: true } },
      local: { select: { id: true, nome: true } },
      salas: {
        include: {
          itens: { include: { item: { select: { id: true, nome: true, codigo: true } } } },
        },
      },
    },
  });

  if (!orcamento) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(orcamento);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.orcamento.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const salas: SalaInput[] = body.salas || [];
  const total = computeTotal(salas, Number(body.desconto) || 0, body.descontoTipo || "valor");

  // Recria salas/itens
  await prisma.sala.deleteMany({ where: { orcamentoId: id } });

  const orcamento = await prisma.orcamento.update({
    where: { id },
    data: {
      clienteId: body.clienteId,
      status: body.status || existing.status,
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

  return NextResponse.json(orcamento);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.orcamento.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.orcamento.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
