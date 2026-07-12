import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string; role?: string };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (!u.companyId) return null;
  return u;
}

// Link de integração da agenda da empresa (Google Agenda, Outlook, Apple)
export async function GET() {
  const u = await getSessao();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const empresa = await prisma.company.findUnique({
    where: { id: u.companyId },
    select: { icsToken: true },
  });
  return NextResponse.json({
    url: empresa?.icsToken ? `/api/ics/${empresa.icsToken}` : null,
  });
}

// Gera (ou regenera, invalidando o anterior) o token da empresa — ADMIN
export async function POST() {
  const u = await getSessao();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (u.role !== "ADMIN")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const token = randomUUID().replace(/-/g, "");
  await prisma.company.update({
    where: { id: u.companyId },
    data: { icsToken: token },
  });
  return NextResponse.json({ url: `/api/ics/${token}` });
}

// Revoga o link (desativa a integração) — ADMIN
export async function DELETE() {
  const u = await getSessao();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (u.role !== "ADMIN")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await prisma.company.update({
    where: { id: u.companyId },
    data: { icsToken: null },
  });
  return NextResponse.json({ success: true });
}
