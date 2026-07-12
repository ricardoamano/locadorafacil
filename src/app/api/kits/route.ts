import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const kits = await prisma.kit.findMany({
    where: { companyId },
    orderBy: { nome: "asc" },
    include: {
      itens: {
        include: {
          item: {
            select: {
              id: true,
              nome: true,
              codigo: true,
              valorAluguel: true,
              natureza: true,
              descricaoComercial: true,
            },
          },
        },
      },
    },
  });
  return NextResponse.json({ kits });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  const itens = (Array.isArray(body.itens) ? body.itens : []).filter(
    (i: { itemId?: string }) => i.itemId
  );
  if (itens.length === 0)
    return NextResponse.json({ error: "Adicione ao menos um item ao kit" }, { status: 400 });

  const kit = await prisma.kit.create({
    data: {
      nome: body.nome.trim(),
      descricao: body.descricao?.trim() || null,
      companyId,
      itens: {
        create: itens.map((i: { itemId: string; quantidade?: number }) => ({
          itemId: i.itemId,
          quantidade: Math.max(1, parseInt(String(i.quantidade)) || 1),
        })),
      },
    },
    include: { itens: { include: { item: { select: { nome: true } } } } },
  });
  return NextResponse.json(kit, { status: 201 });
}
