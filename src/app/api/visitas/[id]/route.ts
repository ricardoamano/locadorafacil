import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessUser = { companyId?: string; name?: string | null; email?: string | null };

async function getSessao() {
  const session = await auth();
  const u = session?.user as SessUser | undefined;
  if (!u?.companyId) return null;
  return { companyId: u.companyId, nome: u.name || u.email || "—" };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visita = await prisma.visitaTecnica.findFirst({
    where: { id, companyId: sessao.companyId },
    include: {
      midias: { orderBy: [{ ordem: "asc" }, { createdAt: "asc" }] },
      comentarios: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!visita) return NextResponse.json({ error: "Visita não encontrada" }, { status: 404 });
  return NextResponse.json(visita);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existe = await prisma.visitaTecnica.findFirst({
    where: { id, companyId: sessao.companyId },
    select: { id: true },
  });
  if (!existe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (body.titulo !== undefined) data.titulo = String(body.titulo).trim() || "Visita técnica";
  if (body.localNome !== undefined) data.localNome = String(body.localNome).trim() || null;
  if (body.observacoes !== undefined) data.observacoes = String(body.observacoes) || null;
  if (body.data !== undefined) data.data = body.data ? new Date(body.data) : null;

  const visita = await prisma.visitaTecnica.update({ where: { id }, data });
  return NextResponse.json(visita);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existe = await prisma.visitaTecnica.findFirst({
    where: { id, companyId: sessao.companyId },
    select: { id: true },
  });
  if (!existe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.visitaTecnica.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
