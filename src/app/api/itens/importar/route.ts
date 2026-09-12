import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calcularPrecos } from "@/lib/precos";
import { sincronizarUnidades } from "@/lib/unidades";
import { auditar } from "@/lib/auditoria";

// Importação em massa — passo 2: cria todos os itens revisados de uma vez.
// Marca/categoria são criadas pelo nome quando não existirem; código é gerado
// em sequência; os itens nascem com revisarCadastro=true para refino posterior.

export const maxDuration = 120;

type SessionUser = { companyId?: string };

interface LinhaImport {
  nome?: string;
  marca?: string;
  modelo?: string;
  quantidade?: number;
  valorAluguel?: number;
  categoria?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cidSessao = (session.user as SessionUser).companyId;
  if (!cidSessao) return NextResponse.json({ error: "No company" }, { status: 400 });
  const companyId: string = cidSessao;

  const body = await req.json().catch(() => ({}));
  const linhas: LinhaImport[] = Array.isArray(body?.itens) ? body.itens : [];
  const entradas = linhas
    .map((l) => ({
      nome: String(l.nome || "").trim().slice(0, 160),
      marca: String(l.marca || "").trim().slice(0, 80),
      modelo: String(l.modelo || "").trim().slice(0, 80),
      quantidade: Math.max(0, Math.round(Number(l.quantidade) || 0)),
      valorAluguel: Math.max(0, Number(l.valorAluguel) || 0),
      categoria: String(l.categoria || "").trim().slice(0, 80),
    }))
    .filter((l) => l.nome);
  if (entradas.length === 0)
    return NextResponse.json({ error: "Nenhum item para importar." }, { status: 400 });

  const empresa = await prisma.company.findUnique({ where: { id: companyId } });
  const precoCfg = {
    diasSemana: empresa?.diasSemana ?? 7,
    diasQuinzena: empresa?.diasQuinzena ?? 15,
    diasMes: empresa?.diasMes ?? 30,
    descontoSemana: empresa?.descontoSemana ?? 0,
    descontoQuinzena: empresa?.descontoQuinzena ?? 0,
    descontoMes: empresa?.descontoMes ?? 0,
  };

  // Caches de marca/categoria (cria o que faltar, reaproveita por nome)
  const marcas = await prisma.marca.findMany({ where: { companyId }, select: { id: true, nome: true } });
  const categorias = await prisma.categoria.findMany({
    where: { companyId },
    select: { id: true, nome: true },
  });
  const marcaPorNome = new Map(marcas.map((m) => [m.nome.toLowerCase(), m.id]));
  const catPorNome = new Map(categorias.map((c) => [c.nome.toLowerCase(), c.id]));

  async function resolverMarca(nome: string): Promise<string | null> {
    if (!nome) return null;
    const k = nome.toLowerCase();
    if (marcaPorNome.has(k)) return marcaPorNome.get(k)!;
    const m = await prisma.marca.create({ data: { nome, companyId } });
    marcaPorNome.set(k, m.id);
    return m.id;
  }
  async function resolverCategoria(nome: string): Promise<string | null> {
    if (!nome) return null;
    const k = nome.toLowerCase();
    if (catPorNome.has(k)) return catPorNome.get(k)!;
    const c = await prisma.categoria.create({ data: { nome, tipo: "ITEM", companyId } });
    catPorNome.set(k, c.id);
    return c.id;
  }

  // Próximo código sequencial (calculado uma vez e incrementado no lote)
  const todos = await prisma.item.findMany({ where: { companyId }, select: { codigo: true } });
  let proximo = 0;
  for (const i of todos) {
    const n = parseInt((i.codigo || "").replace(/\D/g, ""), 10);
    if (!isNaN(n) && n > proximo) proximo = n;
  }

  const criados: string[] = [];
  for (const l of entradas) {
    proximo += 1;
    const codigo = String(proximo).padStart(4, "0");
    const calc = calcularPrecos(l.valorAluguel, precoCfg);
    const item = await prisma.item.create({
      data: {
        codigo,
        nome: l.nome,
        modelo: l.modelo || null,
        marcaId: await resolverMarca(l.marca),
        categoriaId: await resolverCategoria(l.categoria),
        quantidade: l.quantidade,
        valorAluguel: l.valorAluguel,
        valorSemana: calc.valorSemana,
        valorQuinzena: calc.valorQuinzena,
        valorMes: calc.valorMes,
        natureza: "EQUIPAMENTO",
        tipo: "PROPRIO",
        emCatalogo: true,
        revisarCadastro: true,
        companyId,
      },
    });
    await sincronizarUnidades(item.id);
    criados.push(item.id);
  }

  await auditar(session.user as never, {
    tipo: "ALTERACAO",
    modulo: "ativos",
    acao: `Importou ${criados.length} item(ns) em massa`,
  });

  return NextResponse.json({ criados: criados.length });
}
