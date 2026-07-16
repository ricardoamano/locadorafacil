import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarWhatsapp, normalizarTelefone, ASSISTENTE_PADRAO } from "@/lib/nestor";
import { responderOrcamentoRapido } from "@/lib/nestor-orcamento";

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

// ── Comparação de telefones BR tolerante ao 9º dígito ────────────────────────
// A Meta às vezes entrega números antigos sem o 9 (55 11 8 dígitos). Comparamos
// por DDD + últimos 8 dígitos para casar com o cadastro em qualquer formato.
function chaveTelefone(telefone: string | null | undefined): string | null {
  const norm = normalizarTelefone(telefone);
  if (!norm) return null;
  const semPais = norm.slice(2); // remove o 55
  const ddd = semPais.slice(0, 2);
  const numero = semPais.slice(2);
  return `${ddd}${numero.slice(-8)}`;
}

interface Autorizado {
  nome: string;
  userId: string | null;
}

/** Remetente é membro da equipe (com telefone) ou está na lista de números extras. */
async function identificarRemetente(
  companyId: string,
  de: string,
  numerosExtras: unknown
): Promise<Autorizado | null> {
  const chaveDe = chaveTelefone(de);
  if (!chaveDe) return null;

  const membros = await prisma.membro.findMany({
    where: { companyId, telefone: { not: null } },
    select: { nome: true, telefone: true, userId: true },
  });
  const membro = membros.find((m) => chaveTelefone(m.telefone) === chaveDe);
  if (membro) return { nome: membro.nome, userId: membro.userId };

  if (Array.isArray(numerosExtras)) {
    const extra = (numerosExtras as { nome?: string; telefone?: string }[]).find(
      (n) => chaveTelefone(n?.telefone) === chaveDe
    );
    if (extra) return { nome: extra.nome?.trim() || "Autorizado", userId: null };
  }
  return null;
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
      if (remetente.userId) {
        const user = await prisma.user.findUnique({
          where: { id: remetente.userId },
          select: { id: true, name: true, email: true, role: true },
        });
        if (user) {
          const { auditar } = await import("@/lib/auditoria");
          await auditar(
            { ...user, companyId: empresa.id },
            {
              tipo: "ACESSO",
              modulo: "orcamentos",
              acao: `Orçamento rápido via WhatsApp (${assistente})`,
              detalhe: texto.slice(0, 300),
            }
          );
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
