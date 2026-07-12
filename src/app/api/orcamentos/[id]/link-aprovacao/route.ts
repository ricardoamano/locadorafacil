import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

// Gera (ou retorna) o link público de aprovação do orçamento
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const orc = await prisma.orcamento.findFirst({
    where: { id, companyId },
    select: { id: true, aprovacaoToken: true },
  });
  if (!orc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let token = orc.aprovacaoToken;
  if (!token) {
    token = randomUUID().replace(/-/g, "");
    await prisma.orcamento.update({ where: { id }, data: { aprovacaoToken: token } });
  }
  return NextResponse.json({ token, url: `/aprovar/${token}` });
}
