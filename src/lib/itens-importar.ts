import { prisma } from "@/lib/prisma";
import { clienteIa, extrairJson, MODELO_PROPOSTA } from "@/lib/ia";
import { calcularPrecos } from "@/lib/precos";
import { sincronizarUnidades } from "@/lib/unidades";
import { compararRegistros, type Decisao } from "@/lib/importar-revisao";

// Cadastro rápido de itens em lote — usado pela tela de importação (colar /
// planilha) e pelo assistente de WhatsApp ("cadastra 4 TVs 55 Samsung...").
// Item que já existe (mesmo nome + modelo) NÃO duplica: atualiza quantidade
// (e diária, se informada). Itens novos nascem marcados "a revisar".

export interface LinhaItem {
  codigo?: string;
  nome: string;
  marca: string;
  modelo: string;
  quantidade: number;
  valorAluguel: number;
  categoria: string;
}

export function normalizarLinha(raw: unknown): LinhaItem | null {
  const i = (raw || {}) as Record<string, unknown>;
  const nome = String(i.nome || "").trim().slice(0, 160);
  if (!nome) return null;
  return {
    codigo: i.codigo ? String(i.codigo).trim().slice(0, 20) : undefined,
    nome,
    marca: i.marca ? String(i.marca).trim().slice(0, 80) : "",
    modelo: i.modelo ? String(i.modelo).trim().slice(0, 80) : "",
    quantidade: Math.max(0, Math.round(Number(i.quantidade) || 0)),
    valorAluguel: Math.max(0, Number(i.valorAluguel) || 0),
    categoria: i.categoria ? String(i.categoria).trim().slice(0, 80) : "",
  };
}

/** IA transforma texto solto (lista colada ou mensagem de WhatsApp) em linhas. */
export async function analisarListaItens(
  companyId: string,
  texto: string
): Promise<{ itens: LinhaItem[]; erro?: string }> {
  const ia = await clienteIa(companyId);
  if (!ia) return { itens: [], erro: "IA da empresa não configurada." };

  const system = `Você organiza listas de inventário de uma locadora de equipamentos para eventos.

Receberá um texto solto (planilha, export de outro sistema, ou mensagem digitada às pressas). Transforme CADA item em uma linha estruturada.

Responda SOMENTE com JSON neste formato, sem comentários:
{"itens": [{"nome": string, "marca": string|null, "modelo": string|null, "quantidade": number, "valorAluguel": number, "categoria": string|null}]}

Regras:
- "nome": nome comercial curto, SEM marca/modelo embutidos quando der para separar (ex.: "TV 55 polegadas", não "TV 55 Samsung QN55"). Se não der para separar, mantenha inteiro.
- "marca" e "modelo": extraia quando aparecerem; senão null.
- "quantidade": inteiro; se não informado, 1.
- "valorAluguel": diária em número; se não informado, 0. Nunca invente preço.
- "categoria": Áudio, Vídeo, Iluminação, Informática, Estrutura, Energia, Mobiliário... quando óbvio; senão null.
- Uma linha por item. Não invente itens. Ignore cabeçalhos e linhas vazias.`;

  try {
    const res = await ia.messages.create(
      {
        model: MODELO_PROPOSTA,
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: texto.slice(0, 12000) }],
      },
      { timeout: 100_000, maxRetries: 1 }
    );
    const out = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n");
    const parsed = extrairJson(out) as { itens?: unknown[] } | null;
    const itens = (Array.isArray(parsed?.itens) ? parsed!.itens : [])
      .slice(0, 300)
      .map(normalizarLinha)
      .filter(Boolean) as LinhaItem[];
    return { itens };
  } catch (e) {
    return { itens: [], erro: e instanceof Error ? e.message : "Falha ao analisar." };
  }
}

export interface ResultadoImport {
  criados: { codigo: string; nome: string; quantidade: number }[];
  atualizados: { codigo: string; nome: string; de: number; para: number }[];
  mantidos: { codigo: string; nome: string }[];
}

/**
 * Compara as linhas com os itens existentes (chave: nome + modelo, ou código
 * quando informado) e separa novos / iguais / divergentes para revisão.
 */
export async function compararItens(companyId: string, linhas: LinhaItem[]) {
  const existentes = await prisma.item.findMany({
    where: { companyId },
    select: {
      id: true,
      codigo: true,
      nome: true,
      modelo: true,
      quantidade: true,
      valorAluguel: true,
      marca: { select: { nome: true } },
      categoria: { select: { nome: true } },
    },
  });
  const porCodigo = new Map(existentes.map((e) => [e.codigo, e]));
  return compararRegistros(linhas, existentes, {
    chaveNovo: (l) =>
      l.codigo && porCodigo.has(l.codigo) ? `cod:${l.codigo}` : chaveItem(l.nome, l.modelo),
    chaveExistente: (e) => chaveItem(e.nome, e.modelo),
    idExistente: (e) => e.id,
    resumoExistente: (e) =>
      `[${e.codigo}] ${e.nome}${e.modelo ? ` ${e.modelo}` : ""} · ${e.quantidade} un. · diária R$ ${e.valorAluguel}`,
    campos: [
      { campo: "quantidade", label: "Quantidade", novo: (l) => l.quantidade || null, atual: (e) => e.quantidade },
      { campo: "valorAluguel", label: "Diária (R$)", novo: (l) => l.valorAluguel || null, atual: (e) => e.valorAluguel || null },
      { campo: "marca", label: "Marca", novo: (l) => l.marca || null, atual: (e) => e.marca?.nome || null },
      { campo: "categoria", label: "Categoria", novo: (l) => l.categoria || null, atual: (e) => e.categoria?.nome || null },
    ],
  });
}

