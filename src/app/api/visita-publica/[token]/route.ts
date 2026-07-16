import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Link público da visita técnica: qualquer pessoa com o link vê o material
// organizado; para COMENTAR precisa se identificar (nome + e-mail ou celular).

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const visita = await prisma.visitaTecnica.findUnique({
    where: { publicToken: token },
    include: {
      midias: { orderBy: [{ ordem: "asc" }, { createdAt: "asc" }] },
      comentarios: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!visita) return NextResponse.json({ error: "Link inválido" }, { status: 404 });

  const empresa = await prisma.company.findUnique({
    where: { id: visita.companyId },
    select: { name: true, logoUrl: true },
  });

  return NextResponse.json({
    empresa,
    visita: {
      titulo: visita.titulo,
      localNome: visita.localNome,
      data: visita.data,
      observacoes: visita.observacoes,
      midias: visita.midias,
      // Público não vê o contato dos outros — só nome e texto
      comentarios: visita.comentarios.map((c) => ({
        id: c.id,
        midiaId: c.midiaId,
        autorNome: c.autorNome,
        interno: c.interno,
        texto: c.texto,
        createdAt: c.createdAt,
      })),
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const visita = await prisma.visitaTecnica.findUnique({
    where: { publicToken: token },
    select: { id: true },
  });
  if (!visita) return NextResponse.json({ error: "Link inválido" }, { status: 404 });

  const body = await req.json();
  const autorNome = String(body.autorNome || "").trim();
  const autorContato = String(body.autorContato || "").trim();
  const texto = String(body.texto || "").trim();

  if (autorNome.length < 3)
    return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
  const ehEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(autorContato);
  const ehCelular = autorContato.replace(/\D/g, "").length >= 10;
  if (!ehEmail && !ehCelular)
    return NextResponse.json(
      { error: "Informe um e-mail ou celular válido para identificar seu comentário." },
      { status: 400 }
    );
  if (!texto) return NextResponse.json({ error: "Escreva o comentário." }, { status: 400 });
  if (texto.length > 2000)
    return NextResponse.json({ error: "Comentário muito longo." }, { status: 400 });

  // Validação do vínculo mídia↔visita (se comentário for numa mídia)
  let midiaId: string | null = null;
  if (body.midiaId) {
    const m = await prisma.visitaMidia.findFirst({
      where: { id: String(body.midiaId), visitaId: visita.id },
      select: { id: true },
    });
    if (!m) return NextResponse.json({ error: "Mídia não encontrada" }, { status: 404 });
    midiaId = m.id;
  }

  const comentario = await prisma.visitaComentario.create({
    data: {
      visitaId: visita.id,
      midiaId,
      autorNome: autorNome.slice(0, 120),
      autorContato: autorContato.slice(0, 160),
      interno: false,
      texto,
    },
  });
  return NextResponse.json(
    { id: comentario.id, autorNome: comentario.autorNome, texto: comentario.texto, midiaId, createdAt: comentario.createdAt },
    { status: 201 }
  );
}
