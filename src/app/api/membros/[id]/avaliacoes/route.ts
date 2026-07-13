import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Feedback/avaliação de membros (freelancers): critérios 1-5 + comentário.

type SessionUser = { companyId?: string; name?: string | null };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId ? { companyId: u.companyId, nome: u.name || null } : null;
}

function notaValida(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membro = await prisma.membro.findFirst({
    where: { id, companyId: sessao.companyId },
    select: { id: true },
  });
  if (!membro) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const avaliacoes = await prisma.avaliacao.findMany({
    where: { membroId: id },
    orderBy: { createdAt: "desc" },
  });
  const media =
    avaliacoes.length > 0
      ? avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length
      : null;
  return NextResponse.json({ avaliacoes, media, total: avaliacoes.length });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membro = await prisma.membro.findFirst({
    where: { id, companyId: sessao.companyId },
    select: { id: true },
  });
  if (!membro) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const nota = notaValida(body.nota);
  if (!nota) return NextResponse.json({ error: "Nota geral (1 a 5) obrigatória" }, { status: 400 });

  const avaliacao = await prisma.avaliacao.create({
    data: {
      membroId: id,
      nota,
      postura: notaValida(body.postura),
      tecnica: notaValida(body.tecnica),
      pontualidade: notaValida(body.pontualidade),
      proatividade: notaValida(body.proatividade),
      comentario: body.comentario?.trim() || null,
      evento: body.evento?.trim() || null,
      autor: sessao.nome,
    },
  });
  return NextResponse.json(avaliacao, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const avaliacaoId = req.nextUrl.searchParams.get("avaliacaoId") || "";
  const avaliacao = await prisma.avaliacao.findFirst({
    where: { id: avaliacaoId, membroId: id, membro: { companyId: sessao.companyId } },
    select: { id: true },
  });
  if (!avaliacao) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.avaliacao.delete({ where: { id: avaliacaoId } });
  return NextResponse.json({ success: true });
}
