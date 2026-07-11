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
  itens: { itemId: string; quantidade: number; diarias?: number; valorUnitario: number; descricaoComercial?: string }[];
};

function computeTotal(salas: SalaInput[], desconto: number, descontoTipo: string) {
  const bruto = salas.reduce(
    (acc, s) =>
      acc +
      s.itens.reduce((a, i) => a + (i.quantidade || 0) * (i.diarias || 1) * (i.valorUnitario || 0), 0),
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
          itens: { include: { item: { select: { id: true, nome: true, codigo: true, descricaoComercial: true } } } },
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

  const novoStatus = body.status || existing.status;
  const aprovandoAgora = novoStatus === "APROVADO" && existing.status !== "APROVADO";
  const session = await auth();
  const usuario = session?.user?.email || session?.user?.name || "desconhecido";

  // Operação transacional: atualização + geração automática de OS e receita
  // ao aprovar (idempotente — nunca duplica se salvar de novo)
  const result = await prisma.$transaction(async (tx) => {
    await tx.sala.deleteMany({ where: { orcamentoId: id } });

    const orcamento = await tx.orcamento.update({
      where: { id },
      data: {
        clienteId: body.clienteId,
        status: novoStatus,
        eventoNome: body.eventoNome || null,
        tipoEvento: body.tipoEvento || null,
        localId: body.localId || null,
        dataMontagem: body.dataMontagem ? new Date(body.dataMontagem) : null,
        dataInicio: body.dataInicio ? new Date(body.dataInicio) : null,
        dataFim: body.dataFim ? new Date(body.dataFim) : null,
        observacoes: body.observacoes || null,
        obsInternas: body.obsInternas || null,
        formaPagamento: body.formaPagamento || null,
        condicoes: body.condicoes || null,
        desconto: body.desconto != null && body.desconto !== "" ? Number(body.desconto) : null,
        descontoTipo: body.descontoTipo || "valor",
        total,
        ...(aprovandoAgora ? { aprovadoEm: new Date(), aprovadoPor: usuario } : {}),
        salas: {
          create: salas.map((s) => ({
            nome: s.nome || "Sala",
            itens: {
              create: (s.itens || [])
                .filter((i) => i.itemId)
                .map((i) => ({
                  itemId: i.itemId,
                  quantidade: Number(i.quantidade) || 1,
                  diarias: Number(i.diarias) || 1,
                  valorUnitario: Number(i.valorUnitario) || 0,
                  subtotal: (Number(i.quantidade) || 1) * (Number(i.diarias) || 1) * (Number(i.valorUnitario) || 0),
                  descricaoComercial: i.descricaoComercial?.trim()
                    ? i.descricaoComercial.trim().slice(0, 100)
                    : null,
                })),
            },
          })),
        },
      },
      include: { salas: { include: { itens: true } } },
    });

    let osId: string | null = null;
    let receitaId: string | null = null;
    let criouOs = false;
    let criouReceita = false;

    if (novoStatus === "APROVADO") {
      const osExistente = await tx.ordemServico.findUnique({
        where: { orcamentoId: id },
      });
      if (osExistente) {
        osId = osExistente.id;
      } else {
        const os = await tx.ordemServico.create({
          data: {
            orcamentoId: id,
            status: "ABERTA",
            horarioMontagem: orcamento.dataMontagem,
            observacoes: orcamento.observacoes,
            companyId: existing.companyId,
          },
        });
        osId = os.id;
        criouOs = true;
      }

      const receitaExistente = await tx.transacao.findFirst({
        where: { orcamentoId: id, tipo: "RECEITA" },
      });
      if (receitaExistente) {
        receitaId = receitaExistente.id;
      } else {
        const receita = await tx.transacao.create({
          data: {
            nome: `Recebimento Orçamento #${existing.numero}${
              orcamento.eventoNome ? ` — ${orcamento.eventoNome}` : ""
            }`,
            dataRecebimento:
              orcamento.dataFim || orcamento.dataInicio || new Date(),
            tipo: "RECEITA",
            orcamentoId: id,
            valor: total,
            observacao: `Gerada automaticamente na aprovação do orçamento #${existing.numero} por ${usuario}`,
            status: "PENDENTE",
            companyId: existing.companyId,
          },
        });
        receitaId = receita.id;
        criouReceita = true;
      }
    }

    return { orcamento, osId, receitaId, criouOs, criouReceita };
  });

  return NextResponse.json({
    ...result.orcamento,
    vinculos: {
      osId: result.osId,
      receitaId: result.receitaId,
      criouOs: result.criouOs,
      criouReceita: result.criouReceita,
    },
  });
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
