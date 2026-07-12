import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { clienteIa, extrairJson, MODELO_PROPOSTA } from "@/lib/ia";
import { lerDocumentoDaRequisicao } from "@/lib/documentos";

// Banco de Preços de Mercado — alimentado por orçamentos de concorrentes/
// parceiros em PDF, planilha (XLSX/CSV), DOCX, TXT/MD ou texto colado.
// A IA lê o documento e extrai os preços por equipamento.

// A análise do documento pela IA leva dezenas de segundos; sem isso a função
// é encerrada pela Vercel antes de gravar no banco (padrão pode ser 10-15s).
export const maxDuration = 60;

type SessionUser = { companyId?: string };

type ItemExtraido = {
  equipamento?: unknown;
  marca?: unknown;
  modelo?: unknown;
  diaria?: unknown;
  semana?: unknown;
  quinzena?: unknown;
  mes?: unknown;
};

// Recupera os itens mesmo quando a resposta da IA veio truncada (JSON
// incompleto por estourar max_tokens): aproveita cada objeto completo.
function extrairItens(texto: string): ItemExtraido[] {
  const dados = extrairJson(texto);
  if (Array.isArray(dados?.itens)) return dados.itens as ItemExtraido[];
  const inicio = texto.indexOf('"itens"');
  if (inicio === -1) return [];
  const itens: ItemExtraido[] = [];
  const re = /\{[^{}]*\}/g;
  re.lastIndex = inicio;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    try {
      const o = JSON.parse(m[0]) as ItemExtraido;
      if (o?.equipamento) itens.push(o);
    } catch {
      // objeto cortado no meio — ignora
    }
  }
  return itens;
}

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function GET(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const busca = req.nextUrl.searchParams.get("busca") || "";
  const registros = await prisma.precoMercado.findMany({
    where: {
      companyId,
      ...(busca
        ? {
            OR: [
              { equipamento: { contains: busca, mode: "insensitive" as const } },
              { modelo: { contains: busca, mode: "insensitive" as const } },
              { marca: { contains: busca, mode: "insensitive" as const } },
              { fonte: { contains: busca, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return NextResponse.json({ registros });
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ia = await clienteIa(companyId);
  if (!ia)
    return NextResponse.json(
      { error: "IA não configurada — configure em Configurações → Inteligência Artificial." },
      { status: 400 }
    );

  // Entrada: JSON { texto } (colado na tela) ou multipart com um arquivo
  // (PDF, XLSX/XLS, CSV, DOCX, TXT, MD) — tratado em src/lib/documentos.ts.
  const entrada = await lerDocumentoDaRequisicao(req);
  if ("erro" in entrada)
    return NextResponse.json({ error: entrada.erro }, { status: entrada.status });
  const { blocos, nomeDocumento, extras } = entrada;
  // Empresa fonte informada pelo usuário — vale mais que a detecção da IA
  // (útil quando o documento não traz o nome da empresa).
  const fonteInformada = String(extras.fonte || "").trim().slice(0, 200);

  try {
    const resposta = await ia.messages.create({
      model: MODELO_PROPOSTA,
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            ...blocos,
            {
              type: "text",
              text: `O documento acima é um orçamento/proposta ou tabela de preços de uma empresa de locação de equipamentos para eventos. Extraia os preços de locação por equipamento.

Responda APENAS com um JSON válido:
{
  "fonte": "nome da empresa que EMITIU este orçamento (a que tem os equipamentos), ou null se o documento não identificar a empresa — NUNCA invente nem escreva 'não identificado'",
  "itens": [
    {
      "equipamento": "nome do equipamento como está no documento",
      "marca": "marca se identificável, ou null",
      "modelo": "modelo se identificável, ou null",
      "diaria": valor unitário da diária em reais (número, ou null),
      "semana": valor semanal unitário se houver (número ou null),
      "quinzena": valor quinzenal unitário se houver (número ou null),
      "mes": valor mensal unitário se houver (número ou null)
    }
  ]
}

Regras: valores UNITÁRIOS (divida pelo número de unidades e diárias se o documento mostrar subtotais). Ignore taxas de frete, montagem e serviços de mão de obra. Se o período de locação for de N diárias com valor total, calcule a diária unitária.`,
            },
          ],
        },
      ],
    });
    const texto = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const itens = extrairItens(texto);
    if (itens.length === 0) {
      console.error(
        "[precos-mercado] IA não retornou itens.",
        "stop_reason:", resposta.stop_reason,
        "resposta:", texto.slice(0, 500)
      );
      return NextResponse.json(
        { error: "A IA não encontrou preços de equipamentos neste documento." },
        { status: 422 }
      );
    }

    const dados = extrairJson(texto);
    let fonteTexto =
      String(dados?.fonte || "").trim() ||
      /"fonte"\s*:\s*"([^"]+)"/.exec(texto)?.[1]?.trim() ||
      "";
    if (/não identificad|nao identificad|desconhecid|^null$/i.test(fonteTexto)) fonteTexto = "";
    const fonte =
      fonteInformada || fonteTexto || nomeDocumento.replace(/\.[a-z0-9]+$/i, "");
    const criados = await prisma.precoMercado.createMany({
      data: itens
        .filter((i) => i?.equipamento)
        .slice(0, 100)
        .map((i) => ({
          companyId,
          equipamento: String(i.equipamento).slice(0, 200),
          marca: i.marca ? String(i.marca).slice(0, 80) : null,
          modelo: i.modelo ? String(i.modelo).slice(0, 120) : null,
          fonte,
          diaria: i.diaria != null ? Number(i.diaria) : null,
          semana: i.semana != null ? Number(i.semana) : null,
          quinzena: i.quinzena != null ? Number(i.quinzena) : null,
          mes: i.mes != null ? Number(i.mes) : null,
          documento: nomeDocumento,
        })),
    });

    return NextResponse.json(
      {
        fonte,
        importados: criados.count,
        parcial: resposta.stop_reason === "max_tokens",
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[precos-mercado] Erro na importação:", e);
    const msg = e instanceof Error ? e.message : "Erro na análise";
    return NextResponse.json(
      { error: `Erro ao analisar o documento: ${msg}` },
      { status: 502 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  const documento = req.nextUrl.searchParams.get("documento");
  if (id) {
    await prisma.precoMercado.deleteMany({ where: { id, companyId } });
  } else if (documento) {
    await prisma.precoMercado.deleteMany({ where: { documento, companyId } });
  } else {
    return NextResponse.json({ error: "Informe id ou documento" }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
