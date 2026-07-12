import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Acessórios já vinculados a um item (exibidos no formulário de edição)

type SessionUser = { companyId?: string };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const links = await prisma.itemAcessorio.findMany({
    where: { itemBaseId: id, itemBase: { companyId } },
    include: { acessorio: { select: { nome: true, codigo: true } } },
  });
  return NextResponse.json({
    acessorios: links.map((l) => `${l.acessorio.nome} (${l.acessorio.codigo})`),
  });
}
