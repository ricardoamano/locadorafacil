import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string; name?: string | null };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId ? { companyId: u.companyId, nome: u.name || null } : null;
}

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

function fmtDataHora(d: Date | null): string {
  if (!d) return "—";
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function mesmaData(a: Date | null, b: Date | null): boolean {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
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
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { companyId, nome: autor } = sessao;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.ordemServico.findFirst({
    where: { id, companyId },
    include: { escala: { include: { membro: { select: { id: true, nome: true } } } } },
  });
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

  // ── Detecção de mudanças para o histórico (visível na OS pública) ──────────
  const alteracoes: string[] = [];

  const novoStatus = body.status || existing.status;
  if (novoStatus !== existing.status) {
    alteracoes.push(
      `Status: ${STATUS_LABEL[existing.status] || existing.status} → ${STATUS_LABEL[novoStatus] || novoStatus}`
    );
  }

  const novaMontagem = body.horarioMontagem ? new Date(body.horarioMontagem) : null;
  if (!mesmaData(novaMontagem, existing.horarioMontagem)) {
    alteracoes.push(
      `Montagem: ${fmtDataHora(existing.horarioMontagem)} → ${fmtDataHora(novaMontagem)}`
    );
  }
  const novaDesmontagem = body.horarioDesmontagem ? new Date(body.horarioDesmontagem) : null;
  if (!mesmaData(novaDesmontagem, existing.horarioDesmontagem)) {
    alteracoes.push(
      `Desmontagem: ${fmtDataHora(existing.horarioDesmontagem)} → ${fmtDataHora(novaDesmontagem)}`
    );
  }

  const novasObs = body.observacoes || null;
  if ((novasObs || "") !== (existing.observacoes || "")) {
    alteracoes.push("Observações operacionais atualizadas");
  }

  // Escala: membros adicionados/removidos
  const antigosIds = new Set(existing.escala.map((e) => e.membroId));
  const novosIds = new Set(escala.map((e) => e.membroId));
  const adicionados = [...novosIds].filter((m) => !antigosIds.has(m));
  const removidos = existing.escala.filter((e) => !novosIds.has(e.membroId));
  if (adicionados.length > 0) {
    const nomes = await prisma.membro.findMany({
      where: { id: { in: adicionados } },
      select: { nome: true },
    });
    alteracoes.push(`Escalado(s): ${nomes.map((m) => m.nome).join(", ")}`);
  }
  if (removidos.length > 0) {
    alteracoes.push(
      `Removido(s) da escala: ${removidos.map((e) => e.membro?.nome || "—").join(", ")}`
    );
  }

  // Produtores/contatos do evento
  let produtoresData:
    | { nome: string; telefone: string; funcao: string; observacao: string }[]
    | undefined;
  if (Array.isArray(body.produtores)) {
    produtoresData = body.produtores
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => p?.nome || p?.telefone)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({
        nome: String(p.nome || "").trim(),
        telefone: String(p.telefone || "").trim(),
        funcao: String(p.funcao || "").trim(),
        observacao: String(p.observacao || "").trim(),
      }));
    if (JSON.stringify(produtoresData) !== JSON.stringify(existing.produtores ?? [])) {
      alteracoes.push("Contatos do evento atualizados");
    }
  }

  // Informações do evento (texto livre do responsável — carimbado com autor/hora)
  const infoMudou =
    body.infoEvento !== undefined &&
    (body.infoEvento?.trim() || "") !== (existing.infoEvento || "");
  if (infoMudou) alteracoes.push("Informações do evento atualizadas");

  await prisma.escalaMembro.deleteMany({ where: { osId: id } });

  const os = await prisma.ordemServico.update({
    where: { id },
    data: {
      status: novoStatus,
      horarioMontagem: novaMontagem,
      horarioDesmontagem: novaDesmontagem,
      observacoes: novasObs,
      produtores: produtoresData ?? existing.produtores ?? undefined,
      ...(infoMudou
        ? {
            infoEvento: body.infoEvento?.trim() || null,
            infoEventoEm: new Date(),
            infoEventoPor: autor,
          }
        : {}),
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

  if (alteracoes.length > 0) {
    await prisma.osAlteracao.createMany({
      data: alteracoes.map((descricao) => ({ osId: id, descricao, autor })),
    });
  }

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
