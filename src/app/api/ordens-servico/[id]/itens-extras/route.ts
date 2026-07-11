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

async function getOs(osId: string, companyId: string) {
  return prisma.ordemServico.findFirst({
    where: { id: osId, companyId },
    select: { id: true },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await getOs(id, sessao.companyId)))
    return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

  const extras = await prisma.osItemExtra.findMany({
    where: { osId: id },
    include: { item: { select: { id: true, nome: true, codigo: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ extras });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await getOs(id, sessao.companyId)))
    return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

  const body = await req.json();
  const quantidade = Math.max(1, Math.min(999, parseInt(body.quantidade) || 1));
  if (!body.itemId)
    return NextResponse.json({ error: "Selecione o item" }, { status: 400 });

  const item = await prisma.item.findFirst({
    where: { id: body.itemId, companyId: sessao.companyId },
    select: { id: true },
  });
  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  // Se o item já foi lançado como extra nesta OS, soma a quantidade
  const extra = await prisma.osItemExtra.upsert({
    where: { osId_itemId: { osId: id, itemId: item.id } },
    update: {
      quantidade: { increment: quantidade },
      observacao: body.observacao?.trim() || undefined,
    },
    create: {
      osId: id,
      itemId: item.id,
      quantidade,
      observacao: body.observacao?.trim() || null,
      adicionadoPor: sessao.usuario,
    },
    include: { item: { select: { id: true, nome: true, codigo: true } } },
  });
  return NextResponse.json(extra, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await getOs(id, sessao.companyId)))
    return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

  const extraId = new URL(req.url).searchParams.get("extraId");
  if (!extraId) return NextResponse.json({ error: "extraId obrigatório" }, { status: 400 });

  const extra = await prisma.osItemExtra.findFirst({ where: { id: extraId, osId: id } });
  if (!extra) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  // Não remove se já houve movimentação deste item na conferência
  const movimentos = await prisma.osConferencia.count({
    where: { osId: id, itemId: extra.itemId },
  });
  if (movimentos > 0)
    return NextResponse.json(
      { error: "Este item já tem registros de saída/entrada nesta OS — desfaça-os antes de remover." },
      { status: 400 }
    );

  await prisma.osItemExtra.delete({ where: { id: extraId } });
  return NextResponse.json({ success: true });
}
