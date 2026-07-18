import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

type ItemInput = {
  itemId?: string | null;
  descricao: string;
  periodo?: string;
  quantidade?: number;
  valorUnitario?: number;
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.fatura.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fatura emitida é imutável (7.2)
  if (existing.snapshot)
    return NextResponse.json(
      { error: "Fatura já emitida não pode ser alterada" },
      { status: 400 }
    );

  const itens: ItemInput[] = (body.itens || []).filter(
    (i: ItemInput) => i.descricao?.trim()
  );
  const totalItens = itens.reduce(
    (acc, i) => acc + (Number(i.quantidade) || 1) * (Number(i.valorUnitario) || 0),
    0
  );
  const valor = itens.length > 0 ? totalItens : Number(body.valor) || 0;

  const fatura = await prisma.$transaction(async (tx) => {
    await tx.faturaItem.deleteMany({ where: { faturaId: id } });

    // Trocou o CNPJ emissor antes de emitir? A fatura muda de sequência e
    // ganha o próximo número da nova sequência (cada emissora conta à parte).
    const novaEmissoraId =
      body.emissoraId !== undefined ? body.emissoraId || null : existing.emissoraId;
    let novoNumero: number | undefined;
    if (novaEmissoraId !== existing.emissoraId) {
      const last = await tx.fatura.findFirst({
        where: { companyId, emissoraId: novaEmissoraId, NOT: { id } },
        orderBy: { numero: "desc" },
        select: { numero: true },
      });
      let piso = 1;
      if (novaEmissoraId) {
        const em = await tx.empresaEmissora.findFirst({
          where: { id: novaEmissoraId, companyId },
          select: { faturaNumeroInicial: true },
        });
        piso = em?.faturaNumeroInicial || 1;
      } else {
        const empresaNum = await tx.company.findUnique({
          where: { id: companyId },
          select: { faturaNumeroInicial: true },
        });
        piso = empresaNum?.faturaNumeroInicial || 1;
      }
      novoNumero = Math.max((last?.numero || 0) + 1, piso);
    }

    const atualizada = await tx.fatura.update({
      where: { id },
      data: {
        ...(novoNumero !== undefined ? { numero: novoNumero } : {}),
        isPostoServico:
          body.tipoDestinatario === "POSTO" || !!body.isPostoServico,
        tipoDestinatario:
          body.tipoDestinatario === "POSTO" ? "POSTO" : "CLIENTE",
        justificativa: body.justificativa || null,
        ...(body.emissoraId !== undefined ? { emissoraId: body.emissoraId || null } : {}),
        orcamentoId: body.orcamentoId || null,
        clienteId: body.clienteId || null,
        clienteNome: body.clienteNome,
        mesRef: body.mesRef || "",
        dataEmissao: body.dataEmissao
          ? new Date(body.dataEmissao)
          : existing.dataEmissao,
        dataVencimento: body.dataVencimento
          ? new Date(body.dataVencimento)
          : existing.dataVencimento,
        valor,
        descritivo: body.descritivo || null,
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

    // Mantém a receita vinculada sincronizada enquanto a fatura não foi emitida
    const receita = await tx.transacao.findFirst({ where: { faturaId: id } });
    if (receita && receita.status === "PENDENTE") {
      await tx.transacao.update({
        where: { id: receita.id },
        data: {
          valor,
          nome: `Fatura #${existing.numero} — ${body.clienteNome || existing.clienteNome}`,
        },
      });
    }

    return atualizada;
  });

  return NextResponse.json(fatura);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.fatura.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.snapshot)
    return NextResponse.json(
      { error: "Fatura já emitida não pode ser excluída (registro auditável)" },
      { status: 400 }
    );

  await prisma.fatura.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
