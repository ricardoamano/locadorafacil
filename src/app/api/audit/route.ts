import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { moduloDaRota, ehSuperadmin, MODULOS } from "@/lib/modulos";

type SessUser = {
  id?: string;
  companyId?: string;
  name?: string | null;
  email?: string | null;
  role?: string;
};

// GET: lista de logs (só SUPERADMIN). POST: registra ACESSO a módulo (qualquer
// usuário logado), chamado pelo hook do cliente ao navegar.

export async function GET(req: NextRequest) {
  const session = await auth();
  const u = session?.user as SessUser | undefined;
  if (!u?.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ehSuperadmin(u.role))
    return NextResponse.json({ error: "Apenas superadmin" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") || "";
  const userId = searchParams.get("userId") || "";

  const logs = await prisma.auditLog.findMany({
    where: {
      companyId: u.companyId,
      ...(tipo ? { tipo } : {}),
      ...(userId ? { userId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const usuarios = await prisma.user.findMany({
    where: { companyId: u.companyId },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ logs, usuarios });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const u = session?.user as SessUser | undefined;
  if (!u?.companyId) return NextResponse.json({ ok: false });

  const body = await req.json().catch(() => ({}));
  const pathname = String(body.pathname || "");
  const modulo = moduloDaRota(pathname);
  if (!modulo) return NextResponse.json({ ok: true });

  // Dedupe: não repete o mesmo módulo/usuário nos últimos 10 minutos
  const recente = await prisma.auditLog.findFirst({
    where: {
      companyId: u.companyId,
      userId: u.id || undefined,
      tipo: "ACESSO",
      modulo,
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (recente) return NextResponse.json({ ok: true });

  const label = MODULOS.find((m) => m.key === modulo)?.label || modulo;
  await auditar(u, { tipo: "ACESSO", acao: `Acessou ${label}`, modulo });
  return NextResponse.json({ ok: true });
}
