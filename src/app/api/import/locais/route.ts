import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { montarImportacaoLocais, type LocalImport } from "@/lib/import-bubble";
import { compararRegistros, normalizarChave, type Decisao } from "@/lib/importar-revisao";

// Importa os locais (espaços de evento) do CSV do Bubble para a empresa atual.
// POST { locaisCsv, enderecosCsv?, confirmar?, decisoes? }: sem confirmar →
// prévia + comparação com os existentes (por bubbleId ou nome); confirmar →
// cria os novos e aplica a decisão nos divergentes (manter / atualizar / criar).

export const maxDuration = 60;

type SessionUser = { companyId?: string };

const CAMPOS = [
  { campo: "rua", label: "Rua" },
  { campo: "numero", label: "Número" },
  { campo: "bairro", label: "Bairro" },
  { campo: "cidade", label: "Cidade" },
  { campo: "estado", label: "Estado" },
  { campo: "cep", label: "CEP" },
] as const;
type CampoLocal = (typeof CAMPOS)[number]["campo"];

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

  const existentes = await prisma.local.findMany({ where: { companyId } });
  const porBubble = new Map(existentes.filter((e) => e.bubbleId).map((e) => [e.bubbleId!, e]));
  const porNome = new Map(existentes.map((e) => [normalizarChave(e.nome), e]));
  // Chave de comparação: id do Bubble quando os dois lados têm; senão o nome
  const chaveDoNovo = (l: LocalImport) =>
    l.bubbleId && porBubble.has(l.bubbleId) ? `id:${l.bubbleId}` : `nome:${normalizarChave(l.nome)}`;
  const chaveDoExistente = (e: (typeof existentes)[number]) =>
    e.bubbleId ? `id:${e.bubbleId}` : `nome:${normalizarChave(e.nome)}`;
  // Existentes indexados pelas DUAS chaves (id e nome) para achar de qualquer jeito
  const achar = (l: LocalImport) =>
    (l.bubbleId && porBubble.get(l.bubbleId)) || porNome.get(normalizarChave(l.nome));

  if (!body.confirmar) {
    const comp = compararRegistros(resultado.locais, existentes, {
      chaveNovo: chaveDoNovo,
      chaveExistente: chaveDoExistente,
      idExistente: (e) => e.id,
      resumoExistente: (e) =>
        [e.rua && `${e.rua}${e.numero ? `, ${e.numero}` : ""}`, e.cidade].filter(Boolean).join(" · ") ||
        "sem endereço",
      campos: CAMPOS.map((c) => ({
        campo: c.campo,
        label: c.label,
        novo: (n: LocalImport) => n[c.campo as CampoLocal],
        atual: (e) => e[c.campo as CampoLocal],
      })),
    });
    // Locais com mesmo nome mas sem bubbleId cruzado também contam como existentes
    const jaExistemPorNome = resultado.locais.filter(
      (l) => !(l.bubbleId && porBubble.has(l.bubbleId)) && porNome.has(normalizarChave(l.nome))
    ).length;
    return NextResponse.json({
      previa: true,
      stats: resultado.stats,
      comparacao: {
        novos: comp.novos.length,
        iguais: comp.iguais,
        divergentes: comp.divergentes.map((d) => ({
          chave: d.chave,
          titulo: d.novo.nome,
          existenteResumo: d.existenteResumo,
          diffs: d.diffs,
        })),
        jaExistemPorNome,
      },
      amostra: resultado.locais.slice(0, 10).map((l) => ({
        nome: l.nome,
        rua: l.rua,
        numero: l.numero,
        cidade: l.cidade,
        completo: l.enderecoCompleto,
      })),
    });
  }

  const decisoes = (body.decisoes || {}) as Record<string, Decisao>;
  let criados = 0;
  let atualizados = 0;
  let mantidos = 0;
  let comEndereco = 0;

  for (const l of resultado.locais) {
    const decisao = decisoes[chaveDoNovo(l)];
    const existente = decisao === "criar" ? undefined : achar(l);

    if (existente) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: any = {};
      const vazio = (v: string | null) => !v || !v.trim();
      for (const c of CAMPOS) {
        const novo = l[c.campo as CampoLocal];
        if (!novo) continue;
        if (decisao === "atualizar" ? novo !== existente[c.campo as CampoLocal] : vazio(existente[c.campo as CampoLocal]))
          patch[c.campo] = novo;
      }
      if (!existente.bubbleId && l.bubbleId) patch.bubbleId = l.bubbleId;
      if (Object.keys(patch).length > 0) {
        await prisma.local.update({ where: { id: existente.id }, data: patch });
        atualizados++;
      } else mantidos++;
      continue;
    }

    const novo = await prisma.local.create({
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
    if (novo.bubbleId) porBubble.set(novo.bubbleId, novo);
    porNome.set(normalizarChave(novo.nome), novo);
  }

  return NextResponse.json({ ok: true, criados, atualizados, mantidos, pulados: mantidos, comEndereco });
}
