import { prisma } from "@/lib/prisma";

// Log de auditoria. NUNCA lança erro — auditoria não pode quebrar a operação.

type SessUser = {
  id?: string;
  companyId?: string;
  name?: string | null;
  email?: string | null;
  role?: string;
};

interface Entrada {
  tipo: "ACESSO" | "ALTERACAO" | "LOGIN";
  acao: string;
  modulo?: string | null;
  detalhe?: string | null;
}

export async function auditar(user: SessUser | null | undefined, entrada: Entrada) {
  try {
    if (!user?.companyId) return;
    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id || null,
        userNome: user.name || user.email || "—",
        userRole: user.role || null,
        tipo: entrada.tipo,
        acao: entrada.acao,
        modulo: entrada.modulo || null,
        detalhe: entrada.detalhe || null,
      },
    });
  } catch {
    // silencioso
  }
}
