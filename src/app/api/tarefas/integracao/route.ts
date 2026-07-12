import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Link individual de tarefas do usuário logado (cada usuário gerencia o seu)

async function getUsuario() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, tarefasIcsToken: true },
  });
}

export async function GET() {
  const u = await getUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    url: u.tarefasIcsToken ? `/api/ics-tarefas/${u.tarefasIcsToken}` : null,
  });
}

export async function POST() {
  const u = await getUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = randomUUID().replace(/-/g, "");
  await prisma.user.update({ where: { id: u.id }, data: { tarefasIcsToken: token } });
  return NextResponse.json({ url: `/api/ics-tarefas/${token}` });
}

export async function DELETE() {
  const u = await getUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({ where: { id: u.id }, data: { tarefasIcsToken: null } });
  return NextResponse.json({ success: true });
}
