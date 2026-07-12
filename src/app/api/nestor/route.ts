import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  nestorConfigurado,
  normalizarTelefone,
  enviarWhatsapp,
  linkWaMe,
  mensagemEscala,
  mensagemAlteracao,
  mensagemLembrete,
  type DadosOsMensagem,
} from "@/lib/nestor";

// NESTOR — envio de WhatsApp para a equipe escalada em uma OS

type SessionUser = { companyId?: string; name?: string | null };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId ? { companyId: u.companyId, nome: u.name || null } : null;
}

async function carregarOs(osId: string, companyId: string) {
  return prisma.ordemServico.findFirst({
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dadosOs(os: any, empresaNome: string): DadosOsMensagem {
  const local = os.orcamento?.local;
  const endereco = local
    ? [local.rua, local.numero, local.bairro, local.cidade].filter(Boolean).join(", ")
    : null;
  return {
    numero: os.orcamento?.numero ?? "—",
    eventoNome: os.orcamento?.eventoNome,
    dataInicio: os.orcamento?.dataInicio,
    dataFim: os.orcamento?.dataFim,
    horarioMontagem: os.horarioMontagem,
    horarioDesmontagem: os.horarioDesmontagem,
    localNome: local?.nome,
    localEndereco: endereco || null,
    observacoes: os.observacoes,
    empresaNome,
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
      select: { name: true, whatsappNumero: true, whatsappPhoneId: true, whatsappToken: true },
    }),
    carregarOs(osId, sessao.companyId),
  ]);
  if (!company || !os) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dados = dadosOs(os, company.name);
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
        ESCALA: mensagemEscala(dados, info),
        ALTERACAO: mensagemAlteracao(dados, info),
        LEMBRETE: mensagemLembrete(dados, info),
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
    numero: company.whatsappNumero,
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
    tipo: "ESCALA" | "ALTERACAO" | "LEMBRETE" | "AVULSA";
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
      select: { name: true, whatsappPhoneId: true, whatsappToken: true },
    }),
    carregarOs(osId, sessao.companyId),
  ]);
  if (!company || !os) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dados = dadosOs(os, company.name);
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
        ? `🤖 *NESTOR* — ${company.name}\n\n${mensagemPersonalizada!.trim()}`
        : tipo === "ALTERACAO"
          ? mensagemAlteracao(dados, info)
          : tipo === "LEMBRETE"
            ? mensagemLembrete(dados, info)
            : mensagemEscala(dados, info);

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
