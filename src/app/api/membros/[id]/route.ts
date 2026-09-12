import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validarVinculoUsuario } from "@/lib/membros";

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.membro.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = body.userId || null;
  if (userId) {
    const erro = await validarVinculoUsuario(userId, companyId, id);
    if (erro) return NextResponse.json({ error: erro }, { status: 400 });
  }

  const especialidadeIds: string[] | null = Array.isArray(body.especialidades)
    ? body.especialidades.filter(Boolean)
    : null;
  if (especialidadeIds) {
    await prisma.membroEspecialidade.deleteMany({ where: { membroId: id } });
  }

  const membro = await prisma.membro.update({
    where: { id },
    data: {
      nome: body.nome,
      telefone: body.telefone || null,
      email: body.email || null,
      rg: body.rg || null,
      cpf: body.cpf || null,
      tipo: body.tipo || existing.tipo,
      pix: body.pix || null,
      cache: body.cache != null && body.cache !== "" ? Number(body.cache) : null,
      ...(body.observacoes !== undefined ? { observacoes: body.observacoes || null } : {}),
      userId,
      ...(especialidadeIds
        ? {
            especialidades: {
              create: especialidadeIds.map((especialidadeId) => ({ especialidadeId })),
            },
          }
        : {}),
    },
  });

  return NextResponse.json(membro);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.membro.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.membro.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
