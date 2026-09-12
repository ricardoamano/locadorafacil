import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { bubbleConfigurado } from "@/lib/bubble-api";
import {
  lerCsvMembros, lerEquipeBubble, compararMembros, importarMembros, type LinhaMembro,
} from "@/lib/membros-importar";
import type { Decisao } from "@/lib/importar-revisao";

// Importa membros da equipe. POST { origem: "csv" | "bubble", csv?, confirmar?, decisoes? }
// Sem confirmar → prévia + comparação (nada gravado). Com confirmar → grava
// aplicando as decisões dos divergentes (manter / atualizar / criar).

export const maxDuration = 120;

type SessionUser = { companyId?: string };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const origem = body.origem === "bubble" ? "bubble" : "csv";

  let linhas: LinhaMembro[];
  let colunas: { reconhecidas: string[]; ignoradas: string[] } | undefined;
  try {
    if (origem === "bubble") {
      const c = await prisma.company.findUnique({
        where: { id: companyId },
        select: { bubbleAppUrl: true, bubbleApiToken: true },
      });
      if (!bubbleConfigurado(c))
        return NextResponse.json(
          { error: "Configure a conexão com o Bubble em Configurações → Migração do Bubble." },
          { status: 400 }
        );
      linhas = await lerEquipeBubble(c!);
    } else {
      const csv = String(body.csv || "");
      if (!csv.trim()) return NextResponse.json({ error: "Envie o arquivo CSV." }, { status: 400 });
      const r = lerCsvMembros(csv);
      linhas = r.linhas;
      colunas = { reconhecidas: r.colunasReconhecidas, ignoradas: r.colunasIgnoradas };
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não consegui ler os dados." },
      { status: 400 }
    );
  }
  if (linhas.length === 0)
    return NextResponse.json({ error: "Nenhum membro encontrado para importar." }, { status: 400 });

  if (!body.confirmar) {
    const comparacao = await compararMembros(companyId, linhas);
    return NextResponse.json({ previa: true, origem, colunas, comparacao });
  }

  const rel = await importarMembros(companyId, linhas, (body.decisoes || {}) as Record<string, Decisao>);
  await auditar(session.user as never, {
    tipo: "ALTERACAO",
    modulo: "equipe",
    acao: `Importou equipe (${origem}): ${rel.criados} novos, ${rel.atualizados} atualizados`,
  });
  return NextResponse.json({ ok: true, ...rel });
}
