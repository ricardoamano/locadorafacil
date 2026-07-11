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
            { nome: { contains: search, mode: "insensitive" as const } },
            { cidade: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [locais, total] = await Promise.all([
    prisma.local.findMany({
      where,
      orderBy: { nome: "asc" },
      skip,
      take: limit,
    }),
    prisma.local.count({ where }),
  ]);

  return NextResponse.json({ locais, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const local = await prisma.local.create({
    data: {
      nome: body.nome.trim(),
      cep: body.cep || null,
      rua: body.rua || null,
      numero: body.numero || null,
      bairro: body.bairro || null,
      complemento: body.complemento || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      lat: body.lat != null && body.lat !== "" ? Number(body.lat) : null,
      lng: body.lng != null && body.lng !== "" ? Number(body.lng) : null,
      observacoes: body.observacoes || null,
      companyId,
    },
  });

  return NextResponse.json(local, { status: 201 });
}
