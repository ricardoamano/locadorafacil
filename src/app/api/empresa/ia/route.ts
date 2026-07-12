import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { INSTRUCOES_PROPOSTA_PADRAO } from "@/lib/ia";

// Configuração de IA da empresa — só admin

type SessionUser = { companyId?: string; role?: string };

async function getAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (u.role !== "ADMIN" || !u.companyId) return null;
  return u.companyId;
}

export async function GET() {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { iaApiKey: true, iaInstrucoes: true },
  });
  return NextResponse.json({
    configurado: Boolean(c?.iaApiKey),
    instrucoes: c?.iaInstrucoes || INSTRUCOES_PROPOSTA_PADRAO,
    instrucoesPadrao: INSTRUCOES_PROPOSTA_PADRAO,
  });
}

export async function POST(req: NextRequest) {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { chave, instrucoes } = body as { chave?: string; instrucoes?: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (chave === "REMOVER") data.iaApiKey = null;
  else if (chave?.trim()) data.iaApiKey = chave.trim();
  if (instrucoes !== undefined) {
    // texto igual ao padrão não é salvo (acompanha melhorias futuras do padrão)
    data.iaInstrucoes =
      instrucoes.trim() && instrucoes.trim() !== INSTRUCOES_PROPOSTA_PADRAO
        ? instrucoes.trim()
        : null;
  }

  await prisma.company.update({ where: { id: companyId }, data });
  return NextResponse.json({ success: true });
}
