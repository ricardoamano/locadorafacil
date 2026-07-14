"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Registra (best-effort) o acesso a um módulo quando o usuário navega.
// O servidor deduplica por módulo/usuário em janelas de 10 min.
export function AuditoriaAcesso() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}
