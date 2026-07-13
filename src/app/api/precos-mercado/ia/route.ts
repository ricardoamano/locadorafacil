import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { clienteIa, extrairJson, MODELO_PROPOSTA } from "@/lib/ia";

// Manutenção do Banco de Preços por comando em linguagem natural: o usuário
// escreve a orientação ("apague os preços da empresa X", "reajuste as diárias
// de som em 10%", "limpe o que tem mais de 1 ano"), a IA traduz em ações
// estruturadas, a tela mostra o plano com o total de registros afetados e a
// execução só acontece depois da confirmação do usuário.

export const maxDuration = 300;

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

const CAMPOS_VALOR = ["diaria", "semana", "quinzena", "mes"] as const;
type CampoValor = (typeof CAMPOS_VALOR)[number];

type Filtro = {
  fonte?: string | null;
  equipamento?: string | null;
  marca?: string | null;
  documento?: string | null;
  antesDe?: string | null;
  depoisDe?: string | null;
};

type Acao =
  | { tipo: "deletar"; filtro: Filtro }
  | { tipo: "atualizar"; filtro: Filtro; percentual: number; campos: CampoValor[] };

function dataValida(v: unknown): Date | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Normaliza e valida uma ação vinda da IA (ou reenviada pela tela). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizarAcao(a: any): Acao | null {
  const f = a?.filtro || {};
  const filtro: Filtro = {
    fonte: String(f.fonte || "").trim().slice(0, 200) || null,
    equipamento: String(f.equipamento || "").trim().slice(0, 200) || null,
    marca: String(f.marca || "").trim().slice(0, 80) || null,
    documento: String(f.documento || "").trim().slice(0, 200) || null,
    antesDe: dataValida(f.antesDe)?.toISOString() || null,
    depoisDe: dataValida(f.depoisDe)?.toISOString() || null,
  };
  if (a?.tipo === "deletar") return { tipo: "deletar", filtro };
  if (a?.tipo === "atualizar") {
    const percentual = Number(a.percentual);
    if (!isFinite(percentual) || percentual === 0 || percentual < -90 || percentual > 500)
      return null;
    const campos = (Array.isArray(a.campos) ? a.campos : []).filter((c: unknown): c is CampoValor =>
      (CAMPOS_VALOR as readonly string[]).includes(String(c))
    );
    return { tipo: "atualizar", filtro, percentual, campos: campos.length ? campos : [...CAMPOS_VALOR] };
  }
  return null;
}

