import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/import-bubble";
import { compararRegistros, normalizarChave, type Decisao } from "@/lib/importar-revisao";
import { lerTodos, type BubbleConfig } from "@/lib/bubble-api";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Importação de membros da equipe (funcionários, freelancers, técnicos) a
// partir de um CSV genérico ou direto do Bubble (tipos "equipe" e
// "especialidade_tecnicos"). Não duplica: cruza por bubbleId, CPF ou nome;
// divergências viram revisão item a item (manter / atualizar / criar).

export interface LinhaMembro {
  bubbleId: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  rg: string | null;
  cpf: string | null;
  tipo: string; // FUNCIONARIO | FREELANCER | TECNICO
  pix: string | null;
  cache: number | null;
  observacoes: string | null;
  especialidades: string[];
}

const CAMPOS = [
  { campo: "telefone", label: "Telefone" },
  { campo: "email", label: "E-mail" },
  { campo: "rg", label: "RG" },
  { campo: "cpf", label: "CPF" },
  { campo: "tipo", label: "Tipo" },
  { campo: "pix", label: "PIX" },
  { campo: "cache", label: "Cachê" },
] as const;
type Campo = (typeof CAMPOS)[number]["campo"];

const txt = (v: any): string => (v == null ? "" : String(v).trim());
const ouNull = (v: any): string | null => txt(v) || null;
const soDigitos = (v: any): string => txt(v).replace(/\D/g, "");

