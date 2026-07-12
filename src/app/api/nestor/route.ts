import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  nestorConfigurado,
  normalizarTelefone,
  enviarWhatsapp,
  linkWaMe,
  montarMensagem,
  templatesDaEmpresa,
  ASSISTENTE_PADRAO,
  type DadosOsMensagem,
  type TipoTemplate,
} from "@/lib/nestor";

// Assistente de WhatsApp — envio para a equipe escalada em uma OS

type SessionUser = { companyId?: string; name?: string | null };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId ? { companyId: u.companyId, nome: u.name || null } : null;
}

async function carregarOs(osId: string, companyId: string) {
  const os = await prisma.ordemServico.findFirst({
    where: { id: osId, companyId },
    include: {
      orcamento: {
        include: {
          local: true,
          cliente: { select: { nomeFantasia: true } },
        },
      },
      escala: { include: { membro: { select: { id: true, nome: true, telefone: true } } } },
    },
  });
  if (!os) return null;
  // Garante o link público simplificado da OS
  if (!os.publicToken) {
    const token = randomUUID().replace(/-/g, "");
    await prisma.ordemServico.update({ where: { id: os.id }, data: { publicToken: token } });
    os.publicToken = token;
  }
  return os;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dadosOs(os: any, empresaNome: string, assistenteNome: string | null, origin: string): DadosOsMensagem {
  return {
    numero: os.orcamento?.numero ?? "—",
    eventoNome: os.orcamento?.eventoNome,
    dataInicio: os.orcamento?.dataInicio,
    dataFim: os.orcamento?.dataFim,
    horarioMontagem: os.horarioMontagem,
    horarioDesmontagem: os.horarioDesmontagem,
    local: os.orcamento?.local || null,
    observacoes: os.observacoes,
    produtores: os.produtores,
    empresaNome,
    assistenteNome,
    linkOs: os.publicToken ? `${origin}/os/${os.publicToken}` : null,
  };
}

export async function GET(req: NextRequest) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const osId = req.nextUrl.searchParams.get("osId");
  if (!osId) return NextResponse.json({ error: "osId obrigatório" }, { status: 400 });

  const [company, os] = await Promise.all([
    prisma.company.findUnique({
      where: { id: sessao.companyId },
      select: {
        name: true,
        whatsappAssistente: true,
        whatsappNumero: true,
        whatsappPhoneId: true,
        whatsappToken: true,
        whatsappTemplates: true,
      },
    }),
    carregarOs(osId, sessao.companyId),
  ]);
  if (!company || !os) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const templates = templatesDaEmpresa(company.whatsappTemplates);
  const dados = dadosOs(os, company.name, company.whatsappAssistente, req.nextUrl.origin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const escalados = (os.escala as any[]).map((e) => {
    const telefone = normalizarTelefone(e.membro?.telefone);
    const info = { nome: e.membro?.nome || "—", funcao: e.funcao, horarioEntrada: e.horarioEntrada };
    return {
      escalaId: e.id,
      membroId: e.membroId,
      nome: info.nome,
      funcao: e.funcao,
      telefone,
      telefoneOriginal: e.membro?.telefone || null,
      mensagens: {
        ESCALA: montarMensagem("ESCALA", templates, dados, info),
        ALTERACAO: montarMensagem("ALTERACAO", templates, dados, info),
        LEMBRETE: montarMensagem("LEMBRETE", templates, dados, info),
      },
    };
  });

  const historico = await prisma.mensagemWhatsapp.findMany({
    where: { osId, companyId: sessao.companyId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { membro: { select: { nome: true } } },
  });

  return NextResponse.json({
    configurado: nestorConfigurado(company),
    assistente: company.whatsappAssistente?.trim() || ASSISTENTE_PADRAO,
    numero: company.whatsappNumero,
    linkOs: dados.linkOs,
    escalados,
    historico,
  });
}

export async function POST(req: NextRequest) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { osId, tipo, membroIds, mensagemPersonalizada } = body as {
    osId: string;
    tipo: TipoTemplate | "AVULSA";
    membroIds?: string[];
    mensagemPersonalizada?: string;
  };
  if (!osId || !tipo)
    return NextResponse.json({ error: "osId e tipo são obrigatórios" }, { status: 400 });
  if (tipo === "AVULSA" && !mensagemPersonalizada?.trim())
    return NextResponse.json({ error: "Escreva a mensagem" }, { status: 400 });

  const [company, os] = await Promise.all([
    prisma.company.findUnique({
      where: { id: sessao.companyId },
      select: {
        name: true,
        whatsappAssistente: true,
        whatsappPhoneId: true,
        whatsappToken: true,
        whatsappTemplates: true,
      },
    }),
    carregarOs(osId, sessao.companyId),
  ]);
  if (!company || !os) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const templates = templatesDaEmpresa(company.whatsappTemplates);
  const assistente = company.whatsappAssistente?.trim() || ASSISTENTE_PADRAO;
  const dados = dadosOs(os, company.name, company.whatsappAssistente, req.nextUrl.origin);
  const viaApi = nestorConfigurado(company);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alvos = (os.escala as any[]).filter(
    (e) => !membroIds?.length || membroIds.includes(e.membroId)
  );

  const resultados: {
    membroId: string;
    nome: string;
    status: string;
    erro?: string | null;
    link?: string | null;
  }[] = [];

  for (const e of alvos) {
    const telefone = normalizarTelefone(e.membro?.telefone);
    const info = { nome: e.membro?.nome || "—", funcao: e.funcao, horarioEntrada: e.horarioEntrada };
    const mensagem =
      tipo === "AVULSA"
        ? `🤖 *${assistente}* — ${company.name}\n\n${mensagemPersonalizada!.trim()}`
        : montarMensagem(tipo, templates, dados, info);

    if (!telefone) {
      resultados.push({
        membroId: e.membroId,
        nome: info.nome,
        status: "ERRO",
        erro: "Membro sem telefone válido cadastrado",
      });
      continue;
    }

    if (viaApi) {
      const erro = await enviarWhatsapp(company, telefone, mensagem);
      await prisma.mensagemWhatsapp.create({
        data: {
          companyId: sessao.companyId,
          osId,
          membroId: e.membroId,
          telefone,
          tipo,
          mensagem,
          status: erro ? "ERRO" : "ENVIADA",
          erro,
          enviadoPor: sessao.nome,
        },
      });
      resultados.push({ membroId: e.membroId, nome: info.nome, status: erro ? "ERRO" : "ENVIADA", erro });
    } else {
      // Sem API configurada: registra e devolve o link wa.me para abrir no WhatsApp
      await prisma.mensagemWhatsapp.create({
        data: {
          companyId: sessao.companyId,
          osId,
          membroId: e.membroId,
          telefone,
          tipo,
          mensagem,
          status: "LINK",
          enviadoPor: sessao.nome,
        },
      });
      resultados.push({
        membroId: e.membroId,
        nome: info.nome,
        status: "LINK",
        link: linkWaMe(telefone, mensagem),
      });
    }
  }

  return NextResponse.json({ viaApi, resultados });
}
