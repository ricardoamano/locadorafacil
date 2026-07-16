import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";

// Unidade física individualizada: detalhe + histórico próprio (saídas/retornos
// via conferência das OSs + ocorrências manuais), fotos e observações.

type SessUser = {
  id?: string;
  companyId?: string;
  name?: string | null;
  email?: string | null;
  role?: string;
};

async function getSessao() {
  const session = await auth();
  const u = session?.user as SessUser | undefined;
  if (!u?.companyId) return null;
  return { user: u, companyId: u.companyId, nome: u.name || u.email || "—" };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const unidade = await prisma.itemUnidade.findFirst({
    where: { id, companyId: sessao.companyId },
    include: {
      item: {
        select: {
          id: true,
          nome: true,
          codigo: true,
          modelo: true,
          especificacoes: true,
          observacaoInterna: true,
          fotoCapaUrl: true,
          marca: { select: { nome: true } },
          categoria: { select: { nome: true } },
        },
      },
      os: {
        select: { id: true, orcamento: { select: { numero: true, eventoNome: true } } },
      },
    },
  });
  if (!unidade) return NextResponse.json({ error: "Unidade não encontrada" }, { status: 404 });

  // Saídas/entradas registradas na conferência das OSs (com o evento)
  const conferencias = await prisma.osConferencia.findMany({
    where: { unidadeId: id },
    include: {
      os: {
        select: {
          id: true,
          orcamento: { select: { numero: true, eventoNome: true, dataInicio: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Ocorrências manuais (manutenção, baixa, avaria, observações, retorno)
  const eventos = await prisma.unidadeEvento.findMany({
    where: { unidadeId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Linha do tempo única, mais recente primeiro
  const timeline = [
    ...conferencias.map((c) => ({
      id: `conf_${c.id}`,
      tipo: c.tipo === "SAIDA" ? "SAIDA" : "RETORNO",
      descricao:
        c.tipo === "SAIDA"
          ? `Saiu para o evento ${c.os?.orcamento?.eventoNome || `OS #${c.os?.orcamento?.numero ?? ""}`}`
          : `Retornou do evento ${c.os?.orcamento?.eventoNome || `OS #${c.os?.orcamento?.numero ?? ""}`}`,
      osId: c.osId,
      osNumero: c.os?.orcamento?.numero ?? null,
      autor: c.registradoPor,
      em: c.createdAt,
    })),
    ...eventos.map((e) => ({
      id: `ev_${e.id}`,
      tipo: e.tipo,
      descricao: e.descricao || e.tipo,
      osId: null as string | null,
      osNumero: null as number | null,
      autor: e.autor,
      em: e.createdAt,
    })),
  ].sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime());

  return NextResponse.json({ unidade, timeline });
}

const STATUS_VALIDOS = ["EM_ESTOQUE", "MANUTENCAO", "BAIXADA"];
const TIPO_POR_STATUS: Record<string, string> = {
  MANUTENCAO: "MANUTENCAO",
  BAIXADA: "BAIXA",
  EM_ESTOQUE: "RETORNO_ESTOQUE",
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const unidade = await prisma.itemUnidade.findFirst({
    where: { id, companyId: sessao.companyId },
    include: { item: { select: { nome: true } } },
  });
  if (!unidade) return NextResponse.json({ error: "Unidade não encontrada" }, { status: 404 });

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  // Mudança de status (manutenção / baixa / retorno ao estoque) com registro
  if (body.status !== undefined) {
    if (!STATUS_VALIDOS.includes(body.status))
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    if (unidade.status === "NO_EVENTO" && body.status !== "EM_ESTOQUE")
      return NextResponse.json(
        { error: "A unidade está no evento — registre a entrada na conferência da OS antes." },
        { status: 400 }
      );
    data.status = body.status;
    if (body.status !== "NO_EVENTO") data.osId = null;
    await prisma.unidadeEvento.create({
      data: {
        unidadeId: id,
        tipo: TIPO_POR_STATUS[body.status],
        descricao: String(body.motivo || "").trim() || null,
        autor: sessao.nome,
      },
    });
    await auditar(sessao.user, {
      tipo: "ALTERACAO",
      modulo: "ativos",
      acao:
        body.status === "MANUTENCAO"
          ? "Enviou unidade para manutenção"
          : body.status === "BAIXADA"
            ? "Baixou unidade"
            : "Retornou unidade ao estoque",
      detalhe: `${unidade.codigo} — ${unidade.item.nome}`,
    });
  }

  if (body.observacoes !== undefined) data.observacoes = String(body.observacoes || "") || null;
  if (Array.isArray(body.fotos))
    data.fotos = body.fotos.filter((f: unknown) => typeof f === "string").slice(0, 12);
  if (body.proximaManutencao !== undefined)
    data.proximaManutencao = body.proximaManutencao ? new Date(body.proximaManutencao) : null;

  const atualizada = await prisma.itemUnidade.update({ where: { id }, data });
  return NextResponse.json(atualizada);
}

// Registrar ocorrência manual: AVARIA ou OBSERVACAO
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const unidade = await prisma.itemUnidade.findFirst({
    where: { id, companyId: sessao.companyId },
    include: { item: { select: { nome: true } } },
  });
  if (!unidade) return NextResponse.json({ error: "Unidade não encontrada" }, { status: 404 });

  const body = await req.json();
  const tipo = body.tipo === "AVARIA" ? "AVARIA" : "OBSERVACAO";
  const descricao = String(body.descricao || "").trim();
  if (!descricao)
    return NextResponse.json({ error: "Descreva a ocorrência" }, { status: 400 });

  const evento = await prisma.unidadeEvento.create({
    data: { unidadeId: id, tipo, descricao, autor: sessao.nome },
  });
  if (tipo === "AVARIA") {
    await auditar(sessao.user, {
      tipo: "ALTERACAO",
      modulo: "ativos",
      acao: "Registrou avaria",
      detalhe: `${unidade.codigo} — ${descricao.slice(0, 80)}`,
    });
  }
  return NextResponse.json(evento, { status: 201 });
}
