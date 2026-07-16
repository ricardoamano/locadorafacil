import { prisma } from "@/lib/prisma";
import { normalizarTelefone } from "@/lib/nestor";

// Autorização do orçamento rápido: quem pode conversar com o assistente.
// Compartilhado pelos webhooks da Meta (Cloud API) e da Evolution API.

// ── Comparação de telefones BR tolerante ao 9º dígito ────────────────────────
// As APIs às vezes entregam números antigos sem o 9 (55 11 8 dígitos).
// Comparamos por DDD + últimos 8 dígitos para casar em qualquer formato.
export function chaveTelefone(telefone: string | null | undefined): string | null {
  const norm = normalizarTelefone(telefone);
  if (!norm) return null;
  const semPais = norm.slice(2); // remove o 55
  const ddd = semPais.slice(0, 2);
  const numero = semPais.slice(2);
  return `${ddd}${numero.slice(-8)}`;
}

export interface Autorizado {
  nome: string;
  userId: string | null;
}

/** Remetente é membro da equipe (com telefone) ou está na lista de números extras. */
export async function identificarRemetente(
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

/** Auditoria como o usuário do sistema vinculado ao membro remetente. */
export async function auditarRemetente(
  companyId: string,
  remetente: Autorizado,
  assistente: string,
  detalhe: string
) {
  if (!remetente.userId) return;
  const user = await prisma.user.findUnique({
    where: { id: remetente.userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) return;
  const { auditar } = await import("@/lib/auditoria");
  await auditar(
    { ...user, companyId },
    {
      tipo: "ACESSO",
      modulo: "orcamentos",
      acao: `Orçamento rápido via WhatsApp (${assistente})`,
      detalhe: detalhe.slice(0, 300),
    }
  );
}
