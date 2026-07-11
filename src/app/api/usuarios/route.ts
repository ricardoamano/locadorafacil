import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

type SessionUser = { companyId?: string };

async function getAdmin(sessionEmail: string, companyId: string) {
  return prisma.user.findFirst({
    where: { email: sessionEmail, companyId, role: "ADMIN", ativo: true },
    select: { id: true, isOwner: true },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const admin = await getAdmin(session.user.email as string, companyId);
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const usuarios = await prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isOwner: true,
      ativo: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ usuarios });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const admin = await getAdmin(session.user.email as string, companyId);
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  if (!body.email?.trim() || !body.password || !body.name?.trim())
    return NextResponse.json({ error: "Nome, e-mail e senha obrigatórios" }, { status: 400 });
  if (String(body.password).length < 6)
    return NextResponse.json({ error: "Senha deve ter ao menos 6 caracteres" }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email: body.email.trim() } });
  if (exists) return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 400 });

  const hashed = await bcrypt.hash(body.password, 10);
  const usuario = await prisma.user.create({
    data: {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      password: hashed,
      role: body.role === "ADMIN" ? "ADMIN" : "USER",
      ativo: true,
      companyId,
    },
    select: { id: true, name: true, email: true, role: true, ativo: true },
  });
  return NextResponse.json(usuario, { status: 201 });
}
