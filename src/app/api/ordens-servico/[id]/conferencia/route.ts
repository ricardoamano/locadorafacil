import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string; name?: string | null; email?: string | null };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (!u.companyId) return null;
  return { companyId: u.companyId, usuario: u.name || u.email || "sistema" };
}

async function getOsComItens(osId: string, companyId: string) {
  return prisma.ordemServico.findFirst({
    where: { id: osId, companyId },
    include: {
      orcamento: {
        include: {
          salas: {
            include: {
              itens: {
                include: {
                  item: {
                    select: {
                      id: true,
                      nome: true,
                      codigo: true,
                      apelidos: true,
                      descricaoComercial: true,
                      natureza: true,
                      acessoriosAvulsos: { select: { nome: true, quantidade: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

type ItemEsperado = {
  itemId: string;
  nome: string;
  codigo: string;
  apelidos: string | null;
  descricaoComercial: string | null;
  quantidade: number;
  extra: boolean;
  acessorios: { nome: string; quantidade: number }[];
};

// Itens da OS = itens do orçamento + itens lançados direto na OS (extras)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function itensDaOs(os: any): Promise<Map<string, ItemEsperado>> {
  const esperado = new Map<string, ItemEsperado>();
  for (const sala of os.orcamento?.salas || []) {
    for (const si of sala.itens || []) {
      if (!si.item) continue;
      // Serviços não movimentam estoque — ficam fora da conferência
      if (si.item.natureza === "SERVICO") continue;
      const atual = esperado.get(si.item.id);
      if (atual) atual.quantidade += si.quantidade || 0;
      else
        esperado.set(si.item.id, {
          itemId: si.item.id,
          nome: si.item.nome,
          codigo: si.item.codigo || "",
          apelidos: si.item.apelidos || null,
          descricaoComercial: si.descricaoComercial || si.item.descricaoComercial || null,
          quantidade: si.quantidade || 0,
          extra: false,
          acessorios: si.item.acessoriosAvulsos || [],
        });
    }
  }

  const extras = await prisma.osItemExtra.findMany({
    where: { osId: os.id },
    include: {
      item: { select: { id: true, nome: true, codigo: true, apelidos: true, descricaoComercial: true, natureza: true } },
    },
  });
  for (const ex of extras) {
    if (ex.item.natureza === "SERVICO") continue;
    const atual = esperado.get(ex.itemId);
    if (atual) atual.quantidade += ex.quantidade;
    else
      esperado.set(ex.itemId, {
        itemId: ex.itemId,
        nome: ex.item.nome,
        codigo: ex.item.codigo || "",
        apelidos: ex.item.apelidos || null,
        descricaoComercial: ex.item.descricaoComercial || null,
        quantidade: ex.quantidade,
        extra: true,
        acessorios: [],
      });
  }
  return esperado;
}

function montarResumo(
  esperado: Map<string, ItemEsperado>,
  eventos: { itemId: string; tipo: string; quantidade: number }[]
) {
  const saidas = new Map<string, number>();
  const entradas = new Map<string, number>();
  for (const ev of eventos) {
    const mapa = ev.tipo === "SAIDA" ? saidas : entradas;
    mapa.set(ev.itemId, (mapa.get(ev.itemId) || 0) + ev.quantidade);
  }
  return Array.from(esperado.values()).map((e) => ({
    ...e,
    saida: saidas.get(e.itemId) || 0,
    entrada: entradas.get(e.itemId) || 0,
  }));
}

async function unidadesDaOs(osId: string, itemIds: string[]) {
  if (itemIds.length === 0) return [];
  const unidades = await prisma.itemUnidade.findMany({
    where: { itemId: { in: itemIds }, status: { not: "BAIXADA" } },
    orderBy: [{ itemId: "asc" }, { numero: "asc" }],
    include: {
      item: { select: { nome: true } },
      os: { select: { id: true, orcamento: { select: { numero: true, eventoNome: true } } } },
    },
  });
  return unidades.map((u) => ({
    id: u.id,
    codigo: u.codigo,
    numero: u.numero,
    status: u.status,
    itemId: u.itemId,
    itemNome: u.item.nome,
    osAtualId: u.osId,
    osAtualNumero: u.os?.orcamento?.numero ?? null,
    osAtualEvento: u.os?.orcamento?.eventoNome ?? null,
  }));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const os = await getOsComItens(id, sessao.companyId);
  if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

  const eventos = await prisma.osConferencia.findMany({
    where: { osId: id },
    include: {
      item: { select: { nome: true, codigo: true } },
      unidade: { select: { codigo: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const esperado = await itensDaOs(os);
  return NextResponse.json({
    resumo: montarResumo(esperado, eventos),
    eventos: eventos.slice(0, 30),
    unidades: await unidadesDaOs(id, Array.from(esperado.keys())),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const tipo = body.tipo === "ENTRADA" ? "ENTRADA" : "SAIDA";
  const quantidade = Math.max(1, Math.min(999, parseInt(body.quantidade) || 1));

  const os = await getOsComItens(id, sessao.companyId);
  if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });
  const esperado = await itensDaOs(os);

  // 1) Resolve unidade específica (bipada por QR ou escolhida na busca)
  let unidade = null;
  if (body.unidadeId) {
    unidade = await prisma.itemUnidade.findFirst({
      where: { id: body.unidadeId, companyId: sessao.companyId },
      include: { os: { select: { orcamento: { select: { numero: true } } } } },
    });
  } else if (body.codigo) {
    const codigo = String(body.codigo).trim();
    unidade = await prisma.itemUnidade.findFirst({
      where: { companyId: sessao.companyId, codigo: { equals: codigo, mode: "insensitive" } },
      include: { os: { select: { orcamento: { select: { numero: true } } } } },
    });
  }

  let itemId: string | null = unidade?.itemId || body.itemId || null;

  // 2) Sem unidade: código pode ser de item (QR antigo) — registro por quantidade
  if (!unidade && !itemId && body.codigo) {
    const codigo = String(body.codigo).trim();
    const item = await prisma.item.findFirst({
      where: { companyId: sessao.companyId, codigo: { equals: codigo, mode: "insensitive" } },
      select: { id: true },
    });
    itemId = item?.id || null;
  }

  if (!itemId)
    return NextResponse.json(
      { error: "Código não encontrado. Confira a etiqueta ou use a busca." },
      { status: 404 }
    );

  if (!esperado.has(itemId)) {
    const item = await prisma.item.findUnique({ where: { id: itemId }, select: { nome: true } });
    return NextResponse.json(
      { error: `"${item?.nome || "Item"}" não faz parte desta OS — lance-o em "Adicionar item avulso" para poder movimentá-lo.` },
      { status: 400 }
    );
  }

  // 3) Regras de movimentação por unidade (rastreio real de estoque)
  if (unidade) {
    if (unidade.status === "BAIXADA" || unidade.status === "MANUTENCAO")
      return NextResponse.json(
        { error: `Unidade ${unidade.codigo} está em ${unidade.status === "MANUTENCAO" ? "manutenção" : "baixa"} e não pode ser movimentada.` },
        { status: 400 }
      );
    if (tipo === "SAIDA") {
      if (unidade.status === "NO_EVENTO") {
        const onde = unidade.osId === id
          ? "já saiu para esta OS"
          : `está no evento da OS #${unidade.os?.orcamento?.numero ?? "?"}`;
        return NextResponse.json(
          { error: `Unidade ${unidade.codigo} ${onde}.` },
          { status: 400 }
        );
      }
    } else {
      if (unidade.status !== "NO_EVENTO")
        return NextResponse.json(
          { error: `Unidade ${unidade.codigo} não está em evento — nada a devolver.` },
          { status: 400 }
        );
      if (unidade.osId && unidade.osId !== id)
        return NextResponse.json(
          { error: `Unidade ${unidade.codigo} saiu pela OS #${unidade.os?.orcamento?.numero ?? "?"} — registre a entrada por lá.` },
          { status: 400 }
        );
    }
  }

  const [evento] = await prisma.$transaction([
    prisma.osConferencia.create({
      data: {
        osId: id,
        itemId,
        unidadeId: unidade?.id || null,
        tipo,
        quantidade: unidade ? 1 : quantidade,
        registradoPor: sessao.usuario,
      },
      include: {
        item: { select: { nome: true, codigo: true } },
        unidade: { select: { codigo: true } },
      },
    }),
    ...(unidade
      ? [
          prisma.itemUnidade.update({
            where: { id: unidade.id },
            data:
              tipo === "SAIDA"
                ? { status: "NO_EVENTO", osId: id }
                : { status: "EM_ESTOQUE", osId: null },
          }),
        ]
      : []),
  ]);

  const eventos = await prisma.osConferencia.findMany({ where: { osId: id } });
  return NextResponse.json(
    { evento, resumo: montarResumo(esperado, eventos) },
    { status: 201 }
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const eventoId = new URL(req.url).searchParams.get("eventoId");
  if (!eventoId) return NextResponse.json({ error: "eventoId obrigatório" }, { status: 400 });

  const os = await prisma.ordemServico.findFirst({
    where: { id, companyId: sessao.companyId },
    select: { id: true },
  });
  if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

  const evento = await prisma.osConferencia.findFirst({ where: { id: eventoId, osId: id } });
  if (!evento) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  // Desfazer também reverte o estado da unidade movimentada
  await prisma.$transaction([
    prisma.osConferencia.delete({ where: { id: eventoId } }),
    ...(evento.unidadeId
      ? [
          prisma.itemUnidade.update({
            where: { id: evento.unidadeId },
            data:
              evento.tipo === "SAIDA"
                ? { status: "EM_ESTOQUE", osId: null }
                : { status: "NO_EVENTO", osId: id },
          }),
        ]
      : []),
  ]);
  return NextResponse.json({ success: true });
}
