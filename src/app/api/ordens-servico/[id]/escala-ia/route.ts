import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  clienteIa,
  INSTRUCOES_ESCALA_PADRAO,
  MODELO_PROPOSTA,
  normalizarSkills,
  instrucoesPorTipo,
} from "@/lib/ia";

// Chat de escala/logística dentro da OS — usa a skill de tipo ESCALA da empresa,
// com o contexto da própria ordem de serviço (equipamentos, datas, local,
// equipe já escalada e veículos).

export const maxDuration = 300;

type SessionUser = { companyId?: string };

const DIA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const NOME_RODIZIO = ["", "segunda", "terça", "quarta", "quinta", "sexta"];

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  const data = new Date(d);
  return `${DIA_SEMANA[data.getDay()]} ${data.toLocaleDateString("pt-BR")} ${data.toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" }
  )}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const companyId = session?.user
    ? (session.user as SessionUser).companyId ?? null
    : null;
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const mensagens = (body.mensagens || []) as {
    role: "user" | "assistant";
    content: string;
  }[];
  if (mensagens.length === 0 || mensagens[mensagens.length - 1].role !== "user")
    return NextResponse.json({ error: "Envie uma mensagem" }, { status: 400 });

  const ia = await clienteIa(companyId);
  if (!ia)
    return NextResponse.json(
      {
        error:
          "IA não configurada — peça ao administrador para configurar em Configurações → Inteligência Artificial.",
      },
      { status: 400 }
    );

  const os = await prisma.ordemServico.findFirst({
    where: { id, companyId },
    include: {
      orcamento: {
        include: {
          cliente: { select: { nomeFantasia: true, razaoSocial: true } },
          local: { select: { nome: true, cidade: true, estado: true } },
          salas: {
            include: {
              itens: {
                include: {
                  item: { select: { nome: true, natureza: true } },
                },
              },
            },
          },
        },
      },
      escala: { include: { membro: { select: { nome: true, tipo: true } } } },
      veiculos: {
        include: {
          veiculo: {
            select: { placa: true, modelo: true, tipo: true, capacidadeCarga: true, rodizioDia: true },
          },
        },
      },
    },
  });
  if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, iaInstrucoes: true, iaSkills: true },
  });
  const skills = normalizarSkills(empresa?.iaSkills, empresa?.iaInstrucoes);
  const instrucoes = instrucoesPorTipo(skills, "ESCALA", INSTRUCOES_ESCALA_PADRAO);

  // ── Monta o contexto da OS ────────────────────────────────────────────────
  const orc = os.orcamento;
  const cliente = orc?.cliente?.nomeFantasia || orc?.cliente?.razaoSocial || "—";
  const local = orc?.local
    ? `${orc.local.nome}${orc.local.cidade ? ` — ${orc.local.cidade}/${orc.local.estado || ""}` : ""}`
    : "—";

  const equipamentos: string[] = [];
  for (const sala of orc?.salas || []) {
    for (const it of sala.itens || []) {
      equipamentos.push(`${it.quantidade}× ${it.item?.nome || "item"}`);
    }
  }

  const equipe = os.escala.length
    ? os.escala
        .map(
          (e) =>
            `- ${e.membro?.nome || "—"} (${e.funcao || e.membro?.tipo || "função?"})` +
            `${e.horarioEntrada ? `, entrada ${fmt(e.horarioEntrada)}` : ""}`
        )
        .join("\n")
    : "Ninguém escalado ainda.";

  const veiculos = os.veiculos.length
    ? os.veiculos
        .map((v) => {
          const rod = v.veiculo?.rodizioDia
            ? `, rodízio ${NOME_RODIZIO[v.veiculo.rodizioDia] || "?"}`
            : "";
          return `- ${v.veiculo?.modelo || "veículo"} (${v.veiculo?.placa || "—"})${
            v.veiculo?.capacidadeCarga ? `, carga ${v.veiculo.capacidadeCarga}` : ""
          }${rod}`;
        })
        .join("\n")
    : "Nenhum veículo escalado ainda.";

  const contexto = `## Contexto da ordem de serviço
- Evento: ${orc?.eventoNome || "—"}
- Cliente: ${cliente}
- Local: ${local}${os.obsLocal ? ` (obs: ${os.obsLocal})` : ""}
- Período do evento: ${fmt(orc?.dataInicio)} até ${fmt(orc?.dataFim)}
- Montagem: ${fmt(os.horarioMontagem)}${os.obsMontagem ? ` (obs: ${os.obsMontagem})` : ""}
- Desmontagem: ${fmt(os.horarioDesmontagem)}${os.obsDesmontagem ? ` (obs: ${os.obsDesmontagem})` : ""}

### Equipamentos (${equipamentos.length} linha(s))
${equipamentos.length ? equipamentos.map((e) => `- ${e}`).join("\n") : "—"}

### Equipe já escalada
${equipe}

### Veículos já escalados
${veiculos}`;

  const system = `${instrucoes}

Você está ajudando a equipe da empresa ${empresa?.name || "—"} a planejar a logística desta ordem de serviço específica. Use SEMPRE o contexto abaixo; se algo não estiver no contexto, deixe claro que é uma suposição.

${contexto}`;

  try {
    const resposta = await ia.messages.create({
      model: MODELO_PROPOSTA,
      max_tokens: 4000,
      system,
      messages: mensagens.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    });
    const texto = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return NextResponse.json({ resposta: texto });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na IA";
    const status = msg.includes("authentication") || msg.includes("401") ? 400 : 502;
    return NextResponse.json(
      {
        error:
          status === 400
            ? "Chave de API inválida — confira em Configurações → Inteligência Artificial."
            : `Erro ao consultar a IA: ${msg}`,
      },
      { status }
    );
  }
}
