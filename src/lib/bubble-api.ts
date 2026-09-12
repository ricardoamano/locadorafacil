// Cliente da Data API do Bubble (lado servidor). Lê tipos, campos e registros
// do app antigo para a migração — com os vínculos preservados pelos ids.

export interface BubbleConfig {
  bubbleAppUrl: string | null;
  bubbleApiToken: string | null;
}

export function bubbleConfigurado(c: BubbleConfig | null | undefined): boolean {
  return Boolean(c?.bubbleAppUrl && c?.bubbleApiToken);
}

function base(c: BubbleConfig): string {
  // aceita "https://app.bubbleapps.io", "https://app.bubbleapps.io/version-test" ou domínio próprio
  return c.bubbleAppUrl!.trim().replace(/\/+$/, "").replace(/\/api\/1\.1$/, "");
}

async function chamar<T>(c: BubbleConfig, caminho: string): Promise<T> {
  const res = await fetch(`${base(c)}/api/1.1/${caminho}`, {
    headers: { Authorization: `Bearer ${c.bubbleApiToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Bubble recusou o token (401/403). Confira a Private key e se a Data API está habilitada."
        : res.status === 404
          ? "Endereço não encontrado (404). Confira a URL do app e se o tipo está exposto na Data API."
          : `Bubble respondeu ${res.status}: ${txt.slice(0, 200)}`
    );
  }
  return (await res.json()) as T;
}

export interface BubbleCampo {
  id: string;
  display: string;
  type: string;
}

/** Tipos expostos na Data API e seus campos (GET /meta). */
export async function lerMeta(c: BubbleConfig): Promise<Record<string, BubbleCampo[]>> {
  const meta = await chamar<{ types?: Record<string, { fields?: BubbleCampo[] }>; get?: string[] }>(
    c,
    "meta"
  );
  const out: Record<string, BubbleCampo[]> = {};
  const expostos = new Set(meta.get || []);
  for (const [tipo, def] of Object.entries(meta.types || {})) {
    if (expostos.size > 0 && !expostos.has(tipo)) continue;
    out[tipo] = def.fields || [];
  }
  return out;
}

export interface PaginaBubble<T = Record<string, unknown>> {
  results: T[];
  remaining: number;
  count: number;
  cursor: number;
}

/** Uma página de registros de um tipo (máx. 100 por chamada). */
export async function lerPagina<T = Record<string, unknown>>(
  c: BubbleConfig,
  tipo: string,
  cursor = 0,
  limit = 100
): Promise<PaginaBubble<T>> {
  const r = await chamar<{ response: PaginaBubble<T> }>(
    c,
    `obj/${encodeURIComponent(tipo)}?cursor=${cursor}&limit=${limit}`
  );
  return r.response;
}

/**
 * Todos os registros de um tipo (limite de segurança configurável).
 * A 1ª página informa quantos faltam; as demais são baixadas em paralelo
 * (lotes de 5 páginas) — tipos grandes saem em segundos, não em minutos.
 */
export async function lerTodos<T = Record<string, unknown>>(
  c: BubbleConfig,
  tipo: string,
  maximo = 5000
): Promise<T[]> {
  const primeira = await lerPagina<T>(c, tipo, 0, 100);
  const todos: T[] = [...primeira.results];
  if (primeira.remaining <= 0 || primeira.results.length === 0) return todos;

  const total = Math.min(primeira.results.length + primeira.remaining, maximo);
  const cursores: number[] = [];
  for (let cur = primeira.results.length; cur < total; cur += 100) cursores.push(cur);

  const PARALELO = 5;
  for (let i = 0; i < cursores.length; i += PARALELO) {
    const paginas = await Promise.all(
      cursores.slice(i, i + PARALELO).map((cur) => lerPagina<T>(c, tipo, cur, 100))
    );
    for (const p of paginas) todos.push(...p.results);
  }
  return todos.slice(0, maximo);
}
