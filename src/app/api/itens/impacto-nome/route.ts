import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Antes de renomear um item: onde mais o nome antigo aparece? (outros itens
// com o mesmo nome, faturas ainda não emitidas e orçamentos pendentes que
// copiaram o nome como descrição). Usado pelo formulário para perguntar
// "alterar em todos?".

type SessionUser = { companyId?: string };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const nome = (req.nextUrl.searchParams.get("nome") || "").trim();
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!nome) return NextResponse.json({ itens: 0, faturas: 0, orcamentos: 0 });

  const [itens, faturas, orcamentos] = await Promise.all([
    prisma.item.count({
      where: { companyId, NOT: { id }, nome: { equals: nome, mode: "insensitive" } },
    }),
    // só faturas ainda não emitidas (as emitidas são imutáveis)
    prisma.faturaItem.count({
      where: {
        descricao: { equals: nome, mode: "insensitive" },
        fatura: { companyId, snapshot: { equals: Prisma.DbNull } },
      },
    }),
    prisma.salaItem.count({
      where: {
        descricaoComercial: { equals: nome, mode: "insensitive" },
        sala: { orcamento: { companyId, status: "PENDENTE" } },
      },
    }),
  ]);

  return NextResponse.json({ itens, faturas, orcamentos });
}
