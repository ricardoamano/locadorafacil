import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { importarItens, normalizarLinha, type LinhaItem } from "@/lib/itens-importar";

// Importação em massa — passo 2: cria (ou atualiza, se já existir pelo
// nome+modelo) todos os itens revisados de uma vez.

export const maxDuration = 120;

type SessionUser = { companyId?: string };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const linhas = (Array.isArray(body?.itens) ? body.itens : [])
    .map(normalizarLinha)
    .filter(Boolean) as LinhaItem[];
  if (linhas.length === 0)
    return NextResponse.json({ error: "Nenhum item para importar." }, { status: 400 });

  const r = await importarItens(companyId, linhas);

  await auditar(session.user as never, {
    tipo: "ALTERACAO",
    modulo: "ativos",
    acao: `Importou itens em massa: ${r.criados.length} criados, ${r.atualizados.length} atualizados`,
  });

  return NextResponse.json({
    criados: r.criados.length,
    atualizados: r.atualizados.length,
    detalhes: r,
  });
}
