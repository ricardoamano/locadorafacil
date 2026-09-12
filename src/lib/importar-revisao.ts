// Revisão de divergências em importações (clientes, locais, itens).
// Compara cada registro que chega com o que já existe pela chave natural e
// classifica: NOVO (não existe), IGUAL (existe e nada conflita — campos em
// branco podem ser completados) ou DIVERGENTE (existe e algum campo tem valor
// diferente nos dois lados → o usuário decide item a item).

export type Decisao = "manter" | "atualizar" | "criar";

export interface Diff {
  campo: string;
  label: string;
  atual: string;
  novo: string;
}

export interface Divergencia<T> {
  chave: string;
  novo: T;
  existenteId: string;
  existenteResumo: string;
  diffs: Diff[];
}

export interface Comparacao<T> {
  novos: T[];
  iguais: number;
  divergentes: Divergencia<T>[];
}

export interface CampoComparavel<T, E> {
  campo: string;
  label: string;
  novo: (t: T) => string | number | null | undefined;
  atual: (e: E) => string | number | null | undefined;
}

export function normalizarChave(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function valorTexto(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v).trim();
}

export function compararRegistros<T, E>(
  novos: T[],
  existentes: E[],
  opts: {
    chaveNovo: (t: T) => string;
    chaveExistente: (e: E) => string;
    idExistente: (e: E) => string;
    resumoExistente: (e: E) => string;
    campos: CampoComparavel<T, E>[];
  }
): Comparacao<T> {
  const porChave = new Map<string, E>();
  for (const e of existentes) {
    const k = opts.chaveExistente(e);
    if (k && !porChave.has(k)) porChave.set(k, e);
  }

  const out: Comparacao<T> = { novos: [], iguais: 0, divergentes: [] };
  for (const n of novos) {
    const k = opts.chaveNovo(n);
    const e = k ? porChave.get(k) : undefined;
    if (!e) {
      out.novos.push(n);
      continue;
    }
    // Só é divergência quando os DOIS lados têm valor e eles diferem.
    // Campo em branco no sistema + preenchido no arquivo = completar (não conflita).
    const diffs: Diff[] = [];
    for (const c of opts.campos) {
      const a = valorTexto(c.atual(e));
      const b = valorTexto(c.novo(n));
      if (a && b && normalizarChave(a) !== normalizarChave(b))
        diffs.push({ campo: c.campo, label: c.label, atual: a, novo: b });
    }
    if (diffs.length === 0) out.iguais += 1;
    else
      out.divergentes.push({
        chave: k,
        novo: n,
        existenteId: opts.idExistente(e),
        existenteResumo: opts.resumoExistente(e),
        diffs,
      });
  }
  return out;
}
