import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { configOsPublica, SECOES_OS_PUBLICA } from "@/lib/os-publica";

// Configuração das seções visíveis na OS pública — só admin

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
    select: { osPublicaConfig: true },
  });
  return NextResponse.json({
    config: configOsPublica(c?.osPublicaConfig),
    secoes: SECOES_OS_PUBLICA,
  });
}

export async function POST(req: NextRequest) {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const recebido = (body.config || {}) as Record<string, unknown>;
  const config: Record<string, boolean> = {};
  for (const s of SECOES_OS_PUBLICA) {
    config[s.key] = Boolean(recebido[s.key]);
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { osPublicaConfig: config },
  });
  return NextResponse.json({ success: true, config });
}
