import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { gerarRespostaOrcamento, type MensagemChat } from "@/lib/nestor-orcamento";
import { formalizarOrcamento, MARCA_PERGUNTAS } from "@/lib/nestor-formalizar";

// Orçamento rápido dentro do app: chat com a mesma IA do assistente de
// WhatsApp, consultando itens, estoque e diárias reais do catálogo.

export const maxDuration = 300;

type SessionUser = { companyId?: string };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const bruto = Array.isArray(body?.mensagens) ? (body.mensagens as unknown[]) : [];
  const conversa: MensagemChat[] = bruto
    .map((m) => m as { role?: string; content?: string })
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
    .slice(-16)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content!.trim() }));

  if (conversa.length === 0 || conversa[conversa.length - 1].role !== "user")
    return NextResponse.json({ error: "Envie a mensagem do briefing" }, { status: 400 });

  // Se a última fala do assistente foi o questionário da formalização, esta
  // mensagem são as respostas → cria o orçamento direto (como no WhatsApp).
  const ultimaAssistente = [...conversa].reverse().find((m) => m.role === "assistant");
  if (ultimaAssistente?.content.includes(MARCA_PERGUNTAS)) {
    const atual = conversa[conversa.length - 1].content;
    if (/^\s*cancelar?\s*$/i.test(atual))
      return NextResponse.json({
        texto: "👍 Beleza, cancelei a criação. O orçamento rápido continua aqui se mudar de ideia.",
      });
    const r = await formalizarOrcamento(
      companyId,
      conversa,
      `app — ${(session.user as { name?: string | null }).name || "usuário"}`,
      { perguntarSeFaltar: false }
    );
    if (r.ok) {
      await auditar(session.user as never, {
        tipo: "ALTERACAO",
        modulo: "orcamentos",
        acao: `Formalizou orçamento rápido → #${r.numero}`,
      });
      const avisos = r.avisos.length ? `\n⚠️ ${r.avisos.join("\n⚠️ ")}` : "";
      return NextResponse.json({
        texto: `✅ *Orçamento #${r.numero} criado no sistema!*\n${r.qtdItens} ${r.qtdItens === 1 ? "item" : "itens"} · Total: ${r.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${avisos}`,
        orcamentoId: r.id,
      });
    }
    return NextResponse.json({
      texto: `⚠️ ${"erro" in r ? r.erro : "Não consegui criar o orçamento."}`,
    });
  }

  const resposta = await gerarRespostaOrcamento(companyId, conversa);
  if (resposta.erro && !resposta.texto)
    return NextResponse.json({ error: resposta.erro }, { status: 502 });

  await auditar(session.user as never, {
    tipo: "ACESSO",
    modulo: "orcamentos",
    acao: "Orçamento rápido (chat no app)",
    detalhe: conversa[conversa.length - 1].content.slice(0, 300),
  });

  return NextResponse.json({ texto: resposta.texto });
}
