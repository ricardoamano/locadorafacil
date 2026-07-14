import { MODULOS } from "@/lib/modulos";

// Configuração de perfis (só o superadmin edita): rótulos (nomenclaturas) e
// os módulos que o perfil ADMIN pode acessar.

export type PerfilChave = "SUPERADMIN" | "ADMIN" | "USER";

export const ROTULOS_PADRAO: Record<PerfilChave, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Administrador",
  USER: "Usuário",
};

export interface PerfisConfig {
  rotulos: Record<PerfilChave, string>;
  // Módulos que o perfil ADMIN acessa. null/vazio = todos os operacionais.
  adminModulos: string[] | null;
}

// Módulos que um ADMIN pode receber (tudo menos Configurações)
export const MODULOS_ADMIN = MODULOS.filter((m) => m.key !== "configuracoes").map((m) => ({
  key: m.key,
  label: m.label,
}));

export function normalizarPerfis(json: unknown): PerfisConfig {
  const c = (json || {}) as Record<string, unknown>;
  const r = (c.rotulos || {}) as Record<string, unknown>;
  return {
    rotulos: {
      SUPERADMIN: String(r.SUPERADMIN || ROTULOS_PADRAO.SUPERADMIN).slice(0, 40),
      ADMIN: String(r.ADMIN || ROTULOS_PADRAO.ADMIN).slice(0, 40),
      USER: String(r.USER || ROTULOS_PADRAO.USER).slice(0, 40),
    },
    adminModulos: Array.isArray(c.adminModulos)
      ? (c.adminModulos as string[]).filter((k) => typeof k === "string" && k !== "configuracoes")
      : null,
  };
}

export function rotuloPerfil(json: unknown, role?: string | null): string {
  const cfg = normalizarPerfis(json);
  if (role === "SUPERADMIN" || role === "ADMIN" || role === "USER") return cfg.rotulos[role];
  return role || "—";
}
