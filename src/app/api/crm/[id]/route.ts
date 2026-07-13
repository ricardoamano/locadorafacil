import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Registra um follow-up (contato) de um orçamento e, quando informado o
// resultado GANHOU/PERDEU, atualiza o status do orçamento.

type SessionUser = { companyId?: string; name?: string | null };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId ? { companyId: u.companyId, nome: u.name || null } : null;
}

// GET: histórico de follow-ups do orçamento
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const orc = await prisma.orcamento.findFirst({
    where: { id, companyId: sessao.companyId },
    select: { id: true },
  });
  if (!orc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const followUps = await prisma.crmFollowUp.findMany({
    where: { orcamentoId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ followUps });
}

// POST: registra um novo contato
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const orc = await prisma.orcamento.findFirst({
    where: { id, companyId: sessao.companyId },
    select: { id: true, status: true },
  });
  if (!orc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const resultado = body.resultado || null;

  const followUp = await prisma.crmFollowUp.create({
    data: {
      companyId: sessao.companyId,
      orcamentoId: id,
      canal: body.canal || null,
      observacao: body.observacao?.trim() || null,
      resultado,
      proximaData: body.proximaData ? new Date(body.proximaData) : null,
      autor: sessao.nome,
    },
  });

  // Resultado fecha o orçamento: ganhou → aprova; perdeu → reprova.
  let novoStatus: string | null = null;
  if (resultado === "GANHOU") novoStatus = "APROVADO";
  else if (resultado === "PERDEU") novoStatus = "REPROVADO";
  if (novoStatus && novoStatus !== orc.status) {
    await prisma.orcamento.update({ where: { id }, data: { status: novoStatus } });
    // Encerra tarefas de CRM em aberto para este orçamento
    await prisma.tarefa.updateMany({
      where: { crmOrcamentoId: id, status: { not: "CONCLUIDA" } },
      data: { status: "CONCLUIDA" },
    });
  }

  return NextResponse.json({ followUp, novoStatus }, { status: 201 });
}
