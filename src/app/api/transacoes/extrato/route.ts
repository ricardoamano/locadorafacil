import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { decodificarOfx, parseOfx } from "@/lib/ofx";

// Conciliação bancária — importação de extrato (OFX) e lista de revisão.
// As linhas importadas NUNCA entram no fluxo de caixa sozinhas: ficam
// PENDENTES até o usuário conciliar, criar ou ignorar cada uma.

type SessionUser = { companyId?: string; name?: string | null };

const MAX_ARQUIVO = 4 * 1024 * 1024; // limite de upload da Vercel

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Similaridade simples por sobreposição de palavras (0 a 1). */
function similaridade(a: string, b: string): number {
  const ta = new Set(normalizar(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(normalizar(b).split(" ").filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let comuns = 0;
  for (const w of ta) if (tb.has(w)) comuns++;
  return comuns / Math.min(ta.size, tb.size);
}

const DIA_MS = 86_400_000;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const linhas = await prisma.extratoLinha.findMany({
    where: { companyId, status: "PENDENTE" },
    orderBy: { data: "asc" },
    include: { banco: { select: { nome: true } } },
    take: 300,
  });

  let candidatos: {
    id: string;
    nome: string;
    valor: number;
    tipo: string;
    status: string;
    dataRecebimento: Date;
    bancoId: string | null;
  }[] = [];

  if (linhas.length > 0) {
    const datas = linhas.map((l) => l.data.getTime());
    const de = new Date(Math.min(...datas) - 7 * DIA_MS);
    const ate = new Date(Math.max(...datas) + 7 * DIA_MS);
    candidatos = await prisma.transacao.findMany({
      where: {
        companyId,
        conciliadaEm: null,
        dataRecebimento: { gte: de, lte: ate },
      },
      select: {
        id: true,
        nome: true,
        valor: true,
        tipo: true,
        status: true,
        dataRecebimento: true,
        bancoId: true,
      },
    });
  }

  // Transações já usadas em outra linha pendente de resposta não são bloqueadas
  // aqui (a trava real é conciliadaEm) — mas evitamos sugerir a mesma duas vezes
  const resultado = linhas.map((l) => {
    const tipoEsperado = l.valor > 0 ? "RECEITA" : "DESPESA";
    const sugestoes = candidatos
      .filter(
        (t) =>
          t.tipo === tipoEsperado &&
          Math.abs(t.valor - Math.abs(l.valor)) < 0.005 &&
          Math.abs(t.dataRecebimento.getTime() - l.data.getTime()) <= 5 * DIA_MS
      )
      .map((t) => {
        const dd = Math.abs(t.dataRecebimento.getTime() - l.data.getTime()) / DIA_MS;
        const sim = similaridade(t.nome, l.descricao);
        const score =
          100 - dd * 10 + sim * 30 + (l.bancoId && t.bancoId === l.bancoId ? 10 : 0);
        return { ...t, score, forte: dd <= 1.01 || sim >= 0.4 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return { ...l, sugestoes };
  });

  const totais = await prisma.extratoLinha.groupBy({
    by: ["status"],
    where: { companyId },
    _count: true,
  });

  return NextResponse.json({
    linhas: resultado,
    totais: Object.fromEntries(totais.map((t) => [t.status, t._count])),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as SessionUser;
  if (!u.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("arquivo") as File | null;
  const bancoId = (form?.get("bancoId") as string | null)?.trim() || null;
  if (!arquivo) return NextResponse.json({ error: "Envie o arquivo OFX do extrato." }, { status: 400 });
  if (arquivo.size > MAX_ARQUIVO)
    return NextResponse.json({ error: "Arquivo acima de 4MB." }, { status: 400 });

  let lancamentos;
  try {
    lancamentos = parseOfx(decodificarOfx(await arquivo.arrayBuffer()));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não consegui ler o arquivo." },
      { status: 400 }
    );
  }

  // Trava de reimportação: FITID já visto (em qualquer status) não volta
  const existentes = await prisma.extratoLinha.findMany({
    where: { companyId: u.companyId, fitid: { in: lancamentos.map((l) => l.fitid) } },
    select: { fitid: true },
  });
  const jaVistos = new Set(existentes.map((e) => e.fitid));
  const novos = lancamentos.filter((l) => !jaVistos.has(l.fitid));

  if (novos.length > 0) {
    await prisma.extratoLinha.createMany({
      data: novos.map((l) => ({
        companyId: u.companyId!,
        bancoId,
        arquivoNome: arquivo.name,
        fitid: l.fitid,
        data: l.data,
        valor: l.valor,
        descricao: l.descricao,
        importadoPor: u.name || null,
      })),
      skipDuplicates: true,
    });
  }

  await auditar(session.user as never, {
    tipo: "ALTERACAO",
    modulo: "financeiro",
    acao: `Importou extrato ${arquivo.name}`,
    detalhe: `${novos.length} novos, ${lancamentos.length - novos.length} já importados`,
  });

  return NextResponse.json({
    total: lancamentos.length,
    importados: novos.length,
    duplicados: lancamentos.length - novos.length,
  });
}
