import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { clienteIa, extrairJson, MODELO_PROPOSTA } from "@/lib/ia";
import { lerDocumentoDaRequisicao } from "@/lib/documentos";
import { proximoCodigoItem } from "@/lib/unidades";

// Importação de OS de posto de serviço: o posto envia a OS dele (PDF,
// planilha, DOCX, texto ou texto colado), a IA interpreta as informações do
// evento e os itens pedidos, a extração fica guardada (OsPostoImportada —
// a última importação do mesmo posto serve de exemplo de padrão para as
// próximas) e vira um orçamento de posto de serviço.

// A análise do documento pela IA leva dezenas de segundos.
export const maxDuration = 60;

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

type ItemExtraido = {
  descricao?: unknown;
  natureza?: unknown;
  quantidade?: unknown;
  diarias?: unknown;
  valorUnitario?: unknown;
};

type SalaExtraida = { nome?: unknown; itens?: ItemExtraido[] };

type DadosOs = {
  posto?: unknown;
  numeroOsExterna?: unknown;
  eventoNome?: unknown;
  tipoEvento?: unknown;
  localNome?: unknown;
  dataMontagem?: unknown;
  dataInicio?: unknown;
  dataFim?: unknown;
  contatos?: { nome?: unknown; telefone?: unknown; funcao?: unknown }[];
  salas?: SalaExtraida[];
  observacoes?: unknown;
};

function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Casa a descrição de um item da OS com o catálogo (nome, apelidos, modelo). */
function casarItem(
  descricao: string,
  catalogo: { id: string; nome: string; apelidos: string | null; modelo: string | null; valorAluguel: number }[]
) {
  const d = normalizar(descricao);
  if (!d) return null;
  let melhor: { item: (typeof catalogo)[number]; peso: number } | null = null;
  for (const item of catalogo) {
    const nomes = [item.nome, item.modelo || "", ...(item.apelidos || "").split(",")]
      .map(normalizar)
      .filter((n) => n.length >= 3);
    for (const n of nomes) {
      if (d === n || d.includes(n) || n.includes(d)) {
        const peso = Math.min(n.length, d.length);
        if (!melhor || peso > melhor.peso) melhor = { item, peso };
      }
    }
  }
  return melhor?.item ?? null;
}

