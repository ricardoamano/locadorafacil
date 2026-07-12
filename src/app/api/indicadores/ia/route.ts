import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clienteIa, MODELO_PROPOSTA } from "@/lib/ia";

// Análise executiva dos indicadores por IA: recebe os KPIs calculados do
// período e devolve uma leitura de consultor — alertas, causas prováveis e
// ações — usando os benchmarks do setor de locação.

export const maxDuration = 60;

type SessionUser = { companyId?: string };

const BENCHMARKS = `Benchmarks do setor de locação (eventos/equipamentos/frotas):
- Taxa de conversão de propostas saudável: 30–50%. Abaixo: preço fora ou briefing frio.
- Utilização de tempo do parque: 65–75% é o ideal; <60% = estoque demais; >80% = demanda perdida, hora de comprar.
- Dollar utilization (receita anualizada ÷ valor do parque): 55–65% é aceitável no setor.
- PMR: agências pagam em 45–60 dias; custos são à vista — acompanhar caixa projetado.
- Concentração: 2–3 clientes com 60%+ do faturamento é RISCO, não sucesso.
- % de sublocação crescendo = avaliar compra de equipamento próprio (usar demanda perdida como business case).
- Pipeline 90 dias: eventos têm lead time — mês vazio hoje é problema de 60 dias atrás.
- B2B de eventos saudável vive de recorrência (taxa de recompra alta).`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const ia = await clienteIa(companyId);
  if (!ia)
    return NextResponse.json(
      { error: "IA não configurada — configure em Configurações → Inteligência Artificial." },
      { status: 400 }
    );

  const body = await req.json().catch(() => null);
  if (!body?.dados)
    return NextResponse.json({ error: "Envie os indicadores calculados" }, { status: 400 });

  try {
    const resposta = await ia.messages.create({
      model: MODELO_PROPOSTA,
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `Você é consultor de gestão de uma locadora de equipamentos audiovisuais para eventos corporativos B2B em São Paulo. Analise os indicadores do período abaixo e escreva uma leitura executiva CURTA e direta em Markdown, em português do Brasil.

${BENCHMARKS}

Indicadores calculados (JSON; "atual" é o período analisado, "anterior" é o período equivalente anterior; valores em reais):
${JSON.stringify(body.dados).slice(0, 20000)}

Estrutura da resposta:
## Leitura do período
(2-3 frases: o que os números dizem)

## Alertas
(bullets APENAS do que está fora do benchmark ou piorou vs período anterior — com o número)

## Ações sugeridas
(3-5 bullets práticos e priorizados)

Regras: use só os números fornecidos (não invente); se algum indicador estiver sem dados (null/zero por falta de lançamentos, ex.: margem sem custos lançados), diga explicitamente o que precisa ser alimentado no sistema; se o volume do período for muito pequeno para conclusões, avise. Sem introduções ou despedidas.`,
        },
      ],
    });
    const texto = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    if (!texto.trim())
      return NextResponse.json({ error: "A IA não retornou análise" }, { status: 422 });
    return NextResponse.json({ analise: texto });
  } catch (e) {
    console.error("[indicadores/ia] Erro:", e);
    const msg = e instanceof Error ? e.message : "Erro na análise";
    return NextResponse.json({ error: `Erro na análise: ${msg}` }, { status: 502 });
  }
}
