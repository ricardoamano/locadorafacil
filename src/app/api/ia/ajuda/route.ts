import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { clienteIa, MODELO_PROPOSTA } from "@/lib/ia";

// Módulo Ajuda — chat que responde com base nos dados da empresa:
// Banco de Preços de Mercado (quem tem o quê e por quanto) + estoque próprio.

// A consulta à IA pode passar do limite padrão de execução da Vercel.
export const maxDuration = 300;

type SessionUser = { id?: string; companyId?: string };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId ? { companyId: u.companyId, userId: u.id as string } : null;
}

export async function POST(req: NextRequest) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { companyId, userId } = sessao;

  const body = await req.json();
  const conversaId = typeof body.conversaId === "string" ? body.conversaId : null;
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

    // Persiste o histórico da conversa (cada usuário vê as suas)
    const completo = [...mensagens, { role: "assistant" as const, content: texto }];
    const primeira = mensagens.find((m) => m.role === "user")?.content || "Conversa";
    const titulo = primeira.slice(0, 80);

    let idConversa = conversaId;
    try {
      if (conversaId) {
        const dono = await prisma.ajudaConversa.findFirst({
          where: { id: conversaId, companyId, userId },
          select: { id: true },
        });
        if (dono) {
          await prisma.ajudaConversa.update({
            where: { id: conversaId },
            data: { mensagens: completo },
          });
        } else {
          idConversa = null;
        }
      }
      if (!idConversa) {
        const nova = await prisma.ajudaConversa.create({
          data: { companyId, userId, titulo, mensagens: completo },
          select: { id: true },
        });
        idConversa = nova.id;
      }
    } catch {
      // histórico é secundário: se falhar, ainda devolvemos a resposta
    }

    return NextResponse.json({ resposta: texto, conversaId: idConversa });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na IA";
    return NextResponse.json({ error: `Erro: ${msg}` }, { status: 502 });
  }
}