export function chaveDaLinha(l: LinhaItem): string {
  return chaveItem(l.nome, l.modelo);
}

function chaveItem(nome: string, modelo: string | null | undefined): string {
  return `${nome}|${modelo || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cria (ou atualiza, se já existir) cada linha. Marca/categoria por nome. */
export async function importarItens(
  companyId: string,
  linhas: LinhaItem[],
  decisoes: Record<string, Decisao> = {}
): Promise<ResultadoImport> {
  const empresa = await prisma.company.findUnique({ where: { id: companyId } });
  const precoCfg = {
    diasSemana: empresa?.diasSemana ?? 7,
    diasQuinzena: empresa?.diasQuinzena ?? 15,
    diasMes: empresa?.diasMes ?? 30,
    descontoSemana: empresa?.descontoSemana ?? 0,
    descontoQuinzena: empresa?.descontoQuinzena ?? 0,
    descontoMes: empresa?.descontoMes ?? 0,
  };

  const [marcas, categorias, existentes] = await Promise.all([
    prisma.marca.findMany({ where: { companyId }, select: { id: true, nome: true } }),
    prisma.categoria.findMany({ where: { companyId }, select: { id: true, nome: true } }),
    prisma.item.findMany({
      where: { companyId },
      select: { id: true, codigo: true, nome: true, modelo: true, quantidade: true },
    }),
  ]);
  const marcaPorNome = new Map(marcas.map((m) => [m.nome.toLowerCase(), m.id]));
  const catPorNome = new Map(categorias.map((c) => [c.nome.toLowerCase(), c.id]));
  const porChave = new Map(existentes.map((e) => [chaveItem(e.nome, e.modelo), e]));
  const codigosUsados = new Set(existentes.map((e) => e.codigo));

  let proximo = 0;
  for (const e of existentes) {
    const n = parseInt((e.codigo || "").replace(/\D/g, ""), 10);
    if (!isNaN(n) && n > proximo) proximo = n;
  }

  async function resolverMarca(nome: string) {
    if (!nome) return null;
    const k = nome.toLowerCase();
    if (marcaPorNome.has(k)) return marcaPorNome.get(k)!;
    const m = await prisma.marca.create({ data: { nome, companyId } });
    marcaPorNome.set(k, m.id);
    return m.id;
  }
  async function resolverCategoria(nome: string) {
    if (!nome) return null;
    const k = nome.toLowerCase();
    if (catPorNome.has(k)) return catPorNome.get(k)!;
    const c = await prisma.categoria.create({ data: { nome, tipo: "ITEM", companyId } });
    catPorNome.set(k, c.id);
    return c.id;
  }

  const resultado: ResultadoImport = { criados: [], atualizados: [], mantidos: [] };

  for (const l of linhas) {
    const chave = chaveItem(l.nome, l.modelo);
    const decisao = decisoes[chave] ?? (l.codigo ? decisoes[`cod:${l.codigo}`] : undefined);
    // Revisão: "criar" força um registro novo mesmo existindo igual
    const existente = decisao === "criar" ? undefined : porChave.get(chave);
    if (existente && decisao === "manter") {
      resultado.mantidos.push({ codigo: existente.codigo, nome: existente.nome });
      continue;
    }
    if (existente) {
      // Já existe → ajusta quantidade (e diária, se veio) sem duplicar
      const data: Record<string, unknown> = {};
      if (l.quantidade > 0 && l.quantidade !== existente.quantidade) data.quantidade = l.quantidade;
      if (l.valorAluguel > 0) {
        const calc = calcularPrecos(l.valorAluguel, precoCfg);
        Object.assign(data, {
          valorAluguel: l.valorAluguel,
          valorSemana: calc.valorSemana,
          valorQuinzena: calc.valorQuinzena,
          valorMes: calc.valorMes,
        });
      }
      if (Object.keys(data).length > 0) {
        await prisma.item.update({ where: { id: existente.id }, data });
        if (data.quantidade !== undefined) await sincronizarUnidades(existente.id);
      }
      resultado.atualizados.push({
        codigo: existente.codigo,
        nome: existente.nome,
        de: existente.quantidade,
        para: l.quantidade > 0 ? l.quantidade : existente.quantidade,
      });
      continue;
    }

    let codigo = l.codigo && !codigosUsados.has(l.codigo) ? l.codigo : "";
    if (!codigo) {
      do {
        proximo += 1;
        codigo = String(proximo).padStart(4, "0");
      } while (codigosUsados.has(codigo));
    }
    codigosUsados.add(codigo);

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
    porChave.set(chaveItem(l.nome, l.modelo), {
      id: item.id,
      codigo,
      nome: l.nome,
      modelo: l.modelo || null,
      quantidade: l.quantidade,
    });
    resultado.criados.push({ codigo, nome: l.nome, quantidade: l.quantidade });
  }

  return resultado;
}
