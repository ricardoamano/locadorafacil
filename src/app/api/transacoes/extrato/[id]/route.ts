import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";

// Ações de revisão de uma linha do extrato:
// conciliar (casa com transação existente), criar (gera transação nova),
// ignorar, e desfazer (volta a PENDENTE, revertendo o vínculo).

type SessionUser = { companyId?: string; name?: string | null };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as SessionUser;
  if (!u.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const acao = body?.acao as string;

  const linha = await prisma.extratoLinha.findFirst({
    where: { id, companyId: u.companyId },
  });
  if (!linha) return NextResponse.json({ error: "Linha não encontrada" }, { status: 404 });

  if (acao === "conciliar") {
    const transacaoId = body?.transacaoId as string;
    if (!transacaoId) return NextResponse.json({ error: "transacaoId obrigatório" }, { status: 400 });
    const t = await prisma.transacao.findFirst({
      where: { id: transacaoId, companyId: u.companyId },
    });
    if (!t) return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
    if (t.conciliadaEm)
      return NextResponse.json({ error: "Essa transação já foi conciliada com outra linha." }, { status: 400 });

    await prisma.$transaction([
      prisma.extratoLinha.update({
        where: { id },
        data: { status: "CONCILIADA", transacaoId },
      }),
      prisma.transacao.update({
        where: { id: transacaoId },
        data: {
          conciliadaEm: new Date(),
          // caiu no extrato = dinheiro andou de verdade
          ...(t.status !== "PAGO" ? { status: "PAGO" } : {}),
          ...(!t.bancoId && linha.bancoId ? { bancoId: linha.bancoId } : {}),
        },
      }),
    ]);
    await auditar(session.user as never, {
      tipo: "ALTERACAO",
      modulo: "financeiro",
      acao: `Conciliou extrato: ${linha.descricao.slice(0, 60)} ↔ ${t.nome}`,
    });
    return NextResponse.json({ success: true });
  }

  if (acao === "criar") {
    const nova = await prisma.transacao.create({
      data: {
        companyId: u.companyId,
        nome: (body?.nome as string)?.trim() || linha.descricao.slice(0, 120),
        tipo: linha.valor > 0 ? "RECEITA" : "DESPESA",
        valor: Math.abs(linha.valor),
        dataRecebimento: linha.data,
        bancoId: linha.bancoId,
        status: "PAGO",
        conciliadaEm: new Date(),
        observacao: `Importado do extrato (${linha.arquivoNome || "OFX"})`,
      },
    });
    await prisma.extratoLinha.update({
      where: { id },
      data: { status: "CRIADA", transacaoId: nova.id },
    });
    await auditar(session.user as never, {
      tipo: "ALTERACAO",
      modulo: "financeiro",
      acao: `Criou lançamento do extrato: ${nova.nome}`,
    });
    return NextResponse.json({ success: true, transacaoId: nova.id });
  }

  if (acao === "ignorar") {
    await prisma.extratoLinha.update({ where: { id }, data: { status: "IGNORADA" } });
    return NextResponse.json({ success: true });
  }

  if (acao === "desfazer") {
    // Reverte o vínculo. Se a transação foi CRIADA pela importação, apaga junto.
    if (linha.status === "CRIADA" && linha.transacaoId) {
      await prisma.$transaction([
        prisma.extratoLinha.update({
          where: { id },
          data: { status: "PENDENTE", transacaoId: null },
        }),
        prisma.transacao.delete({ where: { id: linha.transacaoId } }),
      ]);
    } else if (linha.status === "CONCILIADA" && linha.transacaoId) {
      await prisma.$transaction([
        prisma.extratoLinha.update({
          where: { id },
          data: { status: "PENDENTE", transacaoId: null },
        }),
        prisma.transacao.update({
          where: { id: linha.transacaoId },
          data: { conciliadaEm: null },
        }),
      ]);
    } else {
      await prisma.extratoLinha.update({ where: { id }, data: { status: "PENDENTE" } });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
