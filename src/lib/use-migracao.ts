"use client";

import { useEffect, useState } from "react";

// Interruptor único das ferramentas de migração/importação (botões Importar,
// Completar endereços, Migração do Bubble...). Ligado por padrão; o superadmin
// desliga em Configurações → Migração do Bubble quando o sistema estiver em
// uso pleno. Enquanto carrega, esconde (evita piscar botões que vão sumir).

let cache: boolean | null = null;

export function useFerramentasMigracao(): boolean {
  const [ativo, setAtivo] = useState<boolean>(cache ?? false);
  useEffect(() => {
    if (cache !== null) {
      setAtivo(cache);
      return;
    }
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        cache = me?.empresa?.ferramentasMigracao !== false;
        setAtivo(cache);
      })
      .catch(() => setAtivo(true));
  }, []);
  return ativo;
}

/** Invalida o cache após o superadmin trocar o interruptor. */
export function limparCacheMigracao() {
  cache = null;
}
