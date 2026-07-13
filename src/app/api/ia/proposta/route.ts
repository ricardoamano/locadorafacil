import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  clienteIa,
  INSTRUCOES_PROPOSTA_PADRAO,
  MODELO_PROPOSTA,
  normalizarSkills,
  instrucoesPorTipo,
} from "@/lib/ia";

// Chat de geração de propostas (Projeto Especial) — usa a skill da empresa

// Gerar uma proposta completa leva dezenas de segundos; sem isso a função
// é encerrada pela Vercel antes de responder.
export const maxDuration = 300;

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const mensagens = (body.mensagens || []) as { role: "user" | "assistant"; content: string }[];
  if (mensagens.length === 0 || mensagens[mensagens.length - 1].role !== "user")
    return NextResponse.json({ error: "Envie uma mensagem" }, { status: 400 });

  const ia = await clienteIa(companyId);
  if (!ia)
    return NextResponse.json(
      { error: "IA não configurada — peça ao administrador para configurar em Configurações → Inteligência Artificial." },
      { status: 400 }
    );

  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, iaInstrucoes: true, iaSkills: true },
  });

  const skills = normalizarSkills(empresa?.iaSkills, empresa?.iaInstrucoes);
  const instrucoes = instrucoesPorTipo(skills, "PROPOSTA", INSTRUCOES_PROPOSTA_PADRAO);

  const system = `${instrucoes}

Empresa que está propondo: ${empresa?.name || "—"}.`;

  try {
    const resposta = await ia.messages.create({
      model: MODELO_PROPOSTA,
      max_tokens: 8000,
      system,
      messages: mensagens.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    });
    const texto = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return NextResponse.json({ resposta: texto });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na IA";
    const status = msg.includes("authentication") || msg.includes("401") ? 400 : 502;
    return NextResponse.json(
      {
        error:
          status === 400
            ? "Chave de API inválida — confira em Configurações → Inteligência Artificial."
            : `Erro ao consultar a IA: ${msg}`,
      },
      { status }
    );
  }
}
