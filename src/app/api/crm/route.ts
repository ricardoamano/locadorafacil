import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calcularCadencia, STATUS_ABERTO, type Prioridade } from "@/lib/crm";

// Lista de follow-ups: orçamentos em aberto que precisam de contato para
// cobrar feedback, com cadência e prioridade calculadas.

type SessionUser = { companyId?: string };

const ORDEM_PRIORIDADE: Record<Prioridade, number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const orcamentos = await prisma.orcamento.findMany({
    where: {
      companyId,
      status: { in: STATUS_ABERTO },
    },
    select: {
      id: true,
      numero: true,
      eventoNome: true,
      status: true,
      total: true,
      projetoEspecial: true,
      dataInicio: true,
      createdAt: true,
      cliente: {
        select: {
          id: true,
          nomeFantasia: true,
        },
      },
      contato: { select: { nome: true, telefone: true } },
      followUps: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, proximaData: true, resultado: true, canal: true },
      },
    },
  });

  const agora = new Date();
  const lista = orcamentos.map((o) => {
    const ultimo = o.followUps[0] || null;
    const cad = calcularCadencia({
      createdAt: o.createdAt,
      dataEvento: o.dataInicio,
      ultimoContato: ultimo?.createdAt || null,
      proximaDataManual: ultimo?.proximaData || null,
      agora,
    });
    return {
      id: o.id,
      numero: o.numero,
      eventoNome: o.eventoNome,
      status: o.status,
      total: o.total,
      projetoEspecial: o.projetoEspecial,
      cliente: o.cliente,
      contatoNome: o.contato?.nome || null,
      contatoTelefone: o.contato?.telefone || null,
      dataEvento: o.dataInicio,
      ultimoContato: ultimo?.createdAt || null,
      ultimoResultado: ultimo?.resultado || null,
      ...cad,
    };
  });

  lista.sort((a, b) => {
    const p = ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade];
    if (p !== 0) return p;
    return a.proximaData.getTime() - b.proximaData.getTime();
  });

  const pendentes = lista.filter((l) => l.vencido).length;
  return NextResponse.json({ followups: lista, pendentes, total: lista.length });
}
