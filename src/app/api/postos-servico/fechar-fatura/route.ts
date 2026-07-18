import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Fechamento mensal do posto de serviço: soma todos os eventos aprovados do
// posto no mês (ainda não faturados) e gera UMA única fatura de locação + a
// receita correspondente. Cada evento vira uma linha da fatura.

type SessionUser = { companyId?: string; name?: string | null };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId ? { companyId: u.companyId, nome: u.name || null } : null;
}

// GET: prévia do consumo em aberto de um posto num mês (YYYY-MM)
export async function GET(req: NextRequest) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clienteId = req.nextUrl.searchParams.get("clienteId") || "";
  const mesRef = req.nextUrl.searchParams.get("mes") || ""; // YYYY-MM
  if (!clienteId || !/^\d{4}-\d{2}$/.test(mesRef))
    return NextResponse.json({ error: "Informe clienteId e mês (YYYY-MM)" }, { status: 400 });

  const [ano, mes] = mesRef.split("-").map(Number);
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 1);

  const eventos = await prisma.orcamento.findMany({
    where: {
      companyId: sessao.companyId,
      clienteId,
      status: "APROVADO",
      postoFaturaId: null,
      dataInicio: { gte: inicio, lt: fim },
    },
    orderBy: { dataInicio: "asc" },
    select: { id: true, numero: true, eventoNome: true, dataInicio: true, total: true },
  });

  const total = eventos.reduce((s, e) => s + (e.total || 0), 0);
  return NextResponse.json({
    eventos: eventos.map((e) => ({
      numero: e.numero,
      evento: e.eventoNome || `Orçamento #${e.numero}`,
      data: e.dataInicio,
      total: e.total || 0,
    })),
    quantidade: eventos.length,
    total,
  });
}

// POST: gera a fatura consolidada do mês
export async function POST(req: NextRequest) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const clienteId = String(body.clienteId || "");
  const mesRef = String(body.mes || "");
  const diasVencimento = Number(body.diasVencimento) || 30;
  if (!clienteId || !/^\d{4}-\d{2}$/.test(mesRef))
    return NextResponse.json({ error: "Informe clienteId e mês (YYYY-MM)" }, { status: 400 });

  const posto = await prisma.contact.findFirst({
    where: { id: clienteId, companyId: sessao.companyId, isPostoServico: true },
    select: { id: true, nomeFantasia: true },
  });
  if (!posto) return NextResponse.json({ error: "Posto de serviço não encontrado" }, { status: 404 });

  const [ano, mes] = mesRef.split("-").map(Number);
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 1);

  const resultado = await prisma.$transaction(async (tx) => {
    const eventos = await tx.orcamento.findMany({
      where: {
        companyId: sessao.companyId,
        clienteId,
        status: "APROVADO",
        postoFaturaId: null,
        dataInicio: { gte: inicio, lt: fim },
      },
      orderBy: { dataInicio: "asc" },
      select: { id: true, numero: true, eventoNome: true, dataInicio: true, total: true },
    });
    if (eventos.length === 0) return { vazio: true as const };

    const valor = eventos.reduce((s, e) => s + (e.total || 0), 0);
    // Sequência da empresa principal (faturas de emissoras contam à parte)
    const last = await tx.fatura.findFirst({
      where: { companyId: sessao.companyId, emissoraId: null },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    const empresaNum = await tx.company.findUnique({
      where: { id: sessao.companyId },
      select: { faturaNumeroInicial: true },
    });
    const numero = Math.max((last?.numero || 0) + 1, empresaNum?.faturaNumeroInicial || 1);
    const dataEmissao = new Date();
    const dataVencimento = new Date(dataEmissao.getTime() + diasVencimento * 86_400_000);
    const mesNome = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });

    const fatura = await tx.fatura.create({
      data: {
        numero,
        isPostoServico: true,
        tipoDestinatario: "POSTO",
        origem: "POSTO_MENSAL",
        clienteId: posto.id,
        clienteNome: posto.nomeFantasia,
        mesRef,
        dataEmissao,
        dataVencimento,
        valor,
        descritivo: `Locação — consolidado de ${eventos.length} evento(s) de ${mesNome}`,
        companyId: sessao.companyId,
        itens: {
          create: eventos.map((e) => ({
            descricao: `${e.eventoNome || `Orçamento #${e.numero}`}${
              e.dataInicio ? ` (${new Date(e.dataInicio).toLocaleDateString("pt-BR")})` : ""
            }`,
            periodo: "DIARIA",
            quantidade: 1,
            valorUnitario: e.total || 0,
            subtotal: e.total || 0,
          })),
        },
      },
      select: { id: true, numero: true },
    });

    // Marca os eventos como faturados (não entram em outro fechamento)
    await tx.orcamento.updateMany({
      where: { id: { in: eventos.map((e) => e.id) } },
      data: { postoFaturaId: fatura.id },
    });

    // Uma única receita para a fatura consolidada
    await tx.transacao.create({
      data: {
        nome: `Fatura #${fatura.numero} — ${posto.nomeFantasia} (${mesNome})`,
        dataRecebimento: dataVencimento,
        tipo: "RECEITA",
        faturaId: fatura.id,
        valor,
        observacao: `Consolidado mensal de ${eventos.length} evento(s) do posto de serviço ${posto.nomeFantasia}.`,
        status: "PENDENTE",
        companyId: sessao.companyId,
      },
    });

    return { faturaId: fatura.id, numero: fatura.numero, eventos: eventos.length, valor };
  });

  if ("vazio" in resultado)
    return NextResponse.json(
      { error: "Nenhum evento aprovado em aberto neste mês para este posto." },
      { status: 422 }
    );

  return NextResponse.json(resultado, { status: 201 });
}
