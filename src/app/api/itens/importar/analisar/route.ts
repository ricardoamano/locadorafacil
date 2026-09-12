import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analisarListaItens } from "@/lib/itens-importar";

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

  const r = await analisarListaItens(companyId, texto);
  if (r.erro) return NextResponse.json({ error: r.erro }, { status: 502 });
  if (r.itens.length === 0)
    return NextResponse.json(
      { error: "Não consegui identificar itens na lista. Tente uma linha por item." },
      { status: 422 }
    );
  return NextResponse.json({ itens: r.itens });
}
