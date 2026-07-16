import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Visitas técnicas — registro em campo com fotos/vídeos/arquivos e comentários.

type SessUser = { companyId?: string; name?: string | null; email?: string | null };

async function getSessao() {
  const session = await auth();
  const u = session?.user as SessUser | undefined;
  if (!u?.companyId) return null;
  return { companyId: u.companyId, nome: u.name || u.email || "—" };
}

export async function GET() {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const visitas = await prisma.visitaTecnica.findMany({
    where: { companyId: sessao.companyId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { midias: true, comentarios: true } } },
    take: 100,
  });
  return NextResponse.json({ visitas });
}

export async function POST(req: NextRequest) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "Informe o título da visita" }, { status: 400 });

  const visita = await prisma.visitaTecnica.create({
    data: {
      companyId: sessao.companyId,
      titulo,
      localNome: String(body.localNome || "").trim() || null,
      data: body.data ? new Date(body.data) : new Date(),
      publicToken: randomUUID().replace(/-/g, ""),
      criadoPor: sessao.nome,
    },
  });
  return NextResponse.json(visita, { status: 201 });
}
