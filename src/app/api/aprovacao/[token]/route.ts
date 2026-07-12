import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Rotas públicas de aprovação online do orçamento (acessadas pelo cliente via link)

async function getOrcamento(token: string) {
  return prisma.orcamento.findUnique({
    where: { aprovacaoToken: token },
    include: {
      company: {
        select: { name: true, logoUrl: true, telefone: true, email: true },
      },
      cliente: { select: { nomeFantasia: true } },
      cliente2: { select: { nomeFantasia: true } },
      local: { select: { nome: true } },
      salas: {
        include: {
          itens: {
            include: {
              item: {
                select: { nome: true, descricaoComercial: true, natureza: true },
              },
            },
          },
        },
      },
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function montarResumo(orc: any) {
  const bruto = orc.salas.reduce(
    (acc: number, s: any) =>
      acc +
      s.itens.reduce(
        (a: number, i: any) =>
          a + (i.quantidade || 0) * (i.diarias || 1) * (i.valorUnitario || 0),
        0
      ),
    0
  );
  const desconto = orc.desconto || 0;
  const descontoValor =
    orc.descontoTipo === "percentual" ? (bruto * desconto) / 100 : desconto;
  return {
    empresa: orc.company,
    numero: orc.numero,
    status: orc.status,
    cliente: orc.cliente?.nomeFantasia,
    cliente2: orc.cliente2?.nomeFantasia || null,
    evento: orc.eventoNome,
    tipoEvento: orc.tipoEvento,
    local: orc.local?.nome || null,
    dataInicio: orc.dataInicio,
    dataFim: orc.dataFim,
    formaPagamento: orc.formaPagamento,
    condicoes: orc.condicoes,
    observacoes: orc.observacoes,
    bruto,
    descontoValor,
    descontoTipo: orc.descontoTipo,
    desconto,
    total: Math.max(0, bruto - descontoValor),
    aprovadoOnlineEm: orc.aprovadoOnlineEm,
    aprovadoOnlinePor: orc.aprovadoOnlinePor,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    salas: orc.salas.map((s: any) => ({
      nome: s.nome,
      itens: s.itens.map((i: any) => ({
        nome: i.item?.nome,
        descricao: i.descricaoComercial || i.item?.descricaoComercial || null,
        servico: i.item?.natureza === "SERVICO",
        quantidade: i.quantidade,
        diarias: i.diarias || 1,
        valorUnitario: i.valorUnitario,
        subtotal: (i.quantidade || 0) * (i.diarias || 1) * (i.valorUnitario || 0),
      })),
    })),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const orc = await getOrcamento(token);
  if (!orc) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  return NextResponse.json(montarResumo(orc));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const orc = await getOrcamento(token);
  if (!orc) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  const body = await req.json();
  const nome = String(body.nome || "").trim();
  if (!nome)
    return NextResponse.json({ error: "Informe seu nome completo" }, { status: 400 });
  if (!body.aceite)
    return NextResponse.json({ error: "É preciso aceitar as condições" }, { status: 400 });

  if (orc.status === "CANCELADO" || orc.status === "REPROVADO")
    return NextResponse.json(
      { error: "Este orçamento não está mais disponível para aprovação." },
      { status: 400 }
    );
  if (orc.status === "APROVADO")
    return NextResponse.json({ ok: true, jaAprovado: true });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  // Aprovação transacional: status + OS + receita (idempotente, auditada)
  await prisma.$transaction(async (tx) => {
    const agora = new Date();
    await tx.orcamento.update({
      where: { id: orc.id },
      data: {
        status: "APROVADO",
        aprovadoEm: agora,
        aprovadoPor: `${nome} (aprovação online)`,
        aprovadoOnlineEm: agora,
        aprovadoOnlinePor: nome,
        aprovadoOnlineIp: ip,
      },
    });

    const osExistente = await tx.ordemServico.findUnique({
      where: { orcamentoId: orc.id },
    });
    if (!osExistente) {
      await tx.ordemServico.create({
        data: {
          orcamentoId: orc.id,
          status: "ABERTA",
          horarioMontagem: orc.dataMontagem,
          observacoes: orc.observacoes,
          companyId: orc.companyId,
        },
      });
    }

    const receitaExistente = await tx.transacao.findFirst({
      where: { orcamentoId: orc.id, tipo: "RECEITA" },
    });
    if (!receitaExistente) {
      const resumo = montarResumo(orc);
      await tx.transacao.create({
        data: {
          nome: `Recebimento Orçamento #${orc.numero}${
            orc.eventoNome ? ` — ${orc.eventoNome}` : ""
          }`,
          dataRecebimento: orc.dataFim || orc.dataInicio || new Date(),
          tipo: "RECEITA",
          orcamentoId: orc.id,
          valor: resumo.total,
          observacao: `Gerada automaticamente na aprovação online por ${nome}${ip ? ` (IP ${ip})` : ""}`,
          status: "PENDENTE",
          companyId: orc.companyId,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
