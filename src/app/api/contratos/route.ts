import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const contratos = await prisma.contrato.findMany({
    where: { companyId },
    include: {
      cliente: { select: { id: true, nomeFantasia: true } },
      orcamento: { select: { id: true, numero: true, total: true } },
      versoes: {
        orderBy: { numero: "desc" },
        select: { numero: true, criadoPor: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ contratos });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.titulo?.trim() || !body.clienteId)
    return NextResponse.json({ error: "Título e cliente obrigatórios" }, { status: 400 });

  const usuario = session.user.name || session.user.email || null;
  const contrato = await prisma.contrato.create({
    data: {
      titulo: body.titulo.trim(),
      clienteId: body.clienteId,
      orcamentoId: body.orcamentoId || null,
      status: body.status || "RASCUNHO",
      conteudo: body.conteudo || null,
      versaoAtual: 1,
      arquivoUrl: body.arquivoUrl || null,
      companyId,
      ...(body.conteudo
        ? { versoes: { create: { numero: 1, conteudo: body.conteudo, criadoPor: usuario } } }
        : {}),
    },
  });
  return NextResponse.json(contrato, { status: 201 });
}
