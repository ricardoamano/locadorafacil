import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

function fmtData(d?: Date | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "";
}
function fmtMoeda(v?: number | null) {
  return v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "";
}

// POST { modeloId, orcamentoId } → gera contrato com variáveis substituídas
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  if (!body.modeloId || !body.orcamentoId)
    return NextResponse.json(
      { error: "Modelo e orçamento são obrigatórios" },
      { status: 400 }
    );

  const [modelo, orcamento, empresa] = await Promise.all([
    prisma.modeloContrato.findFirst({
      where: { id: body.modeloId, companyId, ativo: true },
    }),
    prisma.orcamento.findFirst({
      where: { id: body.orcamentoId, companyId },
      include: {
        cliente: true,
        local: true,
        os: { select: { id: true, orcamento: { select: { numero: true } } } },
        salas: {
          include: { itens: { include: { item: { select: { nome: true, codigo: true } } } } },
        },
      },
    }),
    prisma.company.findUnique({ where: { id: companyId } }),
  ]);

  if (!modelo) return NextResponse.json({ error: "Modelo não encontrado ou inativo" }, { status: 404 });
  if (!orcamento) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });

  const c = orcamento.cliente;
  const enderecoCliente = [
    c?.rua && `${c.rua}${c.numero ? `, ${c.numero}` : ""}`,
    c?.bairro,
    c?.cidade && c?.estado ? `${c.cidade} - ${c.estado}` : c?.cidade,
    c?.cep,
  ]
    .filter(Boolean)
    .join(", ");

  const equipamentos = orcamento.salas
    .flatMap((s) =>
      s.itens.map(
        (i) => `${i.quantidade}x ${i.item?.nome || ""}${i.item?.codigo ? ` (${i.item.codigo})` : ""}`
      )
    )
    .join("; ");

  const vars: Record<string, string> = {
    "empresa.nome": empresa?.name || "",
    "empresa.razao_social": empresa?.razaoSocial || empresa?.name || "",
    "empresa.cnpj": empresa?.cnpj || "",
    "empresa.endereco": [
      empresa?.rua && `${empresa.rua}${empresa.numero ? `, ${empresa.numero}` : ""}`,
      empresa?.bairro,
      empresa?.cidade && empresa?.estado ? `${empresa.cidade} - ${empresa.estado}` : empresa?.cidade,
      empresa?.cep,
    ]
      .filter(Boolean)
      .join(", "),
    "empresa.telefone": empresa?.telefone || "",
    "empresa.email": empresa?.email || "",
    "empresa.responsavel": empresa?.responsavel || "",
    "cliente.nome": c?.nomeFantasia || "",
    "cliente.razao_social": c?.razaoSocial || "",
    "cliente.cpf_cnpj": c?.cnpj || "",
    "cliente.endereco": enderecoCliente,
    "orcamento.numero": String(orcamento.numero),
    "orcamento.valor_total": fmtMoeda(orcamento.total),
    "orcamento.desconto": orcamento.desconto != null ? String(orcamento.desconto) : "",
    "evento.nome": orcamento.eventoNome || "",
    "evento.tipo": orcamento.tipoEvento || "",
    "evento.data_inicio": fmtData(orcamento.dataInicio),
    "evento.data_fim": fmtData(orcamento.dataFim),
    "evento.local": orcamento.local?.nome || "",
    "evento.equipamentos": equipamentos,
    "pagamento.forma": orcamento.formaPagamento || "",
    "pagamento.condicoes": orcamento.condicoes || "",
    "ordem_servico.numero": orcamento.os ? String(orcamento.numero) : "",
    "data.hoje": fmtData(new Date()),
  };

  const faltando: string[] = [];
  const conteudo = modelo.conteudo.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    const valor = vars[key];
    if (valor === undefined) {
      faltando.push(key);
      return m; // variável desconhecida: mantém para revisão
    }
    if (valor === "") faltando.push(key);
    return valor;
  });

  const usuario = session.user.email || session.user.name || "desconhecido";
  const contrato = await prisma.contrato.create({
    data: {
      titulo: `Contrato — ${modelo.nome} — Orçamento #${orcamento.numero}`,
      clienteId: orcamento.clienteId,
      orcamentoId: orcamento.id,
      status: "RASCUNHO",
      conteudo,
      modeloId: modelo.id,
      modeloVersao: modelo.versao,
      geradoEm: new Date(),
      geradoPor: usuario,
      companyId,
    },
  });

  return NextResponse.json({
    contrato,
    variaveisSemValor: [...new Set(faltando)],
  });
}
