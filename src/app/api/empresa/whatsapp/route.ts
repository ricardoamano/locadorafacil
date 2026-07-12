import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  nestorConfigurado,
  normalizarTelefone,
  enviarWhatsapp,
  templatesDaEmpresa,
  TEMPLATES_PADRAO,
  ASSISTENTE_PADRAO,
} from "@/lib/nestor";

// Configuração do assistente de WhatsApp da empresa — só admin
// (nome do assistente, credenciais da Cloud API e textos das mensagens)

type SessionUser = { companyId?: string; role?: string };

async function getAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (u.role !== "ADMIN" || !u.companyId) return null;
  return u.companyId;
}

export async function GET() {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      whatsappAssistente: true,
      whatsappNumero: true,
      whatsappPhoneId: true,
      whatsappToken: true,
      whatsappTemplates: true,
    },
  });
  return NextResponse.json({
    assistente: c?.whatsappAssistente || "",
    numero: c?.whatsappNumero || "",
    phoneId: c?.whatsappPhoneId || "",
    // token nunca volta inteiro — só indica se existe
    tokenConfigurado: Boolean(c?.whatsappToken),
    configurado: nestorConfigurado(c),
    templates: templatesDaEmpresa(c?.whatsappTemplates),
    templatesPadrao: TEMPLATES_PADRAO,
  });
}

export async function POST(req: NextRequest) {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { assistente, numero, phoneId, token, templates, testarPara } = body as {
    assistente?: string;
    numero?: string;
    phoneId?: string;
    token?: string;
    templates?: { ESCALA?: string; ALTERACAO?: string; LEMBRETE?: string };
    testarPara?: string;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    whatsappAssistente: assistente?.trim() || null,
    whatsappNumero: numero?.trim() || null,
    whatsappPhoneId: phoneId?.trim() || null,
  };
  // token vazio = manter o atual; "REMOVER" = apagar
  if (token === "REMOVER") data.whatsappToken = null;
  else if (token?.trim()) data.whatsappToken = token.trim();

  if (templates) {
    // Texto igual ao padrão não é salvo (segue acompanhando futuras melhorias do padrão)
    const custom: Record<string, string> = {};
    for (const tipo of ["ESCALA", "ALTERACAO", "LEMBRETE"] as const) {
      const texto = templates[tipo]?.trim();
      if (texto && texto !== TEMPLATES_PADRAO[tipo]) custom[tipo] = texto;
    }
    data.whatsappTemplates = Object.keys(custom).length > 0 ? custom : null;
  }

  const c = await prisma.company.update({
    where: { id: companyId },
    data,
    select: { whatsappAssistente: true, whatsappPhoneId: true, whatsappToken: true },
  });

  // Envio de teste opcional
  if (testarPara && nestorConfigurado(c)) {
    const tel = normalizarTelefone(testarPara);
    if (!tel) return NextResponse.json({ error: "Telefone de teste inválido" }, { status: 400 });
    const nome = c.whatsappAssistente?.trim() || ASSISTENTE_PADRAO;
    const erro = await enviarWhatsapp(
      c,
      tel,
      `🤖 *${nome}* — teste de configuração\n\nSe você recebeu esta mensagem, o assistente de WhatsApp está funcionando! ✅`
    );
    if (erro) return NextResponse.json({ error: `Salvo, mas o teste falhou: ${erro}` }, { status: 400 });
    return NextResponse.json({ success: true, teste: "enviado" });
  }

  return NextResponse.json({ success: true });
}
