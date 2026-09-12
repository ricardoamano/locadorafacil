import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validarVinculoUsuario } from "@/lib/membros";

type SessionUser = { companyId?: string };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const membros = await prisma.membro.findMany({
    where: { companyId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      especialidades: {
        include: { especialidade: { select: { id: true, nome: true } } },
      },
      avaliacoes: { select: { nota: true } },
    },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json({
    membros: membros.map((m) => {
      const { avaliacoes, ...resto } = m;
      const media =
        avaliacoes.length > 0
          ? avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length
          : null;
      return { ...resto, avaliacaoMedia: media, avaliacoesTotal: avaliacoes.length };
    }),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const userId = body.userId || null;
  if (userId) {
    const erro = await validarVinculoUsuario(userId, companyId);
    if (erro) return NextResponse.json({ error: erro }, { status: 400 });
  }

  const especialidadeIds: string[] = Array.isArray(body.especialidades)
    ? body.especialidades.filter(Boolean)
    : [];

  const membro = await prisma.membro.create({
    data: {
      nome: body.nome.trim(),
      telefone: body.telefone || null,
      email: body.email || null,
      rg: body.rg || null,
      cpf: body.cpf || null,
      tipo: body.tipo || "FREELANCER",
      pix: body.pix || null,
      cache: body.cache != null && body.cache !== "" ? Number(body.cache) : null,
      observacoes: body.observacoes || null,
      userId,
      companyId,
      especialidades: {
        create: especialidadeIds.map((especialidadeId) => ({ especialidadeId })),
      },
    },
  });

  return NextResponse.json(membro, { status: 201 });
}
