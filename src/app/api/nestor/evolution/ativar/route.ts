import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  evolutionConfigurado,
  evolutionEstado,
  evolutionSetWebhook,
  enviarEvolution,
  normalizarTelefone,
  ASSISTENTE_PADRAO,
} from "@/lib/nestor";

// Ativa o recebimento pela Evolution API a partir do servidor: confere a
// conexão do número, configura o webhook automaticamente e (opcional) manda
// uma mensagem de teste. Só superadmin.

export const maxDuration = 60;

type SessionUser = { companyId?: string; role?: string };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as SessionUser;
  if (u.role !== "SUPERADMIN" || !u.companyId)
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const testarPara: string | undefined = body?.testarPara;

  const empresa = await prisma.company.findUnique({
    where: { id: u.companyId },
    select: {
      name: true,
      whatsappAssistente: true,
      whatsappVerifyToken: true,
      evolutionUrl: true,
      evolutionApiKey: true,
      evolutionInstance: true,
    },
  });
  if (!empresa) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  if (!evolutionConfigurado(empresa))
    return NextResponse.json(
      { error: "Preencha URL, instância e API key da Evolution e salve antes de ativar." },
      { status: 400 }
    );

  // Garante um token de verificação para a URL do webhook
  let verifyToken = empresa.whatsappVerifyToken;
  if (!verifyToken) {
    verifyToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await prisma.company.update({
      where: { id: u.companyId },
      data: { whatsappVerifyToken: verifyToken },
    });
  }

  const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  const webhookUrl = `${origin}/api/nestor/evolution?token=${verifyToken}`;

  const estado = await evolutionEstado(empresa);
  const erroWebhook = await evolutionSetWebhook(empresa, webhookUrl);

  let teste: { ok: boolean; erro: string | null } | null = null;
  if (testarPara?.trim()) {
    const tel = normalizarTelefone(testarPara);
    if (!tel) {
      teste = { ok: false, erro: "Telefone de teste inválido" };
    } else {
      const assistente = empresa.whatsappAssistente?.trim() || ASSISTENTE_PADRAO;
      const erro = await enviarEvolution(
        empresa,
        tel,
        `🤖 *${assistente}* — ${empresa.name}\n\nSe você recebeu esta mensagem, o assistente de orçamento rápido está conectado! ✅\n\nManda o briefing de um cliente que eu monto o orçamento.`
      );
      teste = { ok: !erro, erro };
    }
  }

  return NextResponse.json({
    conexao: estado.state, // "open" = conectado
    conexaoErro: estado.erro,
    webhookConfigurado: !erroWebhook,
    webhookErro: erroWebhook,
    webhookUrl,
    teste,
  });
}