function dataOuNull(v: unknown): string | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Etapa "criar": recebe a extração revisada e monta o orçamento.
  if (req.nextUrl.searchParams.get("etapa") === "criar") {
    return criarOrcamento(req, companyId);
  }

  // Etapa "analisar": lê o documento e extrai as informações com IA.
  const ia = await clienteIa(companyId);
  if (!ia)
    return NextResponse.json(
      { error: "IA não configurada — configure em Configurações → Inteligência Artificial." },
      { status: 400 }
    );

  const entrada = await lerDocumentoDaRequisicao(req);
  if ("erro" in entrada)
    return NextResponse.json({ error: entrada.erro }, { status: entrada.status });
  const { blocos, nomeDocumento, extras } = entrada;

  // Padrão do posto: a última OS importada deste posto vira exemplo na análise.
  const clienteIdInformado = String(extras.clienteId || "") || null;
  let exemplo = "";
  if (clienteIdInformado) {
    const anterior = await prisma.osPostoImportada.findFirst({
      where: { companyId, clienteId: clienteIdInformado },
      orderBy: { createdAt: "desc" },
      select: { dados: true },
    });
    if (anterior)
      exemplo = `\n\nAs OSs deste posto seguem um padrão. Exemplo de como uma OS anterior dele foi interpretada (siga o mesmo critério de interpretação dos campos):\n${JSON.stringify(anterior.dados).slice(0, 6000)}`;
  }

  try {
    const resposta = await ia.messages.create({
      model: MODELO_PROPOSTA,
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            ...blocos,
            {
              type: "text",
              text: `O documento acima é uma ORDEM DE SERVIÇO (OS) enviada por um posto de serviço (empresa parceira/contratante) com as informações de um evento em que prestaremos serviço de locação de equipamentos. Extraia as informações.

Responda APENAS com um JSON válido:
{
  "posto": "nome da empresa que EMITIU esta OS (a contratante)",
  "numeroOsExterna": "número/código da OS no documento, ou null",
  "eventoNome": "nome do evento, ou null",
  "tipoEvento": "tipo do evento (congresso, show, feira...), ou null",
  "localNome": "local do evento (nome do espaço/endereço resumido), ou null",
  "dataMontagem": "data/hora da montagem em ISO (ex.: 2026-08-01T08:00:00), ou null",
  "dataInicio": "data/hora de início do evento em ISO, ou null",
  "dataFim": "data/hora de fim do evento em ISO, ou null",
  "contatos": [{ "nome": "...", "telefone": "... ou null", "funcao": "... ou null" }],
  "salas": [
    {
      "nome": "sala/ambiente/setor (se o documento não separar por sala, use uma única sala 'Equipamentos e Serviços')",
      "itens": [
        {
          "descricao": "equipamento ou serviço pedido, como está no documento",
          "natureza": "EQUIPAMENTO ou SERVICO (mão de obra, operação, técnico = SERVICO)",
          "quantidade": número (default 1),
          "diarias": número de diárias (default 1),
          "valorUnitario": valor unitário da diária em reais se constar no documento (número, ou null)
        }
      ]
    }
  ],
  "observacoes": "horários, exigências e demais informações relevantes do documento em texto corrido, ou null"
}

Regras: datas SEMPRE em ISO com o ano correto (hoje é ${new Date().toISOString().slice(0, 10)}). Valores UNITÁRIOS por diária. Não invente itens nem valores que não estão no documento.${exemplo}`,
            },
          ],
        },
      ],
    });
    const texto = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const dados = extrairJson(texto) as DadosOs | null;
    if (!dados || !Array.isArray(dados.salas)) {
      console.error(
        "[importar-os] IA não retornou extração válida.",
        "stop_reason:", resposta.stop_reason,
        "resposta:", texto.slice(0, 500)
      );
      return NextResponse.json(
        { error: "A IA não conseguiu interpretar este documento como uma OS." },
        { status: 422 }
      );
    }

    // Sugestões de vínculo: posto (clientes isPostoServico), local e itens do catálogo.
    const [postos, locais, catalogo] = await Promise.all([
      prisma.contact.findMany({
        where: { companyId, isPostoServico: true },
        select: { id: true, nomeFantasia: true, razaoSocial: true },
        orderBy: { nomeFantasia: "asc" },
      }),
      prisma.local.findMany({
        where: { companyId },
        select: { id: true, nome: true },
      }),
      prisma.item.findMany({
        where: { companyId },
        select: { id: true, nome: true, apelidos: true, modelo: true, valorAluguel: true },
        take: 3000,
      }),
    ]);

    const postoNome = normalizar(String(dados.posto || ""));
    const clienteSugerido =
      (clienteIdInformado && postos.find((p) => p.id === clienteIdInformado)) ||
      (postoNome
        ? postos.find(
            (p) =>
              normalizar(p.nomeFantasia).includes(postoNome) ||
              postoNome.includes(normalizar(p.nomeFantasia)) ||
              normalizar(p.razaoSocial).includes(postoNome) ||
              postoNome.includes(normalizar(p.razaoSocial))
          )
        : null) ||
      null;

    const localNome = normalizar(String(dados.localNome || ""));
    const localSugerido = localNome
      ? locais.find(
          (l) =>
            normalizar(l.nome).includes(localNome) || localNome.includes(normalizar(l.nome))
        )
      : null;

    const salas = (dados.salas || []).slice(0, 30).map((s) => ({
      nome: String(s?.nome || "Equipamentos e Serviços").slice(0, 120),
      itens: (Array.isArray(s?.itens) ? s.itens : []).slice(0, 100).map((i) => {
        const descricao = String(i?.descricao || "").slice(0, 200);
        const match = casarItem(descricao, catalogo);
        return {
          descricao,
          natureza: i?.natureza === "SERVICO" ? "SERVICO" : "EQUIPAMENTO",
          quantidade: Number(i?.quantidade) || 1,
          diarias: Number(i?.diarias) || 1,
          valorUnitario: i?.valorUnitario != null ? Number(i.valorUnitario) : null,
          itemId: match?.id ?? null,
          itemNome: match?.nome ?? null,
          valorCatalogo: match?.valorAluguel ?? null,
        };
      }),
    }));

    return NextResponse.json({
      documento: nomeDocumento,
      dados,
      salas,
      clienteSugeridoId: clienteSugerido?.id ?? null,
      localSugeridoId: localSugerido?.id ?? null,
      postos,
      parcial: resposta.stop_reason === "max_tokens",
    });
  } catch (e) {
    console.error("[importar-os] Erro na análise:", e);
    const msg = e instanceof Error ? e.message : "Erro na análise";
    return NextResponse.json(
      { error: `Erro ao analisar o documento: ${msg}` },
      { status: 502 }
    );
  }
}

