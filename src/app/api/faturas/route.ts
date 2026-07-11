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
            { clienteNome: { contains: search } },
            { mesRef: { contains: search } },
          ],
        }
      : {}),
  };

  const [faturas, total] = await Promise.all([
    prisma.fatura.findMany({
      where,
      include: {
        orcamento: { select: { id: true, numero: true } },
      },
      orderBy: { numero: "desc" },
      skip,
      take: limit,
    }),
    prisma.fatura.count({ where }),
  ]);

  return NextResponse.json({ faturas, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.clienteNome?.trim())
    return NextResponse.json({ error: "Cliente obrigatório" }, { status: 400 });
  if (!body.dataEmissao || !body.dataVencimento)
    return NextResponse.json({ error: "Datas obrigatórias" }, { status: 400 });

  const last = await prisma.fatura.findFirst({
    where: { companyId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const numero = (last?.numero || 0) + 1;

  const fatura = await prisma.fatura.create({
    data: {
      numero,
      isPostoServico: !!body.isPostoServico,
      orcamentoId: body.orcamentoId || null,
      clienteId: body.clienteId || null,
      clienteNome: body.clienteNome.trim(),
      mesRef: body.mesRef || "",
      dataEmissao: new Date(body.dataEmissao),
      dataVencimento: new Date(body.dataVencimento),
      valor: Number(body.valor) || 0,
      descritivo: body.descritivo || null,
      companyId,
    },
  });

  return NextResponse.json(fatura, { status: 201 });
}
