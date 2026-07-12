import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

// Cadastro rápido de contato (pessoa) dentro de um cliente/fornecedor
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const contact = await prisma.contact.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!contact) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const body = await req.json();
  if (!body.nome?.trim())
    return NextResponse.json({ error: "Nome do contato é obrigatório" }, { status: 400 });
  if (body.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))
    return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });

  const sub = await prisma.subContact.create({
    data: {
      contactId: id,
      nome: body.nome.trim(),
      cargo: body.cargo?.trim() || null,
      telefone: body.telefone?.trim() || null,
      email: body.email?.trim() || null,
    },
  });
  return NextResponse.json(sub, { status: 201 });
}
