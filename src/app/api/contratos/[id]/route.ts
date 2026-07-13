import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string; name?: string | null };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId
    ? { companyId: u.companyId, nome: u.name || session.user.email || null }
    : null;
}

// GET: contrato com histórico de versões (para edição, versões e impressão)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const contrato = await prisma.contrato.findFirst({
    where: { id, companyId: sessao.companyId },
    include: {
      cliente: { select: { id: true, nomeFantasia: true, razaoSocial: true } },
      orcamento: { select: { id: true, numero: true, eventoNome: true, dataInicio: true, dataFim: true } },
      versoes: {
        orderBy: { numero: "desc" },
        select: { id: true, numero: true, criadoPor: true, createdAt: true },
      },
    },
  });
  if (!contrato) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(contrato);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { companyId, nome } = sessao;

  const { id } = await params;
  const body = await req.json();
  const existing = await prisma.contrato.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Conteúdo mudou? Cria uma NOVA versão — nunca sobrescreve as anteriores.
  const novoConteudo = body.conteudo != null ? String(body.conteudo) : existing.conteudo;
  const conteudoMudou =
    novoConteudo != null && novoConteudo.trim() !== (existing.conteudo || "").trim();
  const novaVersao = conteudoMudou ? existing.versaoAtual + 1 : existing.versaoAtual;

  const contrato = await prisma.contrato.update({
    where: { id },
    data: {
      titulo: body.titulo || existing.titulo,
      clienteId: body.clienteId || existing.clienteId,
      orcamentoId: body.orcamentoId || null,
      status: body.status || existing.status,
      conteudo: novoConteudo,
      versaoAtual: novaVersao,
      arquivoUrl: body.arquivoUrl || null,
      ...(conteudoMudou
        ? {
            versoes: {
              create: { numero: novaVersao, conteudo: novoConteudo || "", criadoPor: nome },
            },
          }
        : {}),
    },
  });
  return NextResponse.json({ ...contrato, novaVersaoCriada: conteudoMudou });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.contrato.findFirst({
    where: { id, companyId: sessao.companyId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contrato.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
