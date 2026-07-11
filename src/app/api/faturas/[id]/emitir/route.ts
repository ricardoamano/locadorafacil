import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

// GET: dados para impressão — usa o snapshot imutável se a fatura já foi emitida
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const fatura = await prisma.fatura.findFirst({
    where: { id, companyId },
    include: { cliente: true, orcamento: { select: { numero: true } } },
  });
  if (!fatura) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (fatura.snapshot) {
    return NextResponse.json({
      emitida: true,
      emitidaEm: fatura.emitidaEm,
      dados: fatura.snapshot,
    });
  }

  const empresa = await prisma.company.findUnique({ where: { id: companyId } });
  return NextResponse.json({
    emitida: false,
    dados: buildDados(fatura, empresa),
  });
}

// POST: emite a fatura — congela o snapshot (idempotente; nunca sobrescreve)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const fatura = await prisma.fatura.findFirst({
    where: { id, companyId },
    include: { cliente: true, orcamento: { select: { numero: true } } },
  });
  if (!fatura) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (fatura.snapshot) {
    return NextResponse.json({
      emitida: true,
      emitidaEm: fatura.emitidaEm,
      dados: fatura.snapshot,
    });
  }

  const empresa = await prisma.company.findUnique({ where: { id: companyId } });
  const dados = buildDados(fatura, empresa);

  const updated = await prisma.fatura.update({
    where: { id },
    data: {
      snapshot: dados,
      emitidaEm: new Date(),
      emitidaPor: session.user.email || session.user.name || "desconhecido",
    },
  });

  return NextResponse.json({ emitida: true, emitidaEm: updated.emitidaEm, dados });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function buildDados(fatura: any, empresa: any) {
  const enderecoEmpresa = [
    empresa?.rua && `${empresa.rua}${empresa.numero ? `, ${empresa.numero}` : ""}`,
    empresa?.bairro,
  ]
    .filter(Boolean)
    .join(", ");
  const cidadeEmpresa = [empresa?.cidade, empresa?.estado].filter(Boolean).join(", ");

  const c = fatura.cliente;
  return {
    numero: fatura.numero,
    dataEmissao: fatura.dataEmissao,
    dataVencimento: fatura.dataVencimento,
    valor: fatura.valor,
    descritivo: fatura.descritivo || "",
    mesRef: fatura.mesRef || "",
    isPostoServico: fatura.isPostoServico,
    orcamentoNumero: fatura.orcamento?.numero ?? null,
    empresa: {
      nome: empresa?.name || "",
      razaoSocial: empresa?.razaoSocial || empresa?.name || "",
      cnpj: empresa?.cnpj || "",
      endereco: enderecoEmpresa,
      cidade: cidadeEmpresa,
      cep: empresa?.cep || "",
      logoUrl: empresa?.logoUrl || "",
      naturezaOperacao: empresa?.naturezaOperacao || "LOCAÇÃO DE BENS MÓVEIS",
      banco: empresa?.banco || "",
      agencia: empresa?.agencia || "",
      conta: empresa?.conta || "",
      pix: empresa?.pix || "",
      observacao: empresa?.observacaoFatura || "",
    },
    destinatario: {
      razaoSocial: c?.razaoSocial || fatura.clienteNome,
      cnpj: c?.cnpj || "",
      endereco: c
        ? [c.rua && `${c.rua}${c.numero ? `, ${c.numero}` : ""}`, c.complemento]
            .filter(Boolean)
            .join(" ")
        : "",
      bairro: c?.bairro || "",
      municipio: c?.cidade || "",
      estado: c?.estado || "",
      cep: c?.cep || "",
      inscricaoEstadual: c?.inscricaoEstadual || "",
      inscricaoMunicipal: c?.inscricaoMunicipal || "",
    },
  };
}
