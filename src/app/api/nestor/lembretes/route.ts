import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  nestorConfigurado,
  normalizarTelefone,
  enviarWhatsapp,
  montarMensagem,
  templatesDaEmpresa,
  type DadosOsMensagem,
} from "@/lib/nestor";

// Lembretes automáticos do assistente de WhatsApp (cron diário da Vercel).
// Para cada empresa com WhatsApp configurado, avisa os escalados dos eventos
// que começam (ou montam) amanhã. Nunca envia o mesmo lembrete duas vezes.

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  // Sem CRON_SECRET definido: aceita apenas o user-agent do cron da Vercel
  return (req.headers.get("user-agent") || "").startsWith("vercel-cron");
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "https://locadorafacil.app";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const depoisDeAmanha = new Date(hoje);
  depoisDeAmanha.setDate(depoisDeAmanha.getDate() + 2);

  const empresas = await prisma.company.findMany({
    where: { whatsappPhoneId: { not: null }, whatsappToken: { not: null } },
    select: {
      id: true,
      name: true,
      whatsappAssistente: true,
      whatsappPhoneId: true,
      whatsappToken: true,
      whatsappTemplates: true,
    },
  });

  let enviadas = 0;
  let erros = 0;

  for (const company of empresas) {
    if (!nestorConfigurado(company)) continue;
    const templates = templatesDaEmpresa(company.whatsappTemplates);

    // OS ativas cujo evento inicia amanhã ou cuja montagem é amanhã
    const ordens = await prisma.ordemServico.findMany({
      where: {
        companyId: company.id,
        status: { notIn: ["CONCLUIDA", "CANCELADA"] },
        OR: [
          { orcamento: { dataInicio: { gte: amanha, lt: depoisDeAmanha } } },
          { horarioMontagem: { gte: amanha, lt: depoisDeAmanha } },
        ],
      },
      include: {
        orcamento: { include: { local: true } },
        escala: { include: { membro: { select: { id: true, nome: true, telefone: true } } } },
      },
    });

    for (const os of ordens) {
      let publicToken = os.publicToken;
      if (!publicToken) {
        publicToken = randomUUID().replace(/-/g, "");
        await prisma.ordemServico.update({ where: { id: os.id }, data: { publicToken } });
      }

      const dados: DadosOsMensagem = {
        numero: os.orcamento?.numero ?? "—",
        eventoNome: os.orcamento?.eventoNome,
        dataInicio: os.orcamento?.dataInicio,
        dataFim: os.orcamento?.dataFim,
        horarioMontagem: os.horarioMontagem,
        local: os.orcamento?.local || null,
        produtores: os.produtores,
        empresaNome: company.name,
        assistenteNome: company.whatsappAssistente,
        linkOs: `${origin}/os/${publicToken}`,
      };

      for (const e of os.escala) {
        const telefone = normalizarTelefone(e.membro?.telefone);
        if (!telefone) continue;

        // Já lembrado hoje?
        const jaEnviado = await prisma.mensagemWhatsapp.findFirst({
          where: {
            companyId: company.id,
            osId: os.id,
            membroId: e.membroId,
            tipo: "LEMBRETE",
            status: "ENVIADA",
            createdAt: { gte: hoje },
          },
          select: { id: true },
        });
        if (jaEnviado) continue;

        const mensagem = montarMensagem("LEMBRETE", templates, dados, {
          nome: e.membro?.nome || "—",
          funcao: e.funcao,
          horarioEntrada: e.horarioEntrada,
        });
        const erro = await enviarWhatsapp(company, telefone, mensagem);
        await prisma.mensagemWhatsapp.create({
          data: {
            companyId: company.id,
            osId: os.id,
            membroId: e.membroId,
            telefone,
            tipo: "LEMBRETE",
            mensagem,
            status: erro ? "ERRO" : "ENVIADA",
            erro,
            enviadoPor: "Assistente (automático)",
          },
        });
        if (erro) erros++;
        else enviadas++;
      }
    }
  }

  return NextResponse.json({ enviadas, erros });
}
