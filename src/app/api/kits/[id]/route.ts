import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.kit.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const itens = (Array.isArray(body.itens) ? body.itens : []).filter(
    (i: { itemId?: string }) => i.itemId
  );
  if (body.nome !== undefined && !body.nome?.trim())
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const kit = await prisma.$transaction(async (tx) => {
    await tx.kitItem.deleteMany({ where: { kitId: id } });
    return tx.kit.update({
      where: { id },
      data: {
        nome: body.nome?.trim() || existing.nome,
        descricao: body.descricao?.trim() || null,
        itens: {
          create: itens.map((i: { itemId: string; quantidade?: number; valorUnitario?: number | null }) => ({
            itemId: i.itemId,
            quantidade: Math.max(1, parseInt(String(i.quantidade)) || 1),
          })),
        },
      },
      include: { itens: { include: { item: { select: { nome: true, valorAluguel: true } } } } },
    });
  });
  return NextResponse.json(kit);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.kit.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.kit.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
