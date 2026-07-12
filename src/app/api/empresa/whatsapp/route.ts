import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { nestorConfigurado, normalizarTelefone, enviarWhatsapp } from "@/lib/nestor";

// Configuração do NESTOR (WhatsApp Business Cloud API) da empresa — só admin

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
    select: { whatsappNumero: true, whatsappPhoneId: true, whatsappToken: true },
  });
  return NextResponse.json({
    numero: c?.whatsappNumero || "",
    phoneId: c?.whatsappPhoneId || "",
    // token nunca volta inteiro — só indica se existe
    tokenConfigurado: Boolean(c?.whatsappToken),
    configurado: nestorConfigurado(c),
  });
}

export async function POST(req: NextRequest) {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { numero, phoneId, token, testarPara } = body as {
    numero?: string;
    phoneId?: string;
    token?: string;
    testarPara?: string;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    whatsappNumero: numero?.trim() || null,
    whatsappPhoneId: phoneId?.trim() || null,
  };
  // token vazio = manter o atual; "REMOVER" = apagar
  if (token === "REMOVER") data.whatsappToken = null;
  else if (token?.trim()) data.whatsappToken = token.trim();

  const c = await prisma.company.update({
    where: { id: companyId },
    data,
    select: { whatsappPhoneId: true, whatsappToken: true },
  });

  // Envio de teste opcional
  if (testarPara && nestorConfigurado(c)) {
    const tel = normalizarTelefone(testarPara);
    if (!tel) return NextResponse.json({ error: "Telefone de teste inválido" }, { status: 400 });
    const erro = await enviarWhatsapp(
      c,
      tel,
      "🤖 *NESTOR* — teste de configuração\n\nSe você recebeu esta mensagem, o assistente de WhatsApp está funcionando! ✅"
    );
    if (erro) return NextResponse.json({ error: `Salvo, mas o teste falhou: ${erro}` }, { status: 400 });
    return NextResponse.json({ success: true, teste: "enviado" });
  }

  return NextResponse.json({ success: true });
}
