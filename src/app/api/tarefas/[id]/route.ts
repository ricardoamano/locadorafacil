import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { gerarProximaOcorrencia } from "@/lib/tarefas-recorrencia";

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
  const atribuidos: string[] = (body.atribuidos || []).filter(Boolean);
  await prisma.tarefaMembro.deleteMany({ where: { tarefaId: id } });
  await prisma.tarefaUsuario.deleteMany({ where: { tarefaId: id } });

  const recorrencia =
    body.recorrencia === undefined
      ? existing.recorrencia
      : ["DIARIA", "SEMANAL", "MENSAL", "ANUAL"].includes(body.recorrencia)
        ? body.recorrencia
        : null;

  const novoStatus = body.status || existing.status;

  const tarefa = await prisma.tarefa.update({
    where: { id },
    data: {
      nome: body.nome,
      instrucoes: body.instrucoes || null,
      dataInicio: body.dataInicio ? new Date(body.dataInicio) : existing.dataInicio,
      dataEntrega: body.dataEntrega ? new Date(body.dataEntrega) : existing.dataEntrega,
      obsExecucao: body.obsExecucao || null,
      status: novoStatus,
      recorrencia,
      recorrenciaAte:
        body.recorrenciaAte === undefined
          ? existing.recorrenciaAte
          : body.recorrenciaAte
            ? new Date(body.recorrenciaAte)
            : null,
      responsaveis: {
        create: responsaveis.map((membroId) => ({ membroId })),
      },
      atribuidos: {
        create: atribuidos.map((userId) => ({ userId })),
      },
    },
    include: { responsaveis: true, atribuidos: true },
  });

  // Concluiu uma tarefa recorrente? Gera automaticamente a próxima ocorrência.
  let proximaId: string | null = null;
  if (novoStatus === "CONCLUIDA" && existing.status !== "CONCLUIDA" && tarefa.recorrencia) {
    proximaId = await gerarProximaOcorrencia(prisma, id);
  }

  return NextResponse.json({ ...tarefa, proximaId });
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
