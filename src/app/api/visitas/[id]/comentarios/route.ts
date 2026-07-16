import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Comentários internos (usuário logado) em uma visita ou numa mídia dela.

type SessUser = { companyId?: string; name?: string | null; email?: string | null };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const u = session?.user as SessUser | undefined;
  if (!u?.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visita = await prisma.visitaTecnica.findFirst({
    where: { id, companyId: u.companyId },
    select: { id: true },
  });
  if (!visita) return NextResponse.json({ error: "Visita não encontrada" }, { status: 404 });

  const body = await req.json();
  const texto = String(body.texto || "").trim();
  if (!texto) return NextResponse.json({ error: "Escreva o comentário" }, { status: 400 });

  const comentario = await prisma.visitaComentario.create({
    data: {
      visitaId: id,
      midiaId: body.midiaId ? String(body.midiaId) : null,
      autorNome: u.name || u.email || "Equipe",
      interno: true,
      texto,
    },
  });
  return NextResponse.json(comentario, { status: 201 });
}
