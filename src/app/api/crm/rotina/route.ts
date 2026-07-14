import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularCadencia, STATUS_ABERTO } from "@/lib/crm";

// Rotina automática de CRM (cron diário da Vercel). Para cada empresa, cria uma
// tarefa de "cobrar feedback" para os orçamentos em aberto cujo follow-up está
// vencido — atribuída aos administradores. Idempotente: não duplica a tarefa
// enquanto a anterior não for concluída.

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  return (req.headers.get("user-agent") || "").startsWith("vercel-cron");
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agora = new Date();
  const daquiA2Dias = new Date(agora.getTime() + 2 * 86_400_000);

  const empresas = await prisma.company.findMany({ select: { id: true } });

  let criadas = 0;
  for (const empresa of empresas) {
    const [orcamentos, admins] = await Promise.all([
      prisma.orcamento.findMany({
        where: { companyId: empresa.id, status: { in: STATUS_ABERTO } },
        select: {
          id: true,
          numero: true,
          eventoNome: true,
          dataInicio: true,
          createdAt: true,
          cliente: { select: { nomeFantasia: true } },
          followUps: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, proximaData: true },
          },
        },
      }),
      prisma.user.findMany({
        where: { companyId: empresa.id, role: { in: ["ADMIN", "SUPERADMIN"] }, ativo: true },
        select: { id: true },
      }),
    ]);
    if (admins.length === 0) continue;

    for (const o of orcamentos) {
      const ultimo = o.followUps[0] || null;
      const cad = calcularCadencia({
        createdAt: o.createdAt,
        dataEvento: o.dataInicio,
        ultimoContato: ultimo?.createdAt || null,
        proximaDataManual: ultimo?.proximaData || null,
        agora,
      });
      if (!cad.vencido) continue;

      // Já existe uma tarefa de CRM em aberto para este orçamento? Não duplica.
      const existe = await prisma.tarefa.findFirst({
        where: {
          crmOrcamentoId: o.id,
          status: { not: "CONCLUIDA" },
        },
        select: { id: true },
      });
      if (existe) continue;

      const cliente = o.cliente?.nomeFantasia || "cliente";
      await prisma.tarefa.create({
        data: {
          nome: `CRM: cobrar feedback do orçamento #${o.numero} — ${cliente}`,
          instrucoes:
            `Orçamento ainda não aprovado. Entrar em contato com ${cliente} para cobrar ` +
            `feedback${o.eventoNome ? ` sobre o evento "${o.eventoNome}"` : ""}. ` +
            `Registre o retorno no CRM.`,
          dataInicio: agora,
          dataEntrega: daquiA2Dias,
          status: "NAO_INICIADA",
          criadorId: admins[0].id,
          companyId: empresa.id,
          crmOrcamentoId: o.id,
          atribuidos: { create: admins.map((a) => ({ userId: a.id })) },
        },
      });
      criadas += 1;
    }
  }

  return NextResponse.json({ ok: true, criadas });
}
