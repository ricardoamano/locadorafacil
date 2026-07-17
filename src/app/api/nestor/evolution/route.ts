import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarEvolution, ASSISTENTE_PADRAO } from "@/lib/nestor";
import { identificarRemetente, auditarRemetente } from "@/lib/nestor-auth";
import { responderOrcamentoRapido, conversaDesdeReset } from "@/lib/nestor-orcamento";
import { tratarComandoFormalizar, tratarComandoAtualizar } from "@/lib/nestor-formalizar";

const APP_URL = (process.env.NEXTAUTH_URL || "https://locadorafacil.app").replace(/\/$/, "");

// NESTOR — webhook da Evolution API (conexão por QR code).
// Configure na Evolution: webhook = https://SEU-DOMINIO/api/nestor/evolution?token=TOKEN
// (o mesmo token de verificação da tela Configurações → WhatsApp), evento MESSAGES_UPSERT.
//
// Conversa direta: qualquer mensagem de número autorizado vira orçamento rápido.
// Grupo: o assistente só responde quando a mensagem começa com o nome dele
// (ex.: "nestor 4 TVs e 2 notebooks...") — para não atropelar a conversa do grupo.

export const maxDuration = 300;

interface EvoKey {
  remoteJid?: string;
  fromMe?: boolean;
  id?: string;
  participant?: string;
}
interface EvoMessage {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string };
}
interface EvoData {
  key?: EvoKey;
  message?: EvoMessage;
  pushName?: string;
}

function extrairTexto(m: EvoMessage | undefined): string | null {
  const t = m?.conversation || m?.extendedTextMessage?.text || m?.imageMessage?.caption;
  return t?.trim() || null;
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ ok: true });

  const empresa = await prisma.company.findFirst({
    where: { whatsappVerifyToken: token },
    select: {
      id: true,
      name: true,
      whatsappAssistente: true,
      evolutionUrl: true,
      evolutionApiKey: true,
      evolutionInstance: true,
      nestorNumeros: true,
    },
  });
  if (!empresa) return NextResponse.json({ ok: true });

  let body: { event?: string; data?: EvoData | EvoData[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const evento = (body.event || "").toLowerCase().replace(/_/g, ".");
  if (evento && evento !== "messages.upsert") return NextResponse.json({ ok: true });

  const mensagens = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
  const assistente = empresa.whatsappAssistente?.trim() || ASSISTENTE_PADRAO;

  for (const data of mensagens) {
    const key = data.key || {};
    if (key.fromMe || !key.remoteJid || !key.id) continue;

    const ehGrupo = key.remoteJid.endsWith("@g.us");
    const remetenteJid = ehGrupo ? key.participant || "" : key.remoteJid;
    const remetenteFone = remetenteJid.split("@")[0].split(":")[0];
    let texto = extrairTexto(data.message);
    if (!texto) continue;

    // Em grupo, só responde quando chamado pelo nome (evita responder tudo)
    if (ehGrupo) {
      const gatilho = new RegExp(`^\\s*@?${assistente}[,:\\s]`, "i");
      if (!gatilho.test(texto)) continue;
      texto = texto.replace(gatilho, "").trim();
      if (!texto) continue;
    }

    // Chave da conversa: o chat (grupo ou contato) — contexto por conversa
    const chaveConversa = key.remoteJid;

    // Dedupe por id da mensagem (a Evolution pode reentregar)
    try {
      await prisma.nestorConversa.create({
        data: {
          companyId: empresa.id,
          telefone: chaveConversa,
          papel: "USUARIO",
          texto,
          wamid: key.id,
          autorNome: data.pushName || null,
        },
      });
    } catch {
      continue; // já processada
    }

    const remetente = await identificarRemetente(empresa.id, remetenteFone, empresa.nestorNumeros);
    if (!remetente) {
      // Em grupo ignora em silêncio; no privado avisa
      if (!ehGrupo)
        await enviarEvolution(
          empresa,
          key.remoteJid,
          `🤖 *${assistente}* — ${empresa.name}\n\nOlá! Este número não está autorizado a usar o assistente. Fale com a administração da ${empresa.name}. 🙏`
        );
      continue;
    }

    const comando = texto.toLowerCase();
    if (["nova", "novo", "limpar", "reset", "recomeçar", "recomecar"].includes(comando)) {
      await prisma.nestorConversa.create({
        data: { companyId: empresa.id, telefone: chaveConversa, papel: "RESET", texto: "nova conversa" },
      });
      await enviarEvolution(
        empresa,
        key.remoteJid,
        `🤖 *${assistente}*\n\nConversa reiniciada! Me manda o briefing do próximo orçamento. 🚀`
      );
      continue;
    }

    // "formalizar" (ou resposta ao questionário) → cria o orçamento oficial
    const corpoF = await tratarComandoFormalizar(
      empresa.id,
      chaveConversa,
      texto,
      assistente,
      `WhatsApp — ${remetente.nome}`,
      APP_URL
    );
    if (corpoF) {
      await prisma.nestorConversa.create({
        data: {
          companyId: empresa.id,
          telefone: chaveConversa,
          papel: "ASSISTENTE",
          texto: corpoF,
          autorNome: assistente,
        },
      });
      await enviarEvolution(empresa, key.remoteJid, corpoF);
      await auditarRemetente(empresa.id, remetente, assistente, "Formalização de orçamento via WhatsApp");
      continue;
    }

    // Alteração de orçamento já formalizado nesta conversa → grava de verdade
    const corpoA = await tratarComandoAtualizar(
      empresa.id,
      await conversaDesdeReset(empresa.id, chaveConversa),
      texto,
      assistente,
      APP_URL
    );
    if (corpoA) {
      await prisma.nestorConversa.create({
        data: { companyId: empresa.id, telefone: chaveConversa, papel: "ASSISTENTE", texto: corpoA, autorNome: assistente },
      });
      await enviarEvolution(empresa, key.remoteJid, corpoA);
      await auditarRemetente(empresa.id, remetente, assistente, "Atualização de orçamento via WhatsApp");
      continue;
    }

    const resposta = await responderOrcamentoRapido(empresa.id, chaveConversa, texto);
    const corpo = resposta.texto
      ? resposta.texto
      : `🤖 *${assistente}*\n\n⚠️ Não consegui montar agora (${resposta.erro || "erro desconhecido"}). Tenta de novo em instantes.`;

    await prisma.nestorConversa.create({
      data: {
        companyId: empresa.id,
        telefone: chaveConversa,
        papel: "ASSISTENTE",
        texto: corpo,
        autorNome: assistente,
      },
    });
    const erroEnvio = await enviarEvolution(empresa, key.remoteJid, corpo);
    if (erroEnvio) console.error("NESTOR evolution: falha ao responder:", erroEnvio);

    await auditarRemetente(empresa.id, remetente, assistente, texto);
  }

  return NextResponse.json({ ok: true });
}
