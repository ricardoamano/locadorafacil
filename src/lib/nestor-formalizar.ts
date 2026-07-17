import { prisma } from "@/lib/prisma";
import { clienteIa, extrairJson, MODELO_PROPOSTA } from "@/lib/ia";
import type { MensagemChat } from "@/lib/nestor-orcamento";

// Formalização do orçamento rápido: transforma a conversa com o assistente em
// um Orcamento de verdade no sistema (numeração oficial, sala e itens do
// catálogo), pronto para editar/imprimir no módulo Orçamentos.

interface ItemExtraido {
  codigo?: string;
  quantidade?: number;
  diarias?: number;
  valorUnitario?: number;
}

interface Extracao {
  eventoNome?: string;
  clienteNome?: string;
  dataInicio?: string;
  dataFim?: string;
  observacoes?: string;
  itens?: ItemExtraido[];
}

export type ResultadoFormalizar =
  | { ok: true; id: string; numero: number; total: number; qtdItens: number; avisos: string[] }
  | { ok: false; erro: string };

/** Pede à IA a estrutura final do orçamento discutido na conversa. */
async function extrairEstrutura(
  companyId: string,
  conversa: MensagemChat[]
): Promise<Extracao | null> {
  const ia = await clienteIa(companyId);
  if (!ia) return null;

  const itens = await prisma.item.findMany({
    where: { companyId, acessoriosVinc: { none: {} } },
    select: { codigo: true, nome: true, valorAluguel: true },
    orderBy: { nome: "asc" },
    take: 500,
  });
  const catalogo = itens
    .map((i) => `${i.codigo} = ${i.nome} (diária R$ ${i.valorAluguel})`)
    .join("\n");

  const system = `Você extrai a versão FINAL do orçamento discutido em uma conversa (o último estado, com todos os ajustes pedidos).

Responda SOMENTE com um JSON neste formato, sem comentários:
{"eventoNome": string|null, "clienteNome": string|null, "dataInicio": "YYYY-MM-DD"|null, "dataFim": "YYYY-MM-DD"|null, "observacoes": string|null, "itens": [{"codigo": string, "quantidade": number, "diarias": number, "valorUnitario": number}]}

Regras:
- Use APENAS códigos existentes no catálogo abaixo. Item pedido que não existe no catálogo: não invente — deixe fora e cite em "observacoes".
- valorUnitario = valor da diária usado na conversa (se houve desconto/ajuste, use o ajustado; senão o do catálogo).
- clienteNome/eventoNome/datas: só se apareceram na conversa; senão null.

CATÁLOGO (código = nome):
${catalogo}`;

  try {
    const res = await ia.messages.create(
      {
        model: MODELO_PROPOSTA,
        max_tokens: 1500,
        system,
        messages: [
          {
            role: "user",
            content: `Conversa:\n\n${conversa
              .map((m) => `${m.role === "user" ? "CLIENTE INTERNO" : "ASSISTENTE"}: ${m.content}`)
              .join("\n\n")}\n\nExtraia o orçamento final em JSON.`,
          },
        ],
      },
      { timeout: 60_000, maxRetries: 1 }
    );
    const texto = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n");
    return (extrairJson(texto) as Extracao) || null;
  } catch {
    return null;
  }
}

/** Acha o cliente pelo nome ou usa/cria o cliente genérico "A definir". */
async function resolverCliente(companyId: string, nome: string | null | undefined) {
  const buscado = nome?.trim();
  if (buscado) {
    const achado = await prisma.contact.findFirst({
      where: {
        companyId,
        type: "CLIENTE",
        OR: [
          { nomeFantasia: { contains: buscado, mode: "insensitive" } },
          { razaoSocial: { contains: buscado, mode: "insensitive" } },
        ],
      },
      select: { id: true, nomeFantasia: true },
    });
    if (achado) return { ...achado, criado: false };
    const novo = await prisma.contact.create({
      data: { companyId, type: "CLIENTE", razaoSocial: buscado, nomeFantasia: buscado },
      select: { id: true, nomeFantasia: true },
    });
    return { ...novo, criado: true };
  }
  const generico = await prisma.contact.findFirst({
    where: { companyId, type: "CLIENTE", nomeFantasia: "Cliente a definir" },
    select: { id: true, nomeFantasia: true },
  });
  if (generico) return { ...generico, criado: false };
  const novo = await prisma.contact.create({
    data: {
      companyId,
      type: "CLIENTE",
      razaoSocial: "Cliente a definir",
      nomeFantasia: "Cliente a definir",
    },
    select: { id: true, nomeFantasia: true },
  });
  return { ...novo, criado: true };
}

