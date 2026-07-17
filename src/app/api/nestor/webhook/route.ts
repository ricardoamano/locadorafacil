import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarWhatsapp, normalizarTelefone, ASSISTENTE_PADRAO } from "@/lib/nestor";
import { identificarRemetente, auditarRemetente } from "@/lib/nestor-auth";
import { responderOrcamentoRapido, conversaDesdeReset } from "@/lib/nestor-orcamento";
import { tratarComandoFormalizar, tratarComandoAtualizar } from "@/lib/nestor-formalizar";

const APP_URL = (process.env.NEXTAUTH_URL || "https://locadorafacil.app").replace(/\/$/, "");

// NESTOR — webhook de RECEBIMENTO do WhatsApp (Cloud API / Meta).
// Fluxo do orçamento rápido: um número autorizado manda o briefing para o
// número do assistente; identificamos a empresa pelo Phone Number ID, o
// remetente pelo telefone (membro da equipe ou lista de autorizados), a IA
// consulta o catálogo e a resposta volta pelo próprio WhatsApp.

export const maxDuration = 300;

// ── Verificação do webhook (feita uma única vez no painel da Meta) ────────────
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge) {
    const empresa = await prisma.company.findFirst({
      where: { whatsappVerifyToken: token },
      select: { id: true },
    });
    if (empresa) return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Tipos mínimos do payload da Cloud API
interface MetaMensagem {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
}
interface MetaValue {
  metadata?: { phone_number_id?: string };
  messages?: MetaMensagem[];
}

export async function POST(req: NextRequest) {
  // A Meta reenvia eventos sem resposta 200 — respondemos 200 sempre e usamos
  // o wamid (id único da mensagem) para nunca processar a mesma duas vezes.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const entradas = ((body as { entry?: { changes?: { value?: MetaValue }[] }[] })?.entry || [])
    .flatMap((e) => e.changes || [])
    .map((c) => c.value)
    .filter(Boolean) as MetaValue[];

  for (const value of entradas) {
    const phoneId = value.metadata?.phone_number_id;
    const mensagens = value.messages || [];
    if (!phoneId || mensagens.length === 0) continue; // status/reads etc.

    const empresa = await prisma.company.findFirst({
      where: { whatsappPhoneId: phoneId },
      select: {
        id: true,
        name: true,
        whatsappAssistente: true,
        whatsappPhoneId: true,
        whatsappToken: true,
        nestorNumeros: true,
      },
    });
    if (!empresa) continue;
    const assistente = empresa.whatsappAssistente?.trim() || ASSISTENTE_PADRAO;

    for (const msg of mensagens) {
      const de = normalizarTelefone(msg.from) || msg.from;
      const texto = msg.type === "text" ? msg.text?.body?.trim() : null;

      // Dedupe: se o wamid já existe, é reentrega da Meta — ignora.
      try {
        await prisma.nestorConversa.create({
          data: {
            companyId: empresa.id,
            telefone: de,
            papel: "USUARIO",
            texto: texto || `[mensagem de tipo ${msg.type}]`,
            wamid: msg.id,
          },
        });
      } catch {
        continue; // já processada
      }

      const remetente = await identificarRemetente(empresa.id, msg.from, empresa.nestorNumeros);
      if (!remetente) {
        await enviarWhatsapp(
          empresa,
          de,
          `🤖 *${assistente}* — ${empresa.name}\n\nOlá! Este número não está autorizado a usar o assistente. Fale com a administração da ${empresa.name}. 🙏`
        );
        continue;
      }

      await prisma.nestorConversa.updateMany({
        where: { wamid: msg.id },
        data: { autorNome: remetente.nome },
      });

      if (!texto) {
        await enviarWhatsapp(
          empresa,
          de,
          `🤖 *${assistente}*\n\nPor enquanto eu só entendo mensagens de texto. Me manda o briefing escrito que eu monto o orçamento! ✍️`
        );
        continue;
      }

      // Comandos de controle da conversa
      const comando = texto.toLowerCase();
      if (["nova", "novo", "limpar", "reset", "recomeçar", "recomecar"].includes(comando)) {
        await prisma.nestorConversa.create({
          data: { companyId: empresa.id, telefone: de, papel: "RESET", texto: "nova conversa" },
        });
        await enviarWhatsapp(
          empresa,
          de,
          `🤖 *${assistente}*\n\nConversa reiniciada! Me manda o briefing do próximo orçamento. 🚀`
        );
        continue;
      }

      // "formalizar" (ou resposta ao questionário) → cria o orçamento oficial
      const corpoF = await tratarComandoFormalizar(
        empresa.id,
        de,
        texto,
        assistente,
        `WhatsApp — ${remetente.nome}`,
        APP_URL
      );
      if (corpoF) {
        await prisma.nestorConversa.create({
          data: { companyId: empresa.id, telefone: de, papel: "ASSISTENTE", texto: corpoF, autorNome: assistente },
        });
        await enviarWhatsapp(empresa, de, corpoF);
        await auditarRemetente(empresa.id, remetente, assistente, "Formalização de orçamento via WhatsApp");
        continue;
      }

      // Alteração de orçamento já formalizado nesta conversa → grava de verdade
      const corpoA = await tratarComandoAtualizar(
        empresa.id,
        await conversaDesdeReset(empresa.id, de),
        texto,
        assistente,
        APP_URL
      );
      if (corpoA) {
        await prisma.nestorConversa.create({
          data: { companyId: empresa.id, telefone: de, papel: "ASSISTENTE", texto: corpoA, autorNome: assistente },
        });
        await enviarWhatsapp(empresa, de, corpoA);
        await auditarRemetente(empresa.id, remetente, assistente, "Atualização de orçamento via WhatsApp");
        continue;
      }

      const resposta = await responderOrcamentoRapido(empresa.id, de, texto);
      const corpo = resposta.texto
        ? resposta.texto
        : `🤖 *${assistente}*\n\n⚠️ Não consegui montar agora (${resposta.erro || "erro desconhecido"}). Tenta de novo em instantes.`;

      await prisma.nestorConversa.create({
        data: {
          companyId: empresa.id,
          telefone: de,
          papel: "ASSISTENTE",
          texto: corpo,
          autorNome: assistente,
        },
      });
      const erroEnvio = await enviarWhatsapp(empresa, de, corpo);
      if (erroEnvio) console.error("NESTOR webhook: falha ao responder:", erroEnvio);

      // Auditoria como o usuário vinculado ao membro (ex.: Ricardo Amano)
      await auditarRemetente(empresa.id, remetente, assistente, texto);
    }
  }

  return NextResponse.json({ ok: true });
}
