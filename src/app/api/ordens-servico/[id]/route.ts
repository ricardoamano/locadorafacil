import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const os = await prisma.ordemServico.findFirst({
    where: { id, companyId },
    include: {
      orcamento: {
        include: {
          cliente: { select: { id: true, nomeFantasia: true, razaoSocial: true } },
          local: { select: { id: true, nome: true, cidade: true, estado: true } },
          salas: {
            include: {
              itens: {
                include: { item: { select: { id: true, nome: true, codigo: true, descricaoComercial: true, natureza: true, valorReposicao: true } } },
              },
            },
          },
        },
      },
      escala: {
        include: { membro: { select: { id: true, nome: true, tipo: true } } },
      },
    },
  });

  if (!os) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(os);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.ordemServico.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type EscalaInput = {
    membroId: string;
    horarioEntrada?: string;
    horarioSaida?: string;
    funcao?: string;
    cache?: number | string;
  };
  const escala: EscalaInput[] = (body.escala || []).filter(
    (e: EscalaInput) => e.membroId
  );

  await prisma.escalaMembro.deleteMany({ where: { osId: id } });

  const os = await prisma.ordemServico.update({
    where: { id },
    data: {
      status: body.status || existing.status,
      horarioMontagem: body.horarioMontagem ? new Date(body.horarioMontagem) : null,
      horarioDesmontagem: body.horarioDesmontagem
        ? new Date(body.horarioDesmontagem)
        : null,
      observacoes: body.observacoes || null,
      produtores: Array.isArray(body.produtores)
        ? body.produtores
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((p: any) => p?.nome || p?.telefone)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((p: any) => ({
              nome: String(p.nome || "").trim(),
              telefone: String(p.telefone || "").trim(),
              funcao: String(p.funcao || "").trim(),
            }))
        : existing.produtores ?? undefined,
      escala: {
        create: escala.map((e) => ({
          membroId: e.membroId,
          horarioEntrada: e.horarioEntrada ? new Date(e.horarioEntrada) : null,
          horarioSaida: e.horarioSaida ? new Date(e.horarioSaida) : null,
          funcao: e.funcao || null,
          cache: e.cache != null && e.cache !== "" ? Number(e.cache) : null,
        })),
      },
    },
    include: { escala: true },
  });

  return NextResponse.json(os);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.ordemServico.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.ordemServico.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
