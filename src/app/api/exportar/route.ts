import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Exportação CSV dos principais cadastros (clientes, fornecedores, ativos,
// kits, equipe, veículos) — abre no Excel/Google Sheets.

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

type Linha = Record<string, string | number | null | undefined>;

function csv(linhas: Linha[]): string {
  if (linhas.length === 0) return "Nenhum registro";
  const colunas = Object.keys(linhas[0]);
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    colunas.join(";"),
    ...linhas.map((l) => colunas.map((c) => esc(l[c])).join(";")),
  ].join("\r\n");
}

function num(v: number | null | undefined): string {
  return v == null ? "" : String(v).replace(".", ",");
}

export async function GET(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tipo = req.nextUrl.searchParams.get("tipo") || "";
  let linhas: Linha[] = [];

  if (tipo === "clientes" || tipo === "fornecedores") {
    const contacts = await prisma.contact.findMany({
      where: { companyId, type: tipo === "clientes" ? "CLIENTE" : "FORNECEDOR" },
      include: { subContacts: true },
      orderBy: { nomeFantasia: "asc" },
    });
    linhas = contacts.map((c) => ({
      "Nome Fantasia": c.nomeFantasia,
      "Razão Social": c.razaoSocial,
      CNPJ: c.cnpj,
      CEP: c.cep,
      Rua: c.rua,
      "Número": c.numero,
      Bairro: c.bairro,
      Complemento: c.complemento,
      Cidade: c.cidade,
      Estado: c.estado,
      Perfil: c.perfil,
      Contatos: c.subContacts
        .map((s) => [s.nome, s.telefone, s.email].filter(Boolean).join(" "))
        .join(" | "),
      "Criado em": c.createdAt.toLocaleDateString("pt-BR"),
    }));
  } else if (tipo === "itens") {
    const itens = await prisma.item.findMany({
      where: { companyId },
      include: {
        categoria: { select: { nome: true } },
        marca: { select: { nome: true } },
      },
      orderBy: { nome: "asc" },
    });
    linhas = itens.map((i) => ({
      "Código": i.codigo,
      Nome: i.nome,
      Apelidos: i.apelidos,
      Natureza: i.natureza === "SERVICO" ? "Serviço" : "Equipamento",
      Categoria: i.categoria?.nome,
      Marca: i.marca?.nome,
      Quantidade: i.quantidade,
      "Valor Diária (R$)": num(i.valorAluguel),
      "Valor Semana (R$)": num(i.valorSemana),
      "Valor Mês (R$)": num(i.valorMes),
      "Valor Reposição (R$)": num(i.valorReposicao),
      Watts: i.watts,
      kVA: num(i.kva),
      Cobrança: i.cobranca,
    }));
  } else if (tipo === "kits") {
    const kits = await prisma.kit.findMany({
      where: { companyId },
      include: { itens: { include: { item: { select: { nome: true, codigo: true } } } } },
      orderBy: { nome: "asc" },
    });
    linhas = kits.map((k) => ({
      Kit: k.nome,
      "Descrição": k.descricao,
      Itens: k.itens
        .map((ki) => `${ki.quantidade}x ${ki.item?.nome}${ki.item?.codigo ? ` (${ki.item.codigo})` : ""}`)
        .join(" | "),
      "Criado em": k.createdAt.toLocaleDateString("pt-BR"),
    }));
  } else if (tipo === "membros") {
    const membros = await prisma.membro.findMany({
      where: { companyId },
      include: { especialidades: { include: { especialidade: { select: { nome: true } } } } },
      orderBy: { nome: "asc" },
    });
    linhas = membros.map((m) => ({
      Nome: m.nome,
      Tipo: m.tipo,
      Telefone: m.telefone,
      "E-mail": m.email,
      RG: m.rg,
      CPF: m.cpf,
      PIX: m.pix,
      "Cachê (R$)": num(m.cache),
      Especialidades: m.especialidades.map((e) => e.especialidade?.nome).filter(Boolean).join(" | "),
    }));
  } else if (tipo === "veiculos") {
    const veiculos = await prisma.veiculo.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
    linhas = veiculos.map((v) => ({
      Placa: v.placa,
      Modelo: v.modelo,
      Ano: v.ano,
      Tipo: v.tipo,
      "Capacidade de carga": v.capacidadeCarga,
      "Cadastrado em": v.createdAt.toLocaleDateString("pt-BR"),
    }));
  } else {
    return NextResponse.json(
      { error: "tipo inválido — use clientes, fornecedores, itens, kits, membros ou veiculos" },
      { status: 400 }
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);
  // BOM para o Excel abrir acentos corretamente
  return new NextResponse("﻿" + csv(linhas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo}_${hoje}.csv"`,
    },
  });
}
