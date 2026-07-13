import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Subcategorias de itens (ex.: Áudio → Microfones, Caixas, Mesas)

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const nome = String(body.nome || "").trim();
  const categoriaId = String(body.categoriaId || "");
  if (!nome || !categoriaId)
    return NextResponse.json({ error: "Nome e categoria obrigatórios" }, { status: 400 });

  const categoria = await prisma.categoria.findFirst({
    where: { id: categoriaId, companyId },
    select: { id: true },
  });
  if (!categoria) return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });

  const existe = await prisma.subCategoria.findFirst({
    where: { categoriaId, nome: { equals: nome, mode: "insensitive" as const } },
  });
  if (existe) return NextResponse.json(existe, { status: 200 });

  const sub = await prisma.subCategoria.create({
    data: { nome, categoriaId },
  });
  return NextResponse.json(sub, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") || "";
  const sub = await prisma.subCategoria.findFirst({
    where: { id, categoria: { companyId } },
    select: { id: true },
  });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Itens que apontavam para ela ficam sem subcategoria (não são excluídos)
  await prisma.item.updateMany({ where: { subCategoriaId: id }, data: { subCategoriaId: null } });
  await prisma.subCategoria.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
