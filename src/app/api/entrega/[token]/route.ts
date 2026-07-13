import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// API pública do termo de permanência ("o que ficou no evento").
// GET: dados do termo para o cliente conferir. POST: registra o "de acordo"
// (nome, documento e assinatura desenhada).

interface LinhaSnapshot {
  itemId: string;
  nome: string;
  codigo: string;
  separado: number;
  ficou: number;
}

async function carregar(token: string) {
  const entrega = await prisma.osEntrega.findUnique({
    where: { publicToken: token },
    include: {
      os: {
        select: {
          orcamento: {
            select: {
              numero: true,
              eventoNome: true,
              dataInicio: true,
              cliente: { select: { nomeFantasia: true, razaoSocial: true } },
              local: { select: { nome: true } },
            },
          },
        },
      },
    },
  });
  return entrega;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const entrega = await carregar(token);
  if (!entrega) return NextResponse.json({ error: "Termo não encontrado" }, { status: 404 });

  const empresa = await prisma.company.findUnique({
    where: { id: entrega.companyId },
    select: { name: true, logoUrl: true, cnpj: true, telefone: true, email: true },
  });

  const itens = (Array.isArray(entrega.itens) ? entrega.itens : []) as unknown as LinhaSnapshot[];
  const orc = entrega.os?.orcamento;

  return NextResponse.json({
    empresa,
    evento: {
      numero: orc?.numero,
      nome: orc?.eventoNome,
      data: orc?.dataInicio,
      cliente: orc?.cliente?.nomeFantasia || orc?.cliente?.razaoSocial || "",
      local: orc?.local?.nome || "",
    },
    // Só o que efetivamente ficou com o cliente
    itens: itens.filter((i) => i.ficou > 0),
    observacoes: entrega.observacoes || "",
    aceite: entrega.aceiteEm
      ? {
          clienteNome: entrega.clienteNome,
          clienteDoc: entrega.clienteDoc,
          assinatura: entrega.aceiteAssinatura,
          em: entrega.aceiteEm,
        }
      : null,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const entrega = await prisma.osEntrega.findUnique({ where: { publicToken: token } });
  if (!entrega) return NextResponse.json({ error: "Termo não encontrado" }, { status: 404 });
  if (entrega.aceiteEm)
    return NextResponse.json({ error: "Este termo já foi aceito." }, { status: 400 });

  const body = await req.json();
  const clienteNome = String(body.clienteNome || "").trim();
  const assinatura = String(body.assinatura || "");
  if (clienteNome.length < 3)
    return NextResponse.json({ error: "Informe o nome de quem recebe." }, { status: 400 });
  if (!assinatura.startsWith("data:image/"))
    return NextResponse.json({ error: "Assinatura obrigatória." }, { status: 400 });
  if (assinatura.length > 400_000)
    return NextResponse.json({ error: "Assinatura muito grande." }, { status: 400 });

  const dispositivo = (req.headers.get("user-agent") || "").slice(0, 200);

  await prisma.osEntrega.update({
    where: { publicToken: token },
    data: {
      clienteNome,
      clienteDoc: String(body.clienteDoc || "").trim() || null,
      aceiteAssinatura: assinatura,
      aceiteEm: new Date(),
      aceiteDispositivo: dispositivo,
    },
  });

  return NextResponse.json({ ok: true });
}
