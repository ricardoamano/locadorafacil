import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Lista as conversas de Ajuda do usuário atual (histórico, estilo ChatGPT).

type SessionUser = { id?: string; companyId?: string };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as SessionUser;
  if (!u.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const conversas = await prisma.ajudaConversa.findMany({
    where: { companyId: u.companyId, userId: u.id as string },
    select: { id: true, titulo: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ conversas });
}
