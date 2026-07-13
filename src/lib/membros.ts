import { prisma } from "@/lib/prisma";

/**
 * Valida o vínculo membro ↔ usuário do sistema: o usuário precisa ser da mesma
 * empresa e não pode já estar vinculado a outro membro.
 * Retorna a mensagem de erro, ou null se estiver tudo certo.
 */
export async function validarVinculoUsuario(
  userId: string,
  companyId: string,
  membroId?: string
): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true },
  });
  if (!user) return "Usuário não encontrado nesta empresa.";
  const jaVinculado = await prisma.membro.findFirst({
    where: { userId, ...(membroId ? { id: { not: membroId } } : {}) },
    select: { nome: true },
  });
  if (jaVinculado) return `Este usuário já está vinculado ao membro "${jaVinculado.nome}".`;
  return null;
}
