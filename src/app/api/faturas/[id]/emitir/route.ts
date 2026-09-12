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
    include: { cliente: true, orcamento: { select: { numero: true } }, emissora: true },
  });
  if (!fatura) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (fatura.snapshot) {
    return NextResponse.json({
      emitida: true,
      emitidaEm: fatura.emitidaEm,
      dados: fatura.snapshot,
    });
  }

  const [empresa, conta] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.contaBancaria.findFirst({ where: { companyId }, orderBy: { ordem: "asc" } }),
  ]);
  return NextResponse.json({
    emitida: false,
    dados: buildDados(fatura, empresa, conta),
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
    include: { cliente: true, orcamento: { select: { numero: true } }, emissora: true },
  });
  if (!fatura) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (fatura.snapshot) {
    return NextResponse.json({
      emitida: true,
      emitidaEm: fatura.emitidaEm,
      dados: fatura.snapshot,
    });
  }

  const [empresa, conta] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.contaBancaria.findFirst({ where: { companyId }, orderBy: { ordem: "asc" } }),
  ]);
  const dados = buildDados(fatura, empresa, conta);

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

/**
 * Linhas do bloco "DADOS PARA PAGAMENTO" no padrão do recibo oficial:
 * Banco X (cod) / Agência / Conta Corrente N / PIX (E-mail): chave
 */
function linhasPagamento(src: {
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  tipoConta?: string | null;
  pix?: string | null;
  pixTipo?: string | null;
}): string[] {
  const l: string[] = [];
  if (src.banco?.trim()) l.push(`Banco ${src.banco.trim()}`);
  if (src.agencia?.trim()) l.push(`Agência ${src.agencia.trim()}`);
  if (src.conta?.trim()) l.push(`Conta ${src.tipoConta?.trim() || "Corrente"} ${src.conta.trim()}`);
  if (src.pix?.trim()) {
    const tipo = src.pixTipo?.trim() || (src.pix.includes("@") ? "E-mail" : "");
    l.push(`PIX${tipo ? ` (${tipo})` : ""}: ${src.pix.trim()}`);
  }
  return l;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function buildDados(fatura: any, empresaPrincipal: any, contaPrincipal?: any) {
  // Fatura por outro CNPJ do grupo: a empresa emissora assina o documento
  // (razão social, CNPJ, endereço, logo e dados bancários dela)
  const em = fatura.emissora;
  const empresa = em
    ? {
        name: em.nome,
        razaoSocial: em.razaoSocial || em.nome,
        cnpj: em.cnpj,
        rua: em.rua,
        numero: em.numero,
        bairro: em.bairro,
        cidade: em.cidade,
        estado: em.estado,
        cep: em.cep,
        logoUrl: em.logoUrl,
        naturezaOperacao: em.naturezaOperacao,
        banco: em.banco,
        agencia: em.agencia,
        conta: em.conta,
        pix: em.pix,
        observacaoFatura: em.observacaoFatura,
      }
    : empresaPrincipal;

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
      // Emissora usa os próprios dados; principal usa a 1ª conta cadastrada
      // (Configurações → Empresa → Contas bancárias), com tipo de conta e de PIX
      pagamento: em
        ? linhasPagamento(em)
        : linhasPagamento(
            contaPrincipal || {
              banco: empresa?.banco,
              agencia: empresa?.agencia,
              conta: empresa?.conta,
              pix: empresa?.pix,
            }
          ),
      observacao: (empresa?.observacaoFatura || "").trim(),
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
