import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
  const existing = await prisma.tarefa.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const responsaveis: string[] = (body.responsaveis || []).filter(Boolean);
  await prisma.tarefaMembro.deleteMany({ where: { tarefaId: id } });

  const tarefa = await prisma.tarefa.update({
    where: { id },
    data: {
      nome: body.nome,
      instrucoes: body.instrucoes || null,
      dataInicio: body.dataInicio ? new Date(body.dataInicio) : existing.dataInicio,
      dataEntrega: body.dataEntrega ? new Date(body.dataEntrega) : existing.dataEntrega,
      obsExecucao: body.obsExecucao || null,
      status: body.status || existing.status,
      responsaveis: {
        create: responsaveis.map((membroId) => ({ membroId })),
      },
    },
    include: { responsaveis: true },
  });

  return NextResponse.json(tarefa);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.tarefa.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.tarefa.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
