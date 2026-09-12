// Como um orçamento aparece na agenda (calendário interno e feed iCal).
// TODOS  → todos os dias entre início e fim (padrão)
// MARCOS → só o 1º e o último dia (locações longas, ex.: tablets por meses)
// DATAS  → só as datas escolhidas à mão (ex.: totem em 3 dias de um período de 7)

export type AgendaModo = "TODOS" | "MARCOS" | "DATAS";

export function normalizarAgendaModo(v: unknown): AgendaModo {
  return v === "MARCOS" || v === "DATAS" ? v : "TODOS";
}

/** Limpa a lista de datas: só "YYYY-MM-DD" válidos, sem repetição, em ordem. */
export function normalizarAgendaDatas(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const ok = new Set<string>();
  for (const x of v) {
    const s = String(x ?? "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T12:00:00`).getTime())) ok.add(s);
  }
  return [...ok].sort();
}

/** "YYYY-MM-DD" → Date local ao meio-dia (evita pular de dia por fuso). */
export function dataLocal(ymd: string): Date {
  const [a, m, d] = ymd.split("-").map(Number);
  return new Date(a, m - 1, d, 12, 0, 0);
}
