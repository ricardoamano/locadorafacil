import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { montarImportacaoLocais } from "@/lib/import-bubble";

// Importa os locais (espaços de evento) do CSV do Bubble para a empresa atual,
// guardando o id de origem (bubbleId) para cruzar orçamentos/faturas depois.
// POST { locaisCsv, enderecosCsv?, confirmar? }: sem confirmar → prévia.

export const maxDuration = 60;

type SessionUser = { companyId?: string };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  const locaisCsv = String(body.locaisCsv || "");
  const enderecosCsv = body.enderecosCsv ? String(body.enderecosCsv) : undefined;
  if (!locaisCsv.trim())
    return NextResponse.json({ error: "Envie o arquivo de locais." }, { status: 400 });

  let resultado;
  try {
    resultado = montarImportacaoLocais(locaisCsv, enderecosCsv);
  } catch {
    return NextResponse.json(
      { error: "Não consegui ler o arquivo. Confira se é o CSV de Locais do Bubble." },
      { status: 400 }
    );
  }

  if (!body.confirmar) {
    return NextResponse.json({
      previa: true,
      stats: resultado.stats,
      amostra: resultado.locais.slice(0, 10).map((l) => ({
        nome: l.nome,
        rua: l.rua,
        numero: l.numero,
        cidade: l.cidade,
        completo: l.enderecoCompleto,
      })),
    });
  }

  // Grava — não duplica (por bubbleId, ou por nome se não houver id)
  const existentes = await prisma.local.findMany({
    where: { companyId },
    select: { nome: true, bubbleId: true },
  });
  const idsExistentes = new Set(existentes.map((e) => e.bubbleId).filter(Boolean));
  const nomesExistentes = new Set(existentes.map((e) => e.nome.trim().toLowerCase()));

  let criados = 0;
  let pulados = 0;
  let comEndereco = 0;

  for (const l of resultado.locais) {
    const dupPorId = l.bubbleId && idsExistentes.has(l.bubbleId);
    const dupPorNome = !l.bubbleId && nomesExistentes.has(l.nome.trim().toLowerCase());
    if (dupPorId || dupPorNome) {
      pulados++;
      continue;
    }
    await prisma.local.create({
      data: {
        nome: l.nome,
        rua: l.rua,
        cep: l.cep,
        numero: l.numero,
        bairro: l.bairro,
        cidade: l.cidade,
        estado: l.estado,
        bubbleId: l.bubbleId,
        companyId,
      },
    });
    criados++;
    if (l.enderecoCompleto) comEndereco++;
    if (l.bubbleId) idsExistentes.add(l.bubbleId);
    nomesExistentes.add(l.nome.trim().toLowerCase());
  }

  return NextResponse.json({ ok: true, criados, pulados, comEndereco });
}
