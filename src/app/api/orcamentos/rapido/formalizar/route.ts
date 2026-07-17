import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { formalizarOrcamento } from "@/lib/nestor-formalizar";
import type { MensagemChat } from "@/lib/nestor-orcamento";

// Transforma a conversa do Orçamento Rápido em um orçamento oficial do sistema.

export const maxDuration = 300;

type SessionUser = { companyId?: string; name?: string | null };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as SessionUser;
  if (!u.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const bruto = Array.isArray(body?.mensagens) ? (body.mensagens as unknown[]) : [];
  const conversa: MensagemChat[] = bruto
    .map((m) => m as { role?: string; content?: string })
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
    .slice(-16)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content!.trim() }));

  const r = await formalizarOrcamento(u.companyId, conversa, `app — ${u.name || "usuário"}`);
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });

  await auditar(session.user as never, {
    tipo: "ALTERACAO",
    modulo: "orcamentos",
    acao: `Formalizou orçamento rápido → #${r.numero}`,
  });

  return NextResponse.json(r);
}
