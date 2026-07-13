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

export const INSTRUCOES_ESCALA_PADRAO = `Você é um especialista em logística, escala de equipe e frota para produção de eventos.

A partir da ordem de serviço (equipamentos, datas de montagem/desmontagem, local, equipe já escalada e veículos), ajude o responsável a:
- Dimensionar a equipe necessária (funções e quantidade) para montagem, operação e desmontagem.
- Sugerir a escala de veículos considerando o volume de equipamentos e a distância.
- Apontar riscos logísticos (rodízio de veículos, janelas de carga/descarga, horários apertados, gargalos).
- Propor uma linha do tempo (timeline) objetiva da operação.

Regras:
- Seja prático e direto, em português do Brasil, com listas curtas.
- Use os dados da OS fornecidos no contexto. Se faltar algo crítico, faça no máximo 2 perguntas objetivas.
- Não invente custos nem cachês — foque na logística e no dimensionamento.`;

// ── Skills nomeadas por empresa ────────────────────────────────────────────────
// A empresa pode ter várias skills (ex.: uma para propostas, outra para escala).
// Cada skill tem um tipo que diz onde ela é usada.

export type SkillTipo = "PROPOSTA" | "ESCALA" | "GERAL";

export interface IaSkill {
  id: string;
  nome: string;
  tipo: SkillTipo;
  instrucoes: string;
}

const TIPOS_VALIDOS: SkillTipo[] = ["PROPOSTA", "ESCALA", "GERAL"];

/**
 * Normaliza as skills da empresa. Se ainda não houver nenhuma cadastrada,
 * devolve as duas skills padrão (propostas + escala), semeando a de propostas
 * com o texto legado de `iaInstrucoes` quando existir.
 */
export function normalizarSkills(
  iaSkills: unknown,
  iaInstrucoesLegado?: string | null
): IaSkill[] {
  if (Array.isArray(iaSkills) && iaSkills.length > 0) {
    return iaSkills.map((raw, i) => {
      const s = (raw || {}) as Record<string, unknown>;
      const tipo = TIPOS_VALIDOS.includes(s.tipo as SkillTipo)
        ? (s.tipo as SkillTipo)
        : "GERAL";
      return {
        id: String(s.id || `skill-${i}`),
        nome: String(s.nome || "Skill sem nome").slice(0, 120),
        tipo,
        instrucoes: String(s.instrucoes || ""),
      };
    });
  }
  return [
    {
      id: "proposta",
      nome: "Gerador de propostas",
      tipo: "PROPOSTA",
      instrucoes: iaInstrucoesLegado?.trim() || INSTRUCOES_PROPOSTA_PADRAO,
    },
    {
      id: "escala",
      nome: "Escala de equipe e veículos",
      tipo: "ESCALA",
      instrucoes: INSTRUCOES_ESCALA_PADRAO,
    },
  ];
}

/** Instruções da primeira skill de um tipo (ou o padrão informado). */
export function instrucoesPorTipo(
  skills: IaSkill[],
  tipo: SkillTipo,
  padrao: string
): string {
  const s = skills.find((x) => x.tipo === tipo && x.instrucoes.trim());
  return s?.instrucoes.trim() || padrao;
}
