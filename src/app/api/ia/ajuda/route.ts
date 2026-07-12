import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { clienteIa, MODELO_PROPOSTA } from "@/lib/ia";

// Módulo Ajuda — chat que responde com base nos dados da empresa:
// Banco de Preços de Mercado (quem tem o quê e por quanto) + estoque próprio.

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const mensagens = (body.mensagens || []) as { role: "user" | "assistant"; content: string }[];
  if (mensagens.length === 0 || mensagens[mensagens.length - 1].role !== "user")
    return NextResponse.json({ error: "Envie uma pergunta" }, { status: 400 });

  const ia = await clienteIa(companyId);
  if (!ia)
    return NextResponse.json(
      { error: "IA não configurada — peça ao administrador para configurar em Configurações → Inteligência Artificial." },
      { status: 400 }
    );

  // Contexto: banco de preços de mercado + itens próprios (compactos)
  const [precos, itens, empresa] = await Promise.all([
    prisma.precoMercado.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.item.findMany({
      where: { companyId },
      select: {
        nome: true,
        modelo: true,
        quantidade: true,
        valorAluguel: true,
        valorSemana: true,
        valorMes: true,
        marca: { select: { nome: true } },
      },
      take: 500,
    }),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
  ]);

  const linhasPrecos = precos
    .map(
      (p) =>
        `${p.equipamento}${p.marca ? ` | marca: ${p.marca}` : ""}${p.modelo ? ` | modelo: ${p.modelo}` : ""} | empresa: ${p.fonte || "?"} | diária: ${p.diaria ?? "?"} | semana: ${p.semana ?? "?"} | mês: ${p.mes ?? "?"}`
    )
    .join("\n");
  const linhasItens = itens
    .map(
      (i) =>
        `${i.nome}${i.marca?.nome ? ` | marca: ${i.marca.nome}` : ""}${i.modelo ? ` | modelo: ${i.modelo}` : ""} | qtd: ${i.quantidade} | diária: ${i.valorAluguel}`
    )
    .join("\n");

  const system = `Você é o assistente de Ajuda interno da empresa "${empresa?.name}" (locadora de tecnologia para eventos). Responda em português do Brasil, de forma curta e direta.

Responda APENAS com base nos dados abaixo. Se a informação não estiver nos dados, diga claramente "não tenho registro disso no banco" e sugira importar orçamentos no Banco de Preços de Mercado. Nunca invente empresas ou valores.

Formate valores como R$ e cite a empresa fonte quando falar de preços de mercado.

=== BANCO DE PREÇOS DE MERCADO (equipamentos de concorrentes/parceiros: quem tem e quanto cobra) ===
${linhasPrecos || "(vazio — nenhum orçamento importado ainda)"}

=== NOSSO ESTOQUE (equipamentos próprios da ${empresa?.name}) ===
${linhasItens || "(vazio)"}`;

  try {
    const resposta = await ia.messages.create({
      model: MODELO_PROPOSTA,
      max_tokens: 2000,
      system,
      messages: mensagens.slice(-16).map((m) => ({ role: m.role, content: m.content })),
    });
    const texto = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return NextResponse.json({ resposta: texto });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na IA";
    return NextResponse.json({ error: `Erro: ${msg}` }, { status: 502 });
  }
}
