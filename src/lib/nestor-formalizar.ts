import { prisma } from "@/lib/prisma";
import { clienteIa, extrairJson, MODELO_PROPOSTA } from "@/lib/ia";
import { conversaDesdeReset, type MensagemChat } from "@/lib/nestor-orcamento";

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
  dataMontagem?: string;
  dataInicio?: string;
  dataFim?: string;
  observacoes?: string;
  itens?: ItemExtraido[];
}

export type ResultadoFormalizar =
  | { ok: true; id: string; numero: number; total: number; qtdItens: number; avisos: string[] }
  | { ok: false; pendente: true; texto: string }
  | { ok: false; pendente?: false; erro: string };

/** Frase-marca do questionário — identifica que a próxima resposta completa os dados. */
export const MARCA_PERGUNTAS = "Antes de criar o orçamento oficial";

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
{"eventoNome": string|null, "clienteNome": string|null, "dataMontagem": "YYYY-MM-DD"|null, "dataInicio": "YYYY-MM-DD"|null, "dataFim": "YYYY-MM-DD"|null, "observacoes": string|null, "itens": [{"codigo": string, "quantidade": number, "diarias": number, "valorUnitario": number}]}

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

/** Monta o questionário dos dados que faltam (uma rodada só, antes de criar). */
async function perguntasPendentes(companyId: string, ext: Extracao): Promise<string | null> {
  const perguntas: string[] = [];

  const nomeCliente = ext.clienteNome?.trim();
  if (!nomeCliente) {
    perguntas.push("👤 *Cliente:* quem é o cliente? (nome da empresa ou pessoa)");
  } else {
    const existe = await prisma.contact.findFirst({
      where: {
        companyId,
        type: "CLIENTE",
        OR: [
          { nomeFantasia: { contains: nomeCliente, mode: "insensitive" } },
          { razaoSocial: { contains: nomeCliente, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (!existe)
      perguntas.push(
        `👤 *Cliente:* não achei "${nomeCliente}" no cadastro — crio esse cliente novo? (confirma ou me passa o nome certo)`
      );
  }
  if (!ext.eventoNome?.trim()) perguntas.push("🎪 *Evento:* qual o nome do evento?");
  if (!ext.dataInicio)
    perguntas.push("📅 *Datas:* quando começa e termina? (e a montagem, se já souber)");

  if (perguntas.length === 0) return null;
  return [
    `📋 ${MARCA_PERGUNTAS}, me confirma ${perguntas.length === 1 ? "uma coisa" : "umas coisas"}:`,
    "",
    ...perguntas,
    "",
    "Responde o que tiver (pode ser tudo numa mensagem só).",
    "Sem tempo agora? Manda *criar assim mesmo* que eu deixo em branco pra completar depois.",
    "Para desistir, manda *cancelar*.",
  ].join("\n");
}

export async function formalizarOrcamento(
  companyId: string,
  conversa: MensagemChat[],
  criadoVia: string,
  opts?: { perguntarSeFaltar?: boolean }
): Promise<ResultadoFormalizar> {
  if (conversa.length === 0) return { ok: false, erro: "Ainda não há conversa para formalizar." };

  const ext = await extrairEstrutura(companyId, conversa);
  if (!ext || !Array.isArray(ext.itens) || ext.itens.length === 0)
    return {
      ok: false,
      erro: "Não consegui identificar os itens do orçamento na conversa. Monte o orçamento primeiro e depois peça para formalizar.",
    };

  // Uma rodada de perguntas antes de criar (cliente, evento, datas)
  if (opts?.perguntarSeFaltar) {
    const perguntas = await perguntasPendentes(companyId, ext);
    if (perguntas) return { ok: false, pendente: true, texto: perguntas };
  }

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
      dataMontagem: parseData(ext.dataMontagem),
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

// ── Comando "formalizar" nos webhooks de WhatsApp ────────────────────────────

const REGEX_FORMALIZAR =
  /\bformalizar?\b|or[çc]amento (formal|oficial)|criar or[çc]amento|gerar or[çc]amento/i;
const REGEX_CRIAR_ASSIM = /assim mesmo|em branco|sem (dados|informa)|pode criar|cria logo/i;

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Decide e executa o fluxo de formalização para uma mensagem recebida.
 * Retorna o texto a responder, ou null quando a mensagem não é sobre isso
 * (segue o fluxo normal de orçamento rápido).
 */
export async function tratarComandoFormalizar(
  companyId: string,
  chaveConversa: string,
  texto: string,
  assistente: string,
  criadoVia: string,
  appUrl: string
): Promise<string | null> {
  const conversa = await conversaDesdeReset(companyId, chaveConversa);

  // A resposta ao questionário também entra no fluxo (sem precisar repetir "formalizar")
  const ultimaAssistente = [...conversa].reverse().find((m) => m.role === "assistant");
  const respondendoPerguntas = Boolean(ultimaAssistente?.content.includes(MARCA_PERGUNTAS));
  const pediuFormalizar = REGEX_FORMALIZAR.test(texto);
  if (!pediuFormalizar && !respondendoPerguntas) return null;

  if (respondendoPerguntas && /^\s*cancelar?\s*$/i.test(texto))
    return `🤖 *${assistente}*\n\n👍 Beleza, cancelei a criação. O orçamento rápido continua aqui na conversa se mudar de ideia.`;

  // Só pergunta os dados uma vez; depois cria com o que tiver
  const perguntarSeFaltar = !respondendoPerguntas && !REGEX_CRIAR_ASSIM.test(texto);

  // remove o comando puro do fim da conversa (não agrega ao conteúdo)
  if (conversa.length && conversa[conversa.length - 1].content === texto && pediuFormalizar && texto.trim().split(/\s+/).length <= 3)
    conversa.pop();

  const r = await formalizarOrcamento(companyId, conversa.length ? conversa : [{ role: "user", content: texto }], criadoVia, {
    perguntarSeFaltar,
  });

  if (!r.ok && "pendente" in r && r.pendente) return `🤖 *${assistente}*\n\n${r.texto}`;
  if (!r.ok) return `🤖 *${assistente}*\n\n⚠️ ${(r as { erro: string }).erro}`;

  return [
    `🤖 *${assistente}*`,
    "",
    `✅ *Orçamento #${r.numero} criado!*`,
    `${r.qtdItens} ${r.qtdItens === 1 ? "item" : "itens"} · Total: *${moeda(r.total)}*`,
    "",
    `✏️ Editar: ${appUrl}/orcamentos/${r.id}`,
    `🖨️ Imprimir/PDF: ${appUrl}/orcamentos/${r.id}/imprimir`,
    ...(r.avisos.length ? ["", "⚠️ " + r.avisos.join("\n⚠️ ")] : []),
  ].join("\n");
}
