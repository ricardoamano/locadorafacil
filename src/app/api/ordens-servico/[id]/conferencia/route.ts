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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function montarResumo(os: any, eventos: { itemId: string; tipo: string; quantidade: number }[]) {
  // Quantidade esperada por item (somando todas as salas)
  const esperado = new Map<
    string,
    { itemId: string; nome: string; codigo: string; apelidos: string | null; descricaoComercial: string | null; quantidade: number }
  >();
  for (const sala of os.orcamento?.salas || []) {
    for (const si of sala.itens || []) {
      if (!si.item) continue;
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
        });
    }
  }

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
    include: { item: { select: { nome: true, codigo: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    resumo: montarResumo(os, eventos),
    eventos: eventos.slice(0, 30),
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

  // Resolve o item: por id direto ou por código lido no QR
  let itemId: string | null = body.itemId || null;
  if (!itemId && body.codigo) {
    const codigo = String(body.codigo).trim();
    const item = await prisma.item.findFirst({
      where: { companyId: sessao.companyId, codigo: { equals: codigo, mode: "insensitive" } },
      select: { id: true },
    });
    // QR antigo pode conter o próprio id do item
    itemId = item?.id || (await prisma.item.findFirst({
      where: { companyId: sessao.companyId, id: codigo },
      select: { id: true },
    }))?.id || null;
  }
  if (!itemId)
    return NextResponse.json(
      { error: "Item não encontrado. Confira o código ou use a busca." },
      { status: 404 }
    );

  // O item precisa fazer parte do orçamento desta OS
  const idsDaOs = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const sala of (os as any).orcamento?.salas || [])
    for (const si of sala.itens || []) if (si.item) idsDaOs.add(si.item.id);
  if (!idsDaOs.has(itemId)) {
    const item = await prisma.item.findUnique({ where: { id: itemId }, select: { nome: true } });
    return NextResponse.json(
      { error: `"${item?.nome || "Item"}" não faz parte dos equipamentos desta OS.` },
      { status: 400 }
    );
  }

  const evento = await prisma.osConferencia.create({
    data: { osId: id, itemId, tipo, quantidade, registradoPor: sessao.usuario },
    include: { item: { select: { nome: true, codigo: true } } },
  });

  const eventos = await prisma.osConferencia.findMany({ where: { osId: id } });
  return NextResponse.json(
    { evento, resumo: montarResumo(os, eventos) },
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

  await prisma.osConferencia.delete({ where: { id: eventoId } });
  return NextResponse.json({ success: true });
}
