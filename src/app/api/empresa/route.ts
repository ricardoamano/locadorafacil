import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/utils";

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

  // Slug do catálogo público: sempre derivado do nome da empresa (automático)
  let slugFinal: string | undefined = undefined;
  if (b.name?.trim()) {
    const base = slugify(b.name.trim());
    if (base) {
      slugFinal = base;
      let n = 1;
      while (
        await prisma.company.findFirst({
          where: { slug: slugFinal, NOT: { id: user.companyId } },
          select: { id: true },
        })
      ) {
        n += 1;
        slugFinal = `${base}-${n}`;
      }
    }
  }

  const empresa = await prisma.company.update({
    where: { id: user.companyId },
    data: {
      name: b.name || undefined,
      ...(slugFinal ? { slug: slugFinal } : {}),
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
      ...(b.diasSemana !== undefined ? { diasSemana: Number(b.diasSemana) || 7 } : {}),
      ...(b.diasQuinzena !== undefined ? { diasQuinzena: Number(b.diasQuinzena) || 15 } : {}),
      ...(b.diasMes !== undefined ? { diasMes: Number(b.diasMes) || 30 } : {}),
      ...(b.descontoSemana !== undefined ? { descontoSemana: Number(b.descontoSemana) || 0 } : {}),
      ...(b.descontoQuinzena !== undefined ? { descontoQuinzena: Number(b.descontoQuinzena) || 0 } : {}),
      ...(b.descontoMes !== undefined ? { descontoMes: Number(b.descontoMes) || 0 } : {}),
      ...(b.permitirPrecoManual !== undefined ? { permitirPrecoManual: !!b.permitirPrecoManual } : {}),
      // Numeração inicial (onboarding/migração) — vazio limpa (null = começa do 1)
      ...(b.orcamentoNumeroInicial !== undefined
        ? {
            orcamentoNumeroInicial:
              b.orcamentoNumeroInicial === "" || b.orcamentoNumeroInicial == null
                ? null
                : Math.max(1, Number(b.orcamentoNumeroInicial) || 1),
          }
        : {}),
      ...(b.faturaNumeroInicial !== undefined
        ? {
            faturaNumeroInicial:
              b.faturaNumeroInicial === "" || b.faturaNumeroInicial == null
                ? null
                : Math.max(1, Number(b.faturaNumeroInicial) || 1),
          }
        : {}),
    },
  });
  return NextResponse.json(empresa);
}
