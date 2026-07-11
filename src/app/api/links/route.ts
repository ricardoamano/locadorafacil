import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const links = await prisma.link.findMany({
    where: { companyId },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json({ links });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.nome?.trim() || !body.url?.trim())
    return NextResponse.json({ error: "Nome e URL obrigatórios" }, { status: 400 });

  const link = await prisma.link.create({
    data: {
      nome: body.nome.trim(),
      url: body.url.trim(),
      observacao: body.observacao || null,
      companyId,
    },
  });
  return NextResponse.json(link, { status: 201 });
}
