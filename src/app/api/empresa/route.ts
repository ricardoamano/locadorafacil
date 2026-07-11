import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string; role?: string };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const empresa = await prisma.company.findUnique({ where: { id: companyId } });
  if (!empresa) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(empresa);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  // Somente ADMIN altera dados da empresa (validação backend)
  const dbUser = await prisma.user.findFirst({
    where: { email: session.user.email as string, companyId: user.companyId },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const b = await req.json();
  const empresa = await prisma.company.update({
    where: { id: user.companyId },
    data: {
      name: b.name || undefined,
      razaoSocial: b.razaoSocial ?? null,
      cnpj: b.cnpj ?? null,
      inscricaoEstadual: b.inscricaoEstadual ?? null,
      inscricaoMunicipal: b.inscricaoMunicipal ?? null,
      cep: b.cep ?? null,
      rua: b.rua ?? null,
      numero: b.numero ?? null,
      bairro: b.bairro ?? null,
      complemento: b.complemento ?? null,
      cidade: b.cidade ?? null,
      estado: b.estado ?? null,
      telefone: b.telefone ?? null,
      email: b.email ?? null,
      site: b.site ?? null,
      logoUrl: b.logoUrl ?? null,
      banco: b.banco ?? null,
      agencia: b.agencia ?? null,
      conta: b.conta ?? null,
      pix: b.pix ?? null,
      responsavel: b.responsavel ?? null,
      naturezaOperacao: b.naturezaOperacao ?? null,
      observacaoFatura: b.observacaoFatura ?? null,
    },
  });
  return NextResponse.json(empresa);
}
