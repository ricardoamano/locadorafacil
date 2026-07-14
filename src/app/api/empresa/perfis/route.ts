import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { ehSuperadmin } from "@/lib/modulos";
import { normalizarPerfis, MODULOS_ADMIN } from "@/lib/perfis";

type SessUser = {
  id?: string;
  companyId?: string;
  name?: string | null;
  email?: string | null;
  role?: string;
};

export async function GET() {
  const session = await auth();
  const u = session?.user as SessUser | undefined;
  if (!u?.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await prisma.company.findUnique({
    where: { id: u.companyId },
    select: { perfisConfig: true },
  });
  return NextResponse.json({
    config: normalizarPerfis(c?.perfisConfig),
    modulosAdmin: MODULOS_ADMIN,
    podeEditar: ehSuperadmin(u.role),
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  const u = session?.user as SessUser | undefined;
  if (!u?.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ehSuperadmin(u.role))
    return NextResponse.json({ error: "Apenas o superadmin pode alterar perfis" }, { status: 403 });

  const body = await req.json();
  // Normaliza a partir do que o cliente mandou (rótulos + módulos do ADMIN)
  const config = normalizarPerfis(body);

  await prisma.company.update({
    where: { id: u.companyId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { perfisConfig: config as any },
  });
  await auditar(u, {
    tipo: "ALTERACAO",
    modulo: "configuracoes",
    acao: "Editou perfis e acessos",
  });
  return NextResponse.json({ ok: true, config });
}
