import { prisma } from "@/lib/prisma";
import { clienteIa, MODELO_PROPOSTA } from "@/lib/ia";

// NESTOR — orçamento rápido pelo WhatsApp.
// O usuário autorizado manda o briefing do cliente; o assistente consulta o
// catálogo da empresa (itens, estoque e diárias) e devolve um texto de
// orçamento pronto para encaminhar ao cliente.

const MAX_ITENS_CATALOGO = 500;
const MAX_HISTORICO = 16;
const TIMEOUT_IA_MS = 90_000;

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Catálogo compacto (uma linha por item) para o contexto da IA. */
async function catalogoDaEmpresa(companyId: string): Promise<string> {
  const itens = await prisma.item.findMany({
    where: { companyId, acessoriosVinc: { none: {} } },
    select: {
      codigo: true,
      nome: true,
      modelo: true,
      apelidos: true,
      natureza: true,
      cobranca: true,
      valorAluguel: true,
      valorSemana: true,
      valorQuinzena: true,
      valorMes: true,
      quantidade: true,
      marca: { select: { nome: true } },
      categoria: { select: { nome: true } },
    },
    orderBy: [{ categoria: { nome: "asc" } }, { nome: "asc" }],
    take: MAX_ITENS_CATALOGO,
  });

  return itens
    .map((i) => {
      const nome = [i.nome, i.marca?.nome, i.modelo].filter(Boolean).join(" ");
      const partes = [`[${i.codigo}] ${nome}`];
      if (i.apelidos?.trim()) partes.push(`(apelidos: ${i.apelidos.trim()})`);
      if (i.categoria?.nome) partes.push(`| ${i.categoria.nome}`);
      if (i.natureza === "SERVICO") {
        const cobr =
          i.cobranca === "HORA" ? "/hora" : i.cobranca === "DIARIA" ? "/diária" : " (fixo)";
        partes.push(`| SERVIÇO ${moeda(i.valorAluguel)}${cobr}`);
      } else {
        partes.push(`| diária ${moeda(i.valorAluguel)}`);
        if (i.valorSemana) partes.push(`| semana ${moeda(i.valorSemana)}`);
        if (i.valorQuinzena) partes.push(`| quinzena ${moeda(i.valorQuinzena)}`);
        if (i.valorMes) partes.push(`| mês ${moeda(i.valorMes)}`);
        partes.push(`| estoque ${i.quantidade}`);
      }
      return partes.join(" ");
    })
    .join("\n");
}

function instrucoes(assistente: string, empresaNome: string, politica: string): string {
  return `Você é ${assistente}, o assistente de WhatsApp da ${empresaNome}, uma locadora de equipamentos para eventos.

Sua função: quando um membro da equipe te mandar o briefing/necessidade de um cliente, montar um ORÇAMENTO RÁPIDO em texto, pronto para ser copiado e enviado ao cliente pelo WhatsApp.

Use SOMENTE os itens do catálogo abaixo (com os preços e estoque reais do sistema). Nunca invente item nem preço.

Formato da resposta (formatação de WhatsApp — *negrito* com asteriscos, sem Markdown de cabeçalho):
*ORÇAMENTO RÁPIDO — ${empresaNome}*
(uma linha em branco)
Lista dos itens, um por linha: quantidade × nome — valor da diária × nº de diárias = subtotal
(linha em branco)
*TOTAL: R$ ...* (com o período considerado)
Validade/observação curta ao final.

Regras:
- Responda em português do Brasil, direto e curto (é WhatsApp).
- Se o briefing não disser a quantidade de diárias, assuma 1 diária e avise em uma linha.
- Se pedirem algo que não existe no catálogo, diga claramente o que não temos e sugira o item mais próximo do catálogo, se houver.
- Se a quantidade pedida for maior que o estoque, monte mesmo assim e avise "⚠️ acima do estoque (temos N)" na linha do item.
- Cite os itens pelo nome comercial (sem o código entre colchetes), mas use o código internamente para não confundir itens parecidos.
- ${politica}
- Se a mensagem for só uma dúvida (preço de um item, disponibilidade), responda objetivamente sem montar orçamento completo.
- No máximo 1 pergunta de esclarecimento, e somente se for impossível montar o orçamento sem ela.`;
}

