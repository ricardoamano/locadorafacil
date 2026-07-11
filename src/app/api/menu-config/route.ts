import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { TODAS_CHAVES } from "@/lib/modulos";

const CHAVES_MENU = [...TODAS_CHAVES, "cadastros"];

type SessionUser = { companyId?: string; role?: string };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { menuConfig: true },
  });
  return NextResponse.json({ menuConfig: empresa?.menuConfig ?? null });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as SessionUser;
  if (!u.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });
  if (u.role !== "ADMIN")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();

  // null = restaurar padrão
  if (body.menuConfig === null) {
    await prisma.company.update({
      where: { id: u.companyId },
      data: { menuConfig: Prisma.DbNull },
    });
    return NextResponse.json({ menuConfig: null });
  }

  const itens = Array.isArray(body.menuConfig?.itens) ? body.menuConfig.itens : [];
  // Sanitiza: só chaves conhecidas, rótulos de texto, hidden booleano
  const saneados = itens
    .filter((i: { key?: string }) => i?.key && CHAVES_MENU.includes(i.key))
    .map((i: { key: string; label?: string; hidden?: boolean }) => ({
      key: i.key,
      label: typeof i.label === "string" ? i.label.slice(0, 40) : undefined,
      hidden: !!i.hidden,
    }));

  // Proteção: Configurações nunca pode ficar oculta (admin não perde acesso)
  const cfg = saneados.map((i: { key: string; hidden: boolean }) =>
    i.key === "configuracoes" ? { ...i, hidden: false } : i
  );

  const empresa = await prisma.company.update({
    where: { id: u.companyId },
    data: { menuConfig: { itens: cfg } },
    select: { menuConfig: true },
  });
  return NextResponse.json({ menuConfig: empresa.menuConfig });
}
