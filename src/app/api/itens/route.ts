import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(search
      ? {
          OR: [
            { nome: { contains: search } },
            { codigo: { contains: search } },
          ],
        }
      : {}),
  };

  const [itens, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        categoria: { select: { id: true, nome: true } },
        marca: { select: { id: true, nome: true } },
      },
      orderBy: { nome: "asc" },
      skip,
      take: limit,
    }),
    prisma.item.count({ where }),
  ]);

  return NextResponse.json({ itens, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  const { id: _id, categoria: _c, marca: _m, ...data } = body;

  const item = await prisma.item.create({
    data: {
      codigo: data.codigo || "",
      nome: data.nome,
      valorAluguel: Number(data.valorAluguel) || 0,
      tipo: data.tipo || "PROPRIO",
      quantidade: Number(data.quantidade) || 0,
      especificacoes: data.especificacoes || null,
      emCatalogo: data.emCatalogo ?? true,
      categoriaId: data.categoriaId || null,
      companyId,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
