import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Lista simples (id + nome) dos usuários ativos da empresa — para atribuir
// tarefas, follow-ups etc. Disponível para qualquer usuário logado.

type SessionUser = { companyId?: string };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const usuarios = await prisma.user.findMany({
    where: { companyId, ativo: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ usuarios });
}
