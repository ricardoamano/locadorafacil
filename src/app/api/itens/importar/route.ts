import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import {
  importarItens,
  compararItens,
  normalizarLinha,
  type LinhaItem,
} from "@/lib/itens-importar";
import type { Decisao } from "@/lib/importar-revisao";

// Importação em massa — passo 2: compara com o que já existe (modo "comparar")
// e, depois das decisões do usuário, cria/atualiza/mantém cada linha.

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

  // Só compara: nada é gravado
  if (body.modo === "comparar") {
    const c = await compararItens(companyId, linhas);
    return NextResponse.json({
      novos: c.novos.length,
      iguais: c.iguais,
      divergentes: c.divergentes.map((d) => ({
        chave: d.chave,
        titulo: `${d.novo.nome}${d.novo.modelo ? ` ${d.novo.modelo}` : ""}`,
        existenteResumo: d.existenteResumo,
        diffs: d.diffs,
      })),
    });
  }

  const decisoes = (body.decisoes || {}) as Record<string, Decisao>;
  const r = await importarItens(companyId, linhas, decisoes);

  await auditar(session.user as never, {
    tipo: "ALTERACAO",
    modulo: "ativos",
    acao: `Importou itens em massa: ${r.criados.length} criados, ${r.atualizados.length} atualizados, ${r.mantidos.length} mantidos`,
  });

  return NextResponse.json({
    criados: r.criados.length,
    atualizados: r.atualizados.length,
    mantidos: r.mantidos.length,
    detalhes: r,
  });
}