type ItemCriar = {
  descricao?: string;
  natureza?: string;
  quantidade?: number;
  diarias?: number;
  valorUnitario?: number | null;
  itemId?: string | null;
};

async function criarOrcamento(req: NextRequest, companyId: string) {
  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const dados = (body.dados || {}) as DadosOs;
  const salas = (body.salas || []) as { nome?: string; itens?: ItemCriar[] }[];
  const documento = String(body.documento || "").slice(0, 200) || "documento";

  // Posto: existente ou cadastrado agora a partir do nome detectado.
  let clienteId = String(body.clienteId || "") || null;
  if (!clienteId) {
    const nome = String(body.novoPostoNome || dados.posto || "").trim().slice(0, 200);
    if (!nome)
      return NextResponse.json(
        { error: "Selecione o posto de serviço ou informe o nome para cadastrar." },
        { status: 400 }
      );
    const novo = await prisma.contact.create({
      data: {
        type: "CLIENTE",
        razaoSocial: nome,
        nomeFantasia: nome,
        isPostoServico: true,
        companyId,
      },
      select: { id: true },
    });
    clienteId = novo.id;
  } else {
    const existe = await prisma.contact.findFirst({
      where: { id: clienteId, companyId },
      select: { id: true },
    });
    if (!existe)
      return NextResponse.json({ error: "Posto não encontrado" }, { status: 404 });
  }

  // Itens sem correspondência no catálogo são criados (padrão dos acessórios).
  const itensCriados: string[] = [];
  const salasResolvidas: {
    nome: string;
    itens: { itemId: string; quantidade: number; diarias: number; valorUnitario: number; descricaoComercial: string | null }[];
  }[] = [];
  for (const sala of salas.slice(0, 30)) {
    const itens: (typeof salasResolvidas)[number]["itens"] = [];
    for (const i of (sala.itens || []).slice(0, 100)) {
      const descricao = String(i.descricao || "").trim().slice(0, 200);
      if (!descricao && !i.itemId) continue;
      let itemId = i.itemId || null;
      if (!itemId) {
        const existente = await prisma.item.findFirst({
          where: { companyId, nome: { equals: descricao, mode: "insensitive" as const } },
          select: { id: true },
        });
        if (existente) {
          itemId = existente.id;
        } else {
          const codigo = await proximoCodigoItem(companyId);
          const novo = await prisma.item.create({
            data: {
              codigo,
              nome: descricao,
              natureza: i.natureza === "SERVICO" ? "SERVICO" : "EQUIPAMENTO",
              cobranca: i.natureza === "SERVICO" ? "DIARIA" : null,
              tipo: "PROPRIO",
              quantidade: 0,
              valorAluguel: Number(i.valorUnitario) || 0,
              emCatalogo: true,
              companyId,
            },
            select: { id: true },
          });
          itemId = novo.id;
          itensCriados.push(descricao);
        }
      }
      itens.push({
        itemId,
        quantidade: Number(i.quantidade) || 1,
        diarias: Number(i.diarias) || 1,
        valorUnitario: Number(i.valorUnitario) || 0,
        descricaoComercial: null,
      });
    }
    if (itens.length)
      salasResolvidas.push({ nome: String(sala.nome || "Sala").slice(0, 120), itens });
  }

  const bruto = salasResolvidas.reduce(
    (acc, s) => acc + s.itens.reduce((a, i) => a + i.quantidade * i.diarias * i.valorUnitario, 0),
    0
  );

  const contatosTexto = (Array.isArray(dados.contatos) ? dados.contatos : [])
    .map((c) =>
      [c?.nome, c?.telefone, c?.funcao]
        .map((v) => String(v || "").trim())
        .filter(Boolean)
        .join(" · ")
    )
    .filter(Boolean)
    .join("\n");
  const obsPartes = [
    dados.numeroOsExterna ? `OS do posto: ${String(dados.numeroOsExterna)}` : "",
    !body.localId && dados.localNome ? `Local: ${String(dados.localNome)}` : "",
    contatosTexto ? `Contatos do posto:\n${contatosTexto}` : "",
    String(dados.observacoes || "").trim(),
  ].filter(Boolean);

  const last = await prisma.orcamento.findFirst({
    where: { companyId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const empresaNum = await prisma.company.findUnique({
    where: { id: companyId },
    select: { orcamentoNumeroInicial: true },
  });
  const numeroOrc = Math.max((last?.numero || 0) + 1, empresaNum?.orcamentoNumeroInicial || 1);

  const orcamento = await prisma.orcamento.create({
    data: {
      numero: numeroOrc,
      clienteId,
      // Posto de serviço: já entra APROVADO (gera a OS abaixo); o financeiro
      // é consolidado mensalmente numa única fatura, não por evento.
      status: "APROVADO",
      aprovadoEm: new Date(),
      aprovadoPor: "Importação de OS do posto",
      eventoNome: String(dados.eventoNome || "").slice(0, 200) || null,
      tipoEvento: String(dados.tipoEvento || "").slice(0, 100) || null,
      localId: String(body.localId || "") || null,
      dataMontagem: dataOuNull(dados.dataMontagem),
      dataInicio: dataOuNull(dados.dataInicio),
      dataFim: dataOuNull(dados.dataFim),
      observacoes: obsPartes.join("\n\n") || null,
      obsInternas: `Importado da OS do posto (${documento}) com IA.`,
      total: bruto,
      companyId,
      salas: {
        create: salasResolvidas.map((s) => ({
          nome: s.nome,
          itens: {
            create: s.itens.map((i) => ({
              itemId: i.itemId,
              quantidade: i.quantidade,
              diarias: i.diarias,
              valorUnitario: i.valorUnitario,
              subtotal: i.quantidade * i.diarias * i.valorUnitario,
              descricaoComercial: i.descricaoComercial,
            })),
          },
        })),
      },
    },
    select: { id: true, numero: true },
  });

  // Como o posto entra APROVADO, gera a OS automaticamente (sem receita — o
  // financeiro é consolidado na fatura mensal do posto).
  await prisma.ordemServico.create({
    data: {
      orcamentoId: orcamento.id,
      status: "ABERTA",
      horarioMontagem: dataOuNull(dados.dataMontagem),
      observacoes: obsPartes.join("\n\n") || null,
      companyId,
    },
  });

  // Guarda a extração: histórico da OS recebida e exemplo de padrão do posto.
  await prisma.osPostoImportada.create({
    data: {
      companyId,
      clienteId,
      orcamentoId: orcamento.id,
      documento,
      dados: JSON.parse(JSON.stringify(dados)),
    },
  });

  return NextResponse.json(
    { orcamentoId: orcamento.id, numero: orcamento.numero, itensCriados },
    { status: 201 }
  );
}