export async function formalizarOrcamento(
  companyId: string,
  conversa: MensagemChat[],
  criadoVia: string
): Promise<ResultadoFormalizar> {
  if (conversa.length === 0) return { ok: false, erro: "Ainda não há conversa para formalizar." };

  const ext = await extrairEstrutura(companyId, conversa);
  if (!ext || !Array.isArray(ext.itens) || ext.itens.length === 0)
    return {
      ok: false,
      erro: "Não consegui identificar os itens do orçamento na conversa. Monte o orçamento primeiro e depois peça para formalizar.",
    };

  const avisos: string[] = [];

  // Resolve os itens pelo código no catálogo
  const codigos = ext.itens.map((i) => i.codigo).filter(Boolean) as string[];
  const doBanco = await prisma.item.findMany({
    where: { companyId, codigo: { in: codigos } },
    select: { id: true, codigo: true, nome: true, valorAluguel: true },
  });
  const porCodigo = new Map(doBanco.map((i) => [i.codigo, i]));

  const linhas = ext.itens
    .map((i) => {
      const item = i.codigo ? porCodigo.get(i.codigo) : undefined;
      if (!item) {
        if (i.codigo) avisos.push(`Item de código "${i.codigo}" não encontrado — ficou fora.`);
        return null;
      }
      const quantidade = Math.max(1, Math.round(Number(i.quantidade) || 1));
      const diarias = Math.max(1, Math.round(Number(i.diarias) || 1));
      const valorUnitario =
        Number(i.valorUnitario) > 0 ? Number(i.valorUnitario) : item.valorAluguel;
      return {
        itemId: item.id,
        quantidade,
        diarias,
        valorUnitario,
        subtotal: quantidade * diarias * valorUnitario,
      };
    })
    .filter(Boolean) as {
    itemId: string;
    quantidade: number;
    diarias: number;
    valorUnitario: number;
    subtotal: number;
  }[];

  if (linhas.length === 0)
    return { ok: false, erro: "Nenhum item da conversa foi encontrado no catálogo." };

  const cliente = await resolverCliente(companyId, ext.clienteNome);
  if (cliente.criado) avisos.push(`Cliente "${cliente.nomeFantasia}" foi criado — complete o cadastro depois.`);
  else if (!ext.clienteNome) avisos.push(`Sem cliente na conversa — usei "${cliente.nomeFantasia}".`);

  const total = linhas.reduce((a, l) => a + l.subtotal, 0);

  // Numeração oficial (mesma regra do módulo de orçamentos)
  const [last, empresaNum] = await Promise.all([
    prisma.orcamento.findFirst({
      where: { companyId },
      orderBy: { numero: "desc" },
      select: { numero: true },
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { orcamentoNumeroInicial: true },
    }),
  ]);
  const numero = Math.max((last?.numero || 0) + 1, empresaNum?.orcamentoNumeroInicial || 1);

  const parseData = (s?: string) => {
    if (!s) return null;
    const d = new Date(`${s}T12:00:00`);
    return isNaN(d.getTime()) ? null : d;
  };

  const orc = await prisma.orcamento.create({
    data: {
      numero,
      clienteId: cliente.id,
      status: "PENDENTE",
      eventoNome: ext.eventoNome?.trim() || null,
      dataInicio: parseData(ext.dataInicio),
      dataFim: parseData(ext.dataFim),
      observacoes: ext.observacoes?.trim() || null,
      obsInternas: `Gerado pelo orçamento rápido (${criadoVia}).`,
      total,
      companyId,
      salas: {
        create: [{ nome: ext.eventoNome?.trim() || "Itens", itens: { create: linhas } }],
      },
    },
    select: { id: true, numero: true, total: true },
  });

  return { ok: true, id: orc.id, numero: orc.numero, total: orc.total, qtdItens: linhas.length, avisos };
}
