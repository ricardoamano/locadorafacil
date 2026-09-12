import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clienteIa, extrairJson, MODELO_PROPOSTA } from "@/lib/ia";

// Importação em massa — passo 1: a IA transforma uma lista colada (qualquer
// formato: export do Bubble, planilha, texto solto) em linhas estruturadas
// para revisão. Não grava nada; só devolve o que entendeu.

export const maxDuration = 120;

type SessionUser = { companyId?: string };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { texto } = await req.json().catch(() => ({ texto: "" }));
  if (!texto?.trim() || texto.trim().length < 3)
    return NextResponse.json({ error: "Cole a lista de itens primeiro." }, { status: 400 });

  const ia = await clienteIa(companyId);
  if (!ia)
    return NextResponse.json(
      { error: "A IA da empresa não está configurada (Configurações → Inteligência Artificial)." },
      { status: 400 }
    );

  const system = `Você organiza listas de inventário de uma locadora de equipamentos para eventos.

Receberá um texto solto (pode vir de planilha, export de outro sistema, ou digitado às pressas). Transforme CADA item em uma linha estruturada.

Responda SOMENTE com JSON neste formato, sem comentários:
{"itens": [{"nome": string, "marca": string|null, "modelo": string|null, "quantidade": number, "valorAluguel": number, "categoria": string|null}]}

Regras:
- "nome": nome comercial curto do equipamento, SEM marca/modelo embutidos quando der para separar (ex.: "Projetor", não "Projetor Epson X"). Se não der para separar, mantenha o nome inteiro.
- "marca" e "modelo": extraia quando aparecerem; senão null.
- "quantidade": inteiro; se não informado, use 1.
- "valorAluguel": valor da diária em número (ex.: 150). Se não informado, use 0.
- "categoria": agrupe por tipo quando for óbvio (Áudio, Vídeo, Iluminação, Informática, Estrutura, Energia, Mobiliário...); senão null.
- Uma linha por item. Não invente itens que não estão no texto. Não invente preços (use 0 quando não houver).
- Ignore cabeçalhos de planilha e linhas vazias.`;

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
    const itens = Array.isArray(parsed?.itens) ? parsed!.itens : [];
    if (itens.length === 0)
      return NextResponse.json(
        { error: "Não consegui identificar itens na lista. Tente uma linha por item." },
        { status: 422 }
      );

    const limpos = itens.slice(0, 300).map((raw) => {
      const i = (raw || {}) as Record<string, unknown>;
      return {
        nome: String(i.nome || "").trim().slice(0, 160),
        marca: i.marca ? String(i.marca).trim().slice(0, 80) : "",
        modelo: i.modelo ? String(i.modelo).trim().slice(0, 80) : "",
        quantidade: Math.max(0, Math.round(Number(i.quantidade) || 1)),
        valorAluguel: Math.max(0, Number(i.valorAluguel) || 0),
        categoria: i.categoria ? String(i.categoria).trim().slice(0, 80) : "",
      };
    }).filter((i) => i.nome);

    return NextResponse.json({ itens: limpos });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao analisar a lista." },
      { status: 502 }
    );
  }
}
