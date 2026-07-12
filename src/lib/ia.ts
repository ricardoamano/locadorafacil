import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// Inteligência Artificial (Claude API) — por empresa.
// Autopreenchimento usa o Haiku (rápido e barato); propostas usam o Sonnet.

export const MODELO_AUTOFILL = "claude-haiku-4-5";
export const MODELO_PROPOSTA = "claude-sonnet-5";

export async function clienteIa(companyId: string): Promise<Anthropic | null> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { iaApiKey: true },
  });
  if (!c?.iaApiKey) return null;
  return new Anthropic({ apiKey: c.iaApiKey });
}

/** Extrai o primeiro objeto JSON de um texto (a IA às vezes escreve ao redor). */
export function extrairJson(texto: string): Record<string, unknown> | null {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio === -1 || fim <= inicio) return null;
  try {
    return JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}

export const INSTRUCOES_PROPOSTA_PADRAO = `Você é um especialista em propostas comerciais de tecnologia para eventos (desenvolvimento de aplicativos, jogos, ativações digitais e projetos sob medida).

Quando o usuário descrever um projeto, gere uma proposta comercial completa em Markdown, em português do Brasil, com esta estrutura:

# [Nome do projeto]

## Entendimento do desafio
(1 parágrafo mostrando que entendemos a necessidade do cliente)

## Escopo do projeto
(lista objetiva do que será entregue)

## Metodologia e etapas
(lista numerada das fases do trabalho)

## Cronograma
(tabela Markdown: | Etapa | Prazo |)

## O que está incluído
(lista)

## O que não está incluído
(lista curta, para proteger o escopo)

## Condições gerais
(validade, forma de pagamento sugerida, garantia/suporte)

Regras:
- NÃO invente valores em reais — deixe o investimento para o campo próprio do sistema.
- Seja específico e profissional, sem jargão desnecessário.
- Se faltar informação importante, faça no máximo 2 perguntas objetivas antes de gerar.
- Quando o usuário pedir ajustes, reescreva a proposta completa já ajustada.`;
