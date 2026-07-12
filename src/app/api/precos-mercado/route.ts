import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { clienteIa, extrairJson, MODELO_PROPOSTA } from "@/lib/ia";

// Banco de Preços de Mercado — alimentado por PDFs de orçamentos de
// concorrentes/parceiros. A IA lê o PDF e extrai os preços por equipamento.

// A análise do PDF pela IA leva dezenas de segundos; sem isso a função é
// encerrada pela Vercel antes de gravar no banco (padrão pode ser 10-15s).
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

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string")
    return NextResponse.json({ error: "Envie um PDF" }, { status: 400 });
  if (file.type !== "application/pdf")
    return NextResponse.json({ error: "Apenas arquivos PDF" }, { status: 400 });
  if (file.size > 4 * 1024 * 1024)
    return NextResponse.json({ error: "PDF muito grande — limite de 4 MB" }, { status: 400 });

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const resposta = await ia.messages.create({
      model: MODELO_PROPOSTA,
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: `Este é um orçamento/proposta de uma empresa de locação de equipamentos para eventos. Extraia os preços de locação por equipamento.

Responda APENAS com um JSON válido:
{
  "fonte": "nome da empresa que EMITIU este orçamento (a que tem os equipamentos)",
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
        { error: "A IA não encontrou preços de equipamentos neste PDF." },
        { status: 422 }
      );
    }

    const dados = extrairJson(texto);
    const fonteTexto =
      String(dados?.fonte || "").trim() ||
      /"fonte"\s*:\s*"([^"]+)"/.exec(texto)?.[1]?.trim() ||
      "";
    const fonte = fonteTexto || file.name.replace(/\.pdf$/i, "");
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
          documento: file.name,
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
    return NextResponse.json({ error: `Erro ao analisar o PDF: ${msg}` }, { status: 502 });
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
