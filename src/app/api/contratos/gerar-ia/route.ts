import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  clienteIa,
  INSTRUCOES_CONTRATO_PADRAO,
  MODELO_PROPOSTA,
  normalizarSkills,
  instrucoesPorTipo,
} from "@/lib/ia";

// Gera um contrato por IA a partir de um orçamento: puxa os dados do cliente,
// dos equipamentos/serviços e da empresa e usa a skill de tipo CONTRATO.
// O contrato nasce como v1; cada salvamento posterior cria uma nova versão.

export const maxDuration = 300;

type SessionUser = { companyId?: string; name?: string | null };

function fmtData(d?: Date | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}
function fmtMoeda(v?: number | null) {
  return v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as SessionUser;
  const companyId = u.companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  const orcamentoId = String(body.orcamentoId || "");
  const observacoes = String(body.observacoes || "").trim();
  if (!orcamentoId)
    return NextResponse.json({ error: "Selecione o orçamento" }, { status: 400 });

  const ia = await clienteIa(companyId);
  if (!ia)
    return NextResponse.json(
      { error: "IA não configurada — peça ao administrador para configurar em Configurações → Inteligência Artificial." },
      { status: 400 }
    );

  const [orcamento, empresa] = await Promise.all([
    prisma.orcamento.findFirst({
      where: { id: orcamentoId, companyId },
      include: {
        cliente: true,
        contato: { select: { nome: true, telefone: true, email: true } },
        local: true,
        salas: {
          include: {
            itens: {
              include: {
                item: { select: { nome: true, codigo: true, natureza: true, valorReposicao: true } },
              },
            },
          },
        },
      },
    }),
    prisma.company.findUnique({ where: { id: companyId } }),
  ]);
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
  const enderecoEmpresa = [
    empresa?.rua && `${empresa.rua}${empresa.numero ? `, ${empresa.numero}` : ""}`,
    empresa?.bairro,
    empresa?.cidade && empresa?.estado ? `${empresa.cidade} - ${empresa.estado}` : empresa?.cidade,
    empresa?.cep,
  ]
    .filter(Boolean)
    .join(", ");

  const equipamentos: string[] = [];
  const servicos: string[] = [];
  for (const sala of orcamento.salas) {
    for (const i of sala.itens) {
      const linha = `${i.quantidade}x ${i.item?.nome || "item"}${
        i.item?.codigo ? ` (${i.item.codigo})` : ""
      }${i.diarias > 1 ? ` — ${i.diarias} diárias` : ""}${
        i.item?.valorReposicao ? ` — reposição ${fmtMoeda(i.item.valorReposicao)}` : ""
      }`;
      if (i.item?.natureza === "SERVICO") servicos.push(linha);
      else equipamentos.push(linha);
    }
  }

  const dados = `## DADOS PARA O CONTRATO

### Locadora (empresa)
- Razão social: ${empresa?.razaoSocial || empresa?.name || "—"}
- Nome fantasia: ${empresa?.name || "—"}
- CNPJ: ${empresa?.cnpj || "[PREENCHER: CNPJ da locadora]"}
- Endereço: ${enderecoEmpresa || "[PREENCHER: endereço da locadora]"}
- Responsável: ${empresa?.responsavel || "—"}
- Telefone: ${empresa?.telefone || "—"} · E-mail: ${empresa?.email || "—"}

### Locatária (cliente)
- Razão social: ${c?.razaoSocial || "—"}
- Nome fantasia: ${c?.nomeFantasia || "—"}
- CNPJ/CPF: ${c?.cnpj || "[PREENCHER: CNPJ/CPF do cliente]"}
- Endereço: ${enderecoCliente || "[PREENCHER: endereço do cliente]"}
- Contato: ${orcamento.contato?.nome || "—"}${orcamento.contato?.telefone ? ` · ${orcamento.contato.telefone}` : ""}${orcamento.contato?.email ? ` · ${orcamento.contato.email}` : ""}

### Evento
- Orçamento nº: ${orcamento.numero}
- Evento: ${orcamento.eventoNome || "—"}${orcamento.tipoEvento ? ` (${orcamento.tipoEvento})` : ""}
- Local: ${orcamento.local?.nome || "—"}${orcamento.local?.cidade ? ` — ${orcamento.local.cidade}/${orcamento.local.estado || ""}` : ""}
- Montagem: ${fmtData(orcamento.dataMontagem)}
- Período do evento: ${fmtData(orcamento.dataInicio)} a ${fmtData(orcamento.dataFim)}

### Equipamentos locados (${equipamentos.length})
${equipamentos.map((e) => `- ${e}`).join("\n") || "- (nenhum)"}

### Serviços contratados (${servicos.length})
${servicos.map((s) => `- ${s}`).join("\n") || "- (nenhum)"}

### Valores e pagamento
- Valor total: ${fmtMoeda(orcamento.total)}
- Forma de pagamento: ${orcamento.formaPagamento || "[PREENCHER: forma de pagamento]"}
- Condições: ${orcamento.condicoes || "—"}
${observacoes ? `\n### Instruções adicionais do usuário\n${observacoes}` : ""}`;

  const skills = normalizarSkills(empresa?.iaSkills, empresa?.iaInstrucoes);
  const instrucoes = instrucoesPorTipo(skills, "CONTRATO", INSTRUCOES_CONTRATO_PADRAO);

  try {
    const resposta = await ia.messages.create({
      model: MODELO_PROPOSTA,
      max_tokens: 8000,
      system: instrucoes,
      messages: [{ role: "user", content: dados }],
    });
    const conteudo = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!conteudo) throw new Error("A IA não retornou o contrato");

    const usuario = u.name || session.user.email || "desconhecido";
    const contrato = await prisma.contrato.create({
      data: {
        titulo: `Contrato — ${c?.nomeFantasia || "Cliente"} — Orçamento #${orcamento.numero}`,
        clienteId: orcamento.clienteId,
        orcamentoId: orcamento.id,
        status: "RASCUNHO",
        conteudo,
        versaoAtual: 1,
        geradoEm: new Date(),
        geradoPor: usuario,
        companyId,
        versoes: {
          create: { numero: 1, conteudo, criadoPor: usuario },
        },
      },
    });

    return NextResponse.json({ contrato }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na IA";
    const status = msg.includes("authentication") || msg.includes("401") ? 400 : 502;
    return NextResponse.json(
      {
        error:
          status === 400
            ? "Chave de API inválida — confira em Configurações → Inteligência Artificial."
            : `Erro ao gerar o contrato: ${msg}`,
      },
      { status }
    );
  }
}