function numero(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  const s = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

export function mapearTipo(v: any): string {
  const s = normalizarChave(txt(v));
  if (!s) return "FREELANCER";
  if (s.includes("fixo") || s.includes("func") || s.includes("clt") || s.includes("efetiv")) return "FUNCIONARIO";
  if (s.includes("tecn")) return "TECNICO";
  return "FREELANCER";
}

function formatarCpf(v: any): string | null {
  const d = soDigitos(v);
  if (d.length !== 11) return ouNull(v);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatarTelefone(v: any): string | null {
  let d = soDigitos(v);
  if (!d) return null;
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return txt(v);
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** Nomes de coluna aceitos (normalizados) → campo. */
const COLUNAS: Record<string, keyof LinhaMembro> = {
  nome: "nome", "nome completo": "nome", membro: "nome", tecnico: "nome",
  telefone: "telefone", celular: "telefone", whatsapp: "telefone", fone: "telefone",
  email: "email", "e-mail": "email",
  rg: "rg", cpf: "cpf",
  tipo: "tipo", vinculo: "tipo", "freela/fixo": "tipo", "tipo (freela/fixo)": "tipo",
  pix: "pix", "chave pix": "pix",
  cache: "cache", "cachê": "cache", "cache padrao": "cache", salario: "cache", "salário": "cache", valor: "cache",
  observacoes: "observacoes", "observações": "observacoes", obs: "observacoes",
  especialidades: "especialidades", especialidade: "especialidades", funcao: "especialidades", "função": "especialidades",
  "unique id": "bubbleId", _id: "bubbleId", id: "bubbleId", bubbleid: "bubbleId",
};

export interface ResultadoCsv {
  linhas: LinhaMembro[];
  colunasReconhecidas: string[];
  colunasIgnoradas: string[];
}

/** Lê um CSV com cabeçalho; separador vírgula ou ponto e vírgula. */
export function lerCsvMembros(csv: string): ResultadoCsv {
  const texto = csv.replace(/^﻿/, "");
  // Ponto e vírgula (Excel pt-BR) → vírgula, só se a 1ª linha não tiver vírgulas
  const primeira = texto.split(/\r?\n/)[0] || "";
  const usaPontoVirgula = primeira.includes(";") && !primeira.includes(",");
  const rows = parseCsv(texto, usaPontoVirgula ? ";" : ",").filter((r) => r.some((c) => c.trim()));
  if (rows.length < 2) return { linhas: [], colunasReconhecidas: [], colunasIgnoradas: [] };

  const cab = rows[0].map((h) => normalizarChave(h).replace(/[*:]/g, "").trim());
  const mapa: (keyof LinhaMembro | null)[] = cab.map((h) => COLUNAS[h] ?? null);
  const reconhecidas: string[] = [];
  const ignoradas: string[] = [];
  cab.forEach((h, i) => (mapa[i] ? reconhecidas : ignoradas).push(rows[0][i].trim()));
  if (!mapa.includes("nome")) throw new Error("O CSV precisa ter uma coluna 'Nome'.");

  const linhas: LinhaMembro[] = [];
  for (const r of rows.slice(1)) {
    const bruto: Record<string, string> = {};
    mapa.forEach((k, i) => {
      if (k && r[i] != null && r[i].trim()) bruto[k] = bruto[k] ? `${bruto[k]}; ${r[i].trim()}` : r[i].trim();
    });
    const nome = txt(bruto.nome);
    if (!nome) continue;
    linhas.push({
      bubbleId: ouNull(bruto.bubbleId),
      nome,
      telefone: formatarTelefone(bruto.telefone),
      email: ouNull(bruto.email)?.toLowerCase() ?? null,
      rg: ouNull(bruto.rg),
      cpf: formatarCpf(bruto.cpf),
      tipo: mapearTipo(bruto.tipo),
      pix: ouNull(bruto.pix),
      cache: numero(bruto.cache),
      observacoes: ouNull(bruto.observacoes),
      // Várias especialidades na mesma célula: "Som; Luz" ou "Som | Luz"
      especialidades: (bruto.especialidades || "")
        .split(/[;|]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }
  return { linhas, colunasReconhecidas: reconhecidas, colunasIgnoradas: ignoradas };
}

// ── Bubble (Data API) ────────────────────────────────────────────────────────

/** Lê "equipe" + "especialidade_tecnicos" do Bubble e converte em linhas. */
export async function lerEquipeBubble(c: BubbleConfig): Promise<LinhaMembro[]> {
  const [equipe, especialidades] = await Promise.all([
    lerTodos<any>(c, "equipe", 2000),
    lerTodos<any>(c, "especialidade_tecnicos", 2000),
  ]);
  const normNome = (r: any) => txt(r.nome ?? r.Nome ?? campo(r, "nome"));
  const espPorId = new Map(especialidades.map((e) => [e._id as string, normNome(e)]));

  // O Bubble devolve os campos pelo *display name* (acentos, maiúsculas,
  // "Tipo (Freela/Fixo)"...). Busca sem acento/caixa, aceitando prefixo.
  function campo(r: any, ...candidatos: string[]) {
    const entradas = Object.entries(r).map(([k, v]) => [normalizarChave(k), v] as const);
    for (const c of candidatos) {
      const alvo = normalizarChave(c);
      const exato = entradas.find(([k]) => k === alvo);
      if (exato && exato[1] != null && exato[1] !== "") return exato[1];
    }
    for (const c of candidatos) {
      const alvo = normalizarChave(c);
      const pref = entradas.find(([k]) => k.startsWith(alvo));
      if (pref && pref[1] != null && pref[1] !== "") return pref[1];
    }
    return undefined;
  }

  return equipe
    .map((r): LinhaMembro | null => {
      const nome = normNome(r);
      if (!nome) return null;
      const cache = numero(campo(r, "cachê", "cache"));
      const salario = numero(campo(r, "salário", "salario"));
      const obs = txt(campo(r, "observações", "observacoes", "obs"));
      const esp = campo(r, "especialidade");
      const listaEsp: string[] = Array.isArray(esp) ? esp : [];
      return {
        bubbleId: r._id,
        nome,
        telefone: formatarTelefone(campo(r, "telefone", "celular", "whatsapp")),
        email: ouNull(campo(r, "email", "e-mail"))?.toLowerCase() ?? null,
        rg: ouNull(campo(r, "rg")),
        cpf: formatarCpf(campo(r, "cpf")),
        tipo: mapearTipo(campo(r, "tipo (freela/fixo)", "tipo")),
        pix: ouNull(campo(r, "pix")),
        cache: cache ?? salario,
        observacoes:
          [obs, salario != null && cache != null ? `Salário (Bubble): R$ ${salario.toFixed(2)}` : ""]
            .filter(Boolean)
            .join("\n") || null,
        especialidades: listaEsp.map((id) => espPorId.get(id) || "").filter(Boolean),
      };
    })
    .filter((x): x is LinhaMembro => !!x);
}

// ── Comparação e gravação ────────────────────────────────────────────────────

type MembroDb = Awaited<ReturnType<typeof carregarExistentes>>[number];

async function carregarExistentes(companyId: string) {
  return prisma.membro.findMany({
    where: { companyId },
    include: { especialidades: { include: { especialidade: { select: { nome: true } } } } },
  });
}

function indices(existentes: MembroDb[]) {
  const porBubble = new Map(existentes.filter((e) => e.bubbleId).map((e) => [e.bubbleId!, e]));
  const porCpf = new Map(existentes.filter((e) => soDigitos(e.cpf).length === 11).map((e) => [soDigitos(e.cpf), e]));
  const porNome = new Map(existentes.map((e) => [normalizarChave(e.nome), e]));
  const achar = (l: LinhaMembro) =>
    (l.bubbleId && porBubble.get(l.bubbleId)) ||
    (soDigitos(l.cpf).length === 11 && porCpf.get(soDigitos(l.cpf))) ||
    porNome.get(normalizarChave(l.nome)) ||
    undefined;
  const chave = (l: LinhaMembro) => {
    const e = achar(l);
    return e ? `db:${e.id}` : `nome:${normalizarChave(l.nome)}`;
  };
  return { porBubble, porCpf, porNome, achar, chave };
}

export async function compararMembros(companyId: string, linhas: LinhaMembro[]) {
  const existentes = await carregarExistentes(companyId);
  const ix = indices(existentes);
  const comp = compararRegistros(linhas, existentes, {
    chaveNovo: ix.chave,
    chaveExistente: (e) => `db:${e.id}`,
    idExistente: (e) => e.id,
    resumoExistente: (e) =>
      [e.tipo, e.telefone, e.cpf && `CPF ${e.cpf}`].filter(Boolean).join(" · ") || "sem detalhes",
    campos: CAMPOS.map((c) => ({
      campo: c.campo,
      label: c.label,
      novo: (n: LinhaMembro) => n[c.campo as Campo],
      atual: (e) => (e as any)[c.campo as Campo],
    })),
  });
  return {
    total: linhas.length,
    novos: comp.novos.length,
    iguais: comp.iguais,
    divergentes: comp.divergentes.map((d) => ({
      chave: d.chave,
      titulo: d.novo.nome,
      existenteResumo: d.existenteResumo,
      diffs: d.diffs,
    })),
    amostra: linhas.slice(0, 8).map((l) => ({
      nome: l.nome,
      tipo: l.tipo,
      telefone: l.telefone,
      especialidades: l.especialidades.join(", "),
    })),
  };
}

export interface RelatorioMembros {
  criados: number;
  atualizados: number;
  mantidos: number;
  especialidadesCriadas: number;
}

export async function importarMembros(
  companyId: string,
  linhas: LinhaMembro[],
  decisoes: Record<string, Decisao>
): Promise<RelatorioMembros> {
  const rel: RelatorioMembros = { criados: 0, atualizados: 0, mantidos: 0, especialidadesCriadas: 0 };
  const existentes = await carregarExistentes(companyId);
  const ix = indices(existentes);

  // Especialidades: reaproveita as da empresa (ou globais), cria as que faltam
  const espDb = await prisma.especialidade.findMany({
    where: { OR: [{ companyId }, { companyId: null }] },
    select: { id: true, nome: true },
  });
  const espPorNome = new Map(espDb.map((e) => [normalizarChave(e.nome), e.id]));
  const idsEspecialidades = async (nomes: string[]) => {
    const ids: string[] = [];
    for (const n of nomes) {
      const k = normalizarChave(n);
      if (!k) continue;
      let id = espPorNome.get(k);
      if (!id) {
        id = (await prisma.especialidade.create({ data: { nome: n.trim(), companyId } })).id;
        espPorNome.set(k, id);
        rel.especialidadesCriadas++;
      }
      if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  };

  const vazio = (v: unknown) => v == null || (typeof v === "string" && !v.trim());

  for (const l of linhas) {
    const decisao = decisoes[ix.chave(l)];
    const existente = decisao === "criar" ? undefined : ix.achar(l);

    if (existente) {
      const patch: any = {};
      for (const c of CAMPOS) {
        const novo = l[c.campo as Campo];
        if (novo == null || novo === "") continue;
        const atual = (existente as any)[c.campo as Campo];
        if (decisao === "atualizar" ? String(novo) !== String(atual ?? "") : vazio(atual)) patch[c.campo] = novo;
      }
      if (l.observacoes && vazio(existente.observacoes)) patch.observacoes = l.observacoes;
      if (!existente.bubbleId && l.bubbleId) patch.bubbleId = l.bubbleId;
      // Especialidades que faltam são sempre acrescentadas (nunca removidas)
      const jaTem = new Set(existente.especialidades.map((e) => normalizarChave(e.especialidade.nome)));
      const faltam = l.especialidades.filter((n) => !jaTem.has(normalizarChave(n)));
      if (faltam.length > 0) {
        const ids = await idsEspecialidades(faltam);
        patch.especialidades = { create: ids.map((especialidadeId) => ({ especialidadeId })) };
      }
      if (Object.keys(patch).length > 0) {
        await prisma.membro.update({ where: { id: existente.id }, data: patch });
        rel.atualizados++;
      } else rel.mantidos++;
      continue;
    }

    const ids = await idsEspecialidades(l.especialidades);
    const novo = await prisma.membro.create({
      data: {
        companyId,
        nome: l.nome,
        telefone: l.telefone,
        email: l.email,
        rg: l.rg,
        cpf: l.cpf,
        tipo: l.tipo,
        pix: l.pix,
        cache: l.cache,
        observacoes: l.observacoes,
        bubbleId: l.bubbleId,
        especialidades: { create: ids.map((especialidadeId) => ({ especialidadeId })) },
      },
      include: { especialidades: { include: { especialidade: { select: { nome: true } } } } },
    });
    rel.criados++;
    if (novo.bubbleId) ix.porBubble.set(novo.bubbleId, novo);
    if (soDigitos(novo.cpf).length === 11) ix.porCpf.set(soDigitos(novo.cpf), novo);
    ix.porNome.set(normalizarChave(novo.nome), novo);
  }
  return rel;
}
