import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Conteúdo de uma versão específica do contrato (leitura/impressão).

type SessionUser = { companyId?: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; numero: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id, numero } = await params;
  const versao = await prisma.contratoVersao.findFirst({
    where: {
      contratoId: id,
      numero: Number(numero) || 0,
      contrato: { companyId },
    },
  });
  if (!versao) return NextResponse.json({ error: "Versão não encontrada" }, { status: 404 });
  return NextResponse.json(versao);
}
