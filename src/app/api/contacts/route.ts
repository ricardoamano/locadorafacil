import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { dadosContato, dadosSubContatos } from "@/lib/contacts";

type SessionUser = { companyId?: string };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "CLIENTE";
  const postos = searchParams.get("postos") === "1";
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    type,
    ...(postos ? { isPostoServico: true } : {}),
    ...(search
      ? {
          OR: [
            { nomeFantasia: { contains: search, mode: "insensitive" as const } },
            { razaoSocial: { contains: search, mode: "insensitive" as const } },
            { cnpj: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        _count: { select: { orcamentos: true } },
        subContacts: { select: { id: true, nome: true, telefone: true, email: true, cargo: true } },
      },
      orderBy: { nomeFantasia: "asc" },
      skip,
      take: limit,
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json({ contacts, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  const subs = dadosSubContatos(body.subContacts);

  const contact = await prisma.contact.create({
    data: {
      ...dadosContato(body),
      companyId,
      subContacts: subs.length ? { create: subs } : undefined,
    },
    include: { subContacts: true },
  });

  return NextResponse.json(contact, { status: 201 });
}