export interface RespostaNestor {
  texto: string;
  erro?: string;
}

export interface MensagemChat {
  role: "user" | "assistant";
  content: string;
}

/**
 * Núcleo do orçamento rápido: recebe a conversa pronta (qualquer canal —
 * WhatsApp ou o chat dentro do app) e devolve a resposta da IA com o
 * catálogo/preços reais da empresa no contexto.
 */
export async function gerarRespostaOrcamento(
  companyId: string,
  conversa: MensagemChat[]
): Promise<RespostaNestor> {
  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      whatsappAssistente: true,
      diasSemana: true,
      diasQuinzena: true,
      diasMes: true,
      descontoSemana: true,
      descontoQuinzena: true,
      descontoMes: true,
    },
  });
  if (!empresa) return { texto: "", erro: "Empresa não encontrada" };

  const ia = await clienteIa(companyId);
  if (!ia)
    return {
      texto:
        "⚠️ A inteligência do assistente ainda não está configurada (chave de IA da empresa ausente). Peça ao administrador para configurar em Configurações → Inteligência Artificial.",
    };

  const catalogo = await catalogoDaEmpresa(companyId);

  const politica = [
    `Política de preços por período da empresa: semana = ${empresa.diasSemana} dias`,
    empresa.descontoSemana ? ` (${empresa.descontoSemana}% de desconto sobre as diárias)` : "",
    `, quinzena = ${empresa.diasQuinzena} dias`,
    empresa.descontoQuinzena ? ` (${empresa.descontoQuinzena}% desc.)` : "",
    `, mês = ${empresa.diasMes} dias`,
    empresa.descontoMes ? ` (${empresa.descontoMes}% desc.)` : "",
    `. Quando o item tiver preço de semana/quinzena/mês cadastrado, use-o para períodos longos; senão aplique o desconto da política sobre diária × dias.`,
  ].join("");

  const assistente = empresa.whatsappAssistente?.trim() || "Assistente";
  const system = `${instrucoes(assistente, empresa.name, politica)}

CATÁLOGO ATUAL (código | nome | preços | estoque):
${catalogo || "(catálogo vazio — avise que não há itens cadastrados)"}`;

  // a primeira mensagem enviada à API precisa ser do usuário
  const messages = [...conversa];
  while (messages.length > 0 && messages[0].role === "assistant") messages.shift();
  if (messages.length === 0) return { texto: "", erro: "Conversa vazia" };

  try {
    const res = await ia.messages.create(
      {
        model: MODELO_PROPOSTA,
        max_tokens: 2000,
        system,
        messages,
      },
      { timeout: TIMEOUT_IA_MS, maxRetries: 1 }
    );
    const texto = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
    if (!texto) return { texto: "", erro: "Resposta vazia da IA" };
    return { texto };
  } catch (e) {
    return { texto: "", erro: e instanceof Error ? e.message : "Falha ao consultar a IA" };
  }
}

/**
 * Versão do WhatsApp: monta a conversa a partir do histórico salvo do telefone
 * (desde o último RESET) e delega ao núcleo.
 */
export async function responderOrcamentoRapido(
  companyId: string,
  telefone: string,
  mensagem: string
): Promise<RespostaNestor> {
  const historicoDb = await prisma.nestorConversa.findMany({
    where: { companyId, telefone },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORICO,
  });

  // Histórico em ordem cronológica, cortado no último RESET ("nova conversa")
  const cronologico = historicoDb.reverse();
  const ultimoReset = cronologico.map((m) => m.papel).lastIndexOf("RESET");
  const historico = cronologico.slice(ultimoReset + 1);

  // a mensagem atual já foi salva no banco pelo webhook — tira do histórico
  const ultima = historico[historico.length - 1];
  if (ultima && ultima.papel === "USUARIO" && ultima.texto === mensagem) historico.pop();

  const conversa: MensagemChat[] = [
    ...historico
      .filter((m) => m.papel === "USUARIO" || m.papel === "ASSISTENTE")
      .map((m) => ({
        role: m.papel === "USUARIO" ? ("user" as const) : ("assistant" as const),
        content: m.texto,
      })),
    { role: "user", content: mensagem },
  ];
  return gerarRespostaOrcamento(companyId, conversa);
}
