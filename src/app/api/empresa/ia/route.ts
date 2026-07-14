import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  INSTRUCOES_PROPOSTA_PADRAO,
  INSTRUCOES_ESCALA_PADRAO,
  INSTRUCOES_CONTRATO_PADRAO,
  normalizarSkills,
  type IaSkill,
  type SkillTipo,
} from "@/lib/ia";

// Configuração de IA da empresa — só admin

type SessionUser = { companyId?: string; role?: string };

async function getAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (u.role !== "SUPERADMIN" || !u.companyId) return null;
  return u.companyId;
}

const TIPOS: SkillTipo[] = ["PROPOSTA", "ESCALA", "CONTRATO", "GERAL"];

export async function GET() {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { iaApiKey: true, iaInstrucoes: true, iaSkills: true },
  });
  return NextResponse.json({
    configurado: Boolean(c?.iaApiKey),
    skills: normalizarSkills(c?.iaSkills, c?.iaInstrucoes),
    padroes: {
      PROPOSTA: INSTRUCOES_PROPOSTA_PADRAO,
      ESCALA: INSTRUCOES_ESCALA_PADRAO,
      CONTRATO: INSTRUCOES_CONTRATO_PADRAO,
    },
  });
}

export async function POST(req: NextRequest) {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { chave, skills } = body as { chave?: string; skills?: unknown };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (chave === "REMOVER") data.iaApiKey = null;
  else if (chave?.trim()) data.iaApiKey = chave.trim();

  if (Array.isArray(skills)) {
    const limpas: IaSkill[] = skills
      .map((raw, i) => {
        const s = (raw || {}) as Record<string, unknown>;
        const tipo = TIPOS.includes(s.tipo as SkillTipo)
          ? (s.tipo as SkillTipo)
          : "GERAL";
        return {
          id: String(s.id || `skill-${Date.now()}-${i}`),
          nome: String(s.nome || "").trim().slice(0, 120) || "Skill sem nome",
          tipo,
          instrucoes: String(s.instrucoes || "").trim(),
        };
      })
      .filter((s) => s.instrucoes.length > 0);
    data.iaSkills = limpas;
    // Mantém o campo legado em sincronia com a skill de propostas (compatibilidade)
    const proposta = limpas.find((s) => s.tipo === "PROPOSTA");
    data.iaInstrucoes =
      proposta && proposta.instrucoes !== INSTRUCOES_PROPOSTA_PADRAO
        ? proposta.instrucoes
        : null;
  }

  await prisma.company.update({ where: { id: companyId }, data });
  return NextResponse.json({ success: true });
}
