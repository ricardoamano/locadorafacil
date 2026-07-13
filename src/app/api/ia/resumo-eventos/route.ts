import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { clienteIa, MODELO_PROPOSTA } from "@/lib/ia";

// Resumo por IA de todos os eventos do período: usa o pós-evento das OS
// (sucessos, problemas, feedback), as avaliações da equipe e os valores.

export const maxDuration = 300;

type SessionUser = { companyId?: string };

function fmtMoeda(v?: number | null) {
  return v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  const inicio = body.inicio ? new Date(body.inicio) : null;
  const fim = body.fim ? new Date(body.fim) : null;
  if (!inicio || !fim || isNaN(inicio.getTime()) || isNaN(fim.getTime()))
    return NextResponse.json({ error: "Período inválido" }, { status: 400 });

  const ia = await clienteIa(companyId);
  if (!ia)
    return NextResponse.json(
      { error: "IA não configurada — peça ao administrador para configurar em Configurações → Inteligência Artificial." },
      { status: 400 }
    );

  const [ordens, avaliacoes] = await Promise.all([
    prisma.ordemServico.findMany({
      where: {
        companyId,
        orcamento: { dataInicio: { gte: inicio, lte: fim } },
      },
      include: {
        orcamento: {
          select: {
            numero: true,
            eventoNome: true,
            tipoEvento: true,
            dataInicio: true,
            total: true,
            cliente: { select: { nomeFantasia: true, isPostoServico: true } },
          },
        },
        escala: {
          select: { funcao: true, cache: true, membro: { select: { nome: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.avaliacao.findMany({
      where: {
        createdAt: { gte: inicio, lte: new Date(fim.getTime() + 86_400_000) },
        membro: { companyId },
      },
      select: { nota: true, comentario: true, evento: true, membro: { select: { nome: true } } },
      take: 200,
    }),
  ]);

  if (ordens.length === 0)
    return NextResponse.json(
      { error: "Nenhum evento com OS neste período." },
      { status: 422 }
    );

  const blocos = ordens.map((os) => {
    const o = os.orcamento;
    const linhas = [
      `### ${o?.eventoNome || `OS do orçamento #${o?.numero}`} — ${o?.cliente?.nomeFantasia || "?"}${o?.cliente?.isPostoServico ? " (posto de serviço)" : ""}`,
      `Data: ${o?.dataInicio ? new Date(o.dataInicio).toLocaleDateString("pt-BR") : "?"} · Valor: ${fmtMoeda(o?.total)} · Status OS: ${os.status}`,
      os.escala.length
        ? `Equipe: ${os.escala.map((e) => `${e.membro?.nome}${e.funcao ? ` (${e.funcao})` : ""}`).join(", ")}`
        : null,
      os.posSucessos ? `Sucessos: ${os.posSucessos}` : null,
      os.posProblemas ? `Problemas: ${os.posProblemas}` : null,
      os.posFeedback ? `Feedback do cliente: ${os.posFeedback}` : null,
      os.posComentarios ? `Comentários finais: ${os.posComentarios}` : null,
      !os.posSucessos && !os.posProblemas && !os.posFeedback && !os.posComentarios
        ? "(sem registro de pós-evento)"
        : null,
    ].filter(Boolean);
    return linhas.join("\n");
  });

  const linhasAvaliacoes = avaliacoes
    .map(
      (a) =>
        `- ${a.membro?.nome}: nota ${a.nota}/5${a.evento ? ` (${a.evento})` : ""}${a.comentario ? ` — "${a.comentario}"` : ""}`
    )
    .join("\n");

  const totalPeriodo = ordens.reduce((s, os) => s + (os.orcamento?.total || 0), 0);

  const prompt = `## EVENTOS DO PERÍODO (${inicio.toLocaleDateString("pt-BR")} a ${fim.toLocaleDateString("pt-BR")}) — ${ordens.length} evento(s), total ${fmtMoeda(totalPeriodo)}

${blocos.join("\n\n")}

## AVALIAÇÕES DA EQUIPE NO PERÍODO
${linhasAvaliacoes || "(nenhuma)"}`;

  const system = `Você é o analista de operações de uma locadora de tecnologia para eventos. Com base nos dados dos eventos do período (pós-evento, equipe, avaliações e valores), escreva um RESUMO EXECUTIVO em português do Brasil, em Markdown, com:

## Visão geral do período
(2-3 frases: volume, faturamento, clima geral)

## O que foi bem
(padrões de sucesso entre os eventos)

## Problemas e riscos recorrentes
(padrões de falha — seja específico e cite os eventos)

## Destaques da equipe
(quem foi bem/mal segundo as avaliações; se não houver dados, diga)

## Recomendações para o próximo período
(3-5 ações práticas e priorizadas)

Regras: use SOMENTE os dados fornecidos; se faltar registro de pós-evento em muitos eventos, aponte isso como oportunidade de disciplina operacional. Seja direto e útil, sem enrolação.`;

  try {
    const resposta = await ia.messages.create({
      model: MODELO_PROPOSTA,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const texto = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return NextResponse.json({ resumo: texto, eventos: ordens.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na IA";
    return NextResponse.json({ error: `Erro ao gerar o resumo: ${msg}` }, { status: 502 });
  }
}