function whereDoFiltro(companyId: string, filtro: Filtro) {
  return {
    companyId,
    ...(filtro.fonte ? { fonte: { contains: filtro.fonte, mode: "insensitive" as const } } : {}),
    ...(filtro.equipamento
      ? { equipamento: { contains: filtro.equipamento, mode: "insensitive" as const } }
      : {}),
    ...(filtro.marca ? { marca: { contains: filtro.marca, mode: "insensitive" as const } } : {}),
    ...(filtro.documento
      ? { documento: { contains: filtro.documento, mode: "insensitive" as const } }
      : {}),
    ...(filtro.antesDe || filtro.depoisDe
      ? {
          createdAt: {
            ...(filtro.antesDe ? { lt: new Date(filtro.antesDe) } : {}),
            ...(filtro.depoisDe ? { gt: new Date(filtro.depoisDe) } : {}),
          },
        }
      : {}),
  };
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  // Etapa "executar": aplica as ações já confirmadas pelo usuário.
  if (req.nextUrl.searchParams.get("etapa") === "executar") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acoes = (Array.isArray(body.acoes) ? body.acoes : [])
      .map(normalizarAcao)
      .filter((a: Acao | null): a is Acao => a !== null)
      .slice(0, 5) as Acao[];
    if (!acoes.length)
      return NextResponse.json({ error: "Nenhuma ação válida para executar" }, { status: 400 });

    let afetados = 0;
    for (const acao of acoes) {
      const where = whereDoFiltro(companyId, acao.filtro);
      if (acao.tipo === "deletar") {
        const r = await prisma.precoMercado.deleteMany({ where });
        afetados += r.count;
      } else {
        const fator = 1 + acao.percentual / 100;
        const r = await prisma.precoMercado.updateMany({
          where,
          data: Object.fromEntries(acao.campos.map((c) => [c, { multiply: fator }])),
        });
        afetados += r.count;
      }
    }
    return NextResponse.json({ afetados });
  }

  // Etapa padrão: interpreta o comando e devolve o plano com prévia.
  const comando = String(body.comando || "").trim().slice(0, 2000);
  if (!comando)
    return NextResponse.json({ error: "Escreva a orientação para a IA" }, { status: 400 });

  const ia = await clienteIa(companyId);
  if (!ia)
    return NextResponse.json(
      { error: "IA não configurada — configure em Configurações → Inteligência Artificial." },
      { status: 400 }
    );

  // Retrato do banco para a IA decidir com contexto real.
  const [total, grupos] = await Promise.all([
    prisma.precoMercado.count({ where: { companyId } }),
    prisma.precoMercado.groupBy({
      by: ["fonte", "documento"],
      where: { companyId },
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
      orderBy: { fonte: "asc" },
      take: 60,
    }),
  ]);
  const retrato = grupos.map((g) => ({
    fonte: g.fonte,
    documento: g.documento,
    registros: g._count._all,
    importadoDe: g._min.createdAt?.toISOString().slice(0, 10),
    importadoAte: g._max.createdAt?.toISOString().slice(0, 10),
  }));

  try {
    const resposta = await ia.messages.create({
      model: MODELO_PROPOSTA,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Você administra o Banco de Preços de Mercado de uma locadora de equipamentos para eventos. Cada registro tem: equipamento, marca, modelo, fonte (empresa de origem), documento (arquivo de origem), valores (diaria, semana, quinzena, mes) e createdAt (data da importação).

Hoje é ${new Date().toISOString().slice(0, 10)}. Estado atual do banco (${total} registros no total), agrupado por fonte/documento:
${JSON.stringify(retrato)}

Orientação do usuário: "${comando}"

Responda APENAS com um JSON válido:
{
  "resposta": "explicação curta em português do que será feito — ou, se a orientação for só uma pergunta, a resposta a ela",
  "acoes": [
    { "tipo": "deletar", "filtro": { "fonte": "trecho do nome ou null", "equipamento": "trecho ou null", "marca": "trecho ou null", "documento": "trecho ou null", "antesDe": "ISO — registros importados ANTES desta data, ou null", "depoisDe": "ISO ou null" } },
    { "tipo": "atualizar", "filtro": { ... }, "percentual": 10, "campos": ["diaria","semana","quinzena","mes"] }
  ]
}

Regras: os filtros usam "contém" (case-insensitive); filtro todo null atinge o banco INTEIRO — só use assim se o usuário pediu explicitamente. "percentual" reajusta os valores (10 = +10%, -5 = -5%). Máximo 5 ações. Se for apenas pergunta ou se a orientação não fizer sentido para este banco, devolva "acoes": [] e explique em "resposta". Não invente fontes/documentos que não estão no estado atual.`,
        },
      ],
    });
    const texto = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const dados = extrairJson(texto);
    if (!dados)
      return NextResponse.json(
        { error: "A IA não retornou um plano válido — tente reformular a orientação." },
        { status: 422 }
      );

    const acoes = (Array.isArray(dados.acoes) ? dados.acoes : [])
      .map(normalizarAcao)
      .filter((a): a is Acao => a !== null)
      .slice(0, 5);

    // Prévia: quantos registros cada ação atinge, antes de qualquer alteração.
    const previa = await Promise.all(
      acoes.map(async (a) => ({
        ...a,
        afetados: await prisma.precoMercado.count({
          where: whereDoFiltro(companyId, a.filtro),
        }),
      }))
    );

    return NextResponse.json({
      resposta: String(dados.resposta || "").slice(0, 2000),
      acoes: previa,
      totalAfetados: previa.reduce((s, a) => s + a.afetados, 0),
    });
  } catch (e) {
    console.error("[precos-mercado/ia] Erro:", e);
    const msg = e instanceof Error ? e.message : "Erro na análise";
    return NextResponse.json({ error: `Erro ao interpretar a orientação: ${msg}` }, { status: 502 });
  }
}
