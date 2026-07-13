import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { id?: string; companyId?: string };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId ? { companyId: u.companyId, userId: u.id as string } : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const conversa = await prisma.ajudaConversa.findFirst({
    where: { id, companyId: sessao.companyId, userId: sessao.userId },
    select: { id: true, titulo: true, mensagens: true },
  });
  if (!conversa) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(conversa);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const dono = await prisma.ajudaConversa.findFirst({
    where: { id, companyId: sessao.companyId, userId: sessao.userId },
    select: { id: true },
  });
  if (!dono) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.ajudaConversa.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
