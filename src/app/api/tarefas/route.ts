import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { id?: string; companyId?: string };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(status ? { status } : {}),
    ...(search ? { nome: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [tarefas, total] = await Promise.all([
    prisma.tarefa.findMany({
      where,
      include: {
        criador: { select: { id: true, name: true } },
        responsaveis: {
          include: { membro: { select: { id: true, nome: true } } },
        },
      },
      orderBy: { dataEntrega: "asc" },
      skip,
      take: limit,
    }),
    prisma.tarefa.count({ where }),
  ]);

  return NextResponse.json({ tarefas, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (!body.dataInicio || !body.dataEntrega)
    return NextResponse.json({ error: "Datas obrigatórias" }, { status: 400 });

  const responsaveis: string[] = (body.responsaveis || []).filter(Boolean);

  const tarefa = await prisma.tarefa.create({
    data: {
      nome: body.nome.trim(),
      instrucoes: body.instrucoes || null,
      dataInicio: new Date(body.dataInicio),
      dataEntrega: new Date(body.dataEntrega),
      obsExecucao: body.obsExecucao || null,
      status: body.status || "NAO_INICIADA",
      criadorId: user.id as string,
      companyId: user.companyId,
      responsaveis: {
        create: responsaveis.map((membroId) => ({ membroId })),
      },
    },
    include: { responsaveis: true },
  });

  return NextResponse.json(tarefa, { status: 201 });
}
