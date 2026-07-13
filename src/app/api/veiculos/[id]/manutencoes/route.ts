import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Manutenções do veículo — cadastro genérico (troca de óleo, pneus, revisão...)
// com km, custo, próxima prevista (data ou km) e comprovantes anexados.

type SessionUser = { companyId?: string; name?: string | null };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId ? { companyId: u.companyId, nome: u.name || null } : null;
}

async function veiculoDaEmpresa(id: string, companyId: string) {
  return prisma.veiculo.findFirst({ where: { id, companyId }, select: { id: true } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await veiculoDaEmpresa(id, sessao.companyId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [manutencoes, arquivos] = await Promise.all([
    prisma.veiculoManutencao.findMany({
      where: { veiculoId: id },
      orderBy: { data: "desc" },
    }),
    prisma.veiculoArquivo.findMany({
      where: { veiculoId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return NextResponse.json({ manutencoes, arquivos });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await veiculoDaEmpresa(id, sessao.companyId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const tipo = String(body.tipo || "").trim();
  if (!tipo) return NextResponse.json({ error: "Informe o tipo de manutenção" }, { status: 400 });
  if (!body.data) return NextResponse.json({ error: "Informe a data" }, { status: 400 });

  const manutencao = await prisma.veiculoManutencao.create({
    data: {
      veiculoId: id,
      tipo,
      data: new Date(body.data),
      km: body.km != null && body.km !== "" ? Number(body.km) : null,
      custo: body.custo != null && body.custo !== "" ? Number(body.custo) : null,
      descricao: body.descricao?.trim() || null,
      proximaData: body.proximaData ? new Date(body.proximaData) : null,
      proximaKm: body.proximaKm != null && body.proximaKm !== "" ? Number(body.proximaKm) : null,
      observacoes: body.observacoes?.trim() || null,
      criadoPor: sessao.nome,
    },
  });
  return NextResponse.json(manutencao, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await veiculoDaEmpresa(id, sessao.companyId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const manutencaoId = req.nextUrl.searchParams.get("manutencaoId") || "";
  const m = await prisma.veiculoManutencao.findFirst({
    where: { id: manutencaoId, veiculoId: id },
  });
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Remove também os comprovantes anexados a esta manutenção
  const anexos = await prisma.veiculoArquivo.findMany({
    where: { veiculoId: id, manutencaoId },
    select: { id: true, arquivoId: true },
  });
  await prisma.veiculoArquivo.deleteMany({ where: { veiculoId: id, manutencaoId } });
  for (const a of anexos) {
    if (a.arquivoId) await prisma.arquivo.delete({ where: { id: a.arquivoId } }).catch(() => {});
  }
  await prisma.veiculoManutencao.delete({ where: { id: manutencaoId } });
  return NextResponse.json({ success: true });
}
