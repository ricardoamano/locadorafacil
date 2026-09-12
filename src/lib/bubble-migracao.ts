import { prisma } from "@/lib/prisma";
import { lerTodos, type BubbleConfig } from "@/lib/bubble-api";
import { normalizarChave } from "@/lib/importar-revisao";
import { calcularPrecos } from "@/lib/precos";
import { sincronizarUnidades } from "@/lib/unidades";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Migração Bubble → LocadoraFácil: orçamentos (salas, itens, cliente, contato,
// evento, local, desconto, status), ordens de serviço e faturas.
// Idempotente: cada registro guarda o id do Bubble; rodar de novo não duplica.
// Cruzamentos: local por bubbleId; cliente por bubbleId ou nome fantasia
// (cria se não existir); item por bubbleId, nome+modelo ou nome (cria "a
// revisar" se não existir).

type R = Record<string, any>;

export interface DadosBubble {
  orcamentos: R[];
  salas: R[];
  itensOrc: R[];
  eventos: R[];
  ativos: R[];
  catalogo: R[];
  itensAtivo: R[];
  marcas: R[];
  clientes: R[];
  contatos: R[];
  descontos: R[];
  faturas: R[];
  ordens: R[];
  enderecos: R[];
  locais: R[];
}

export async function carregarDadosBubble(c: BubbleConfig): Promise<DadosBubble> {
  const tipos = [
    "orcamento", "objsalas", "objitemorcamento", "objevento", "ativo", "objitemcatalogo",
    "objitemativo", "objmarca", "cliente", "objcontatoscliente", "obj_desconto", "fatura",
    "ordemdeservico", "objendereco", "local",
  ];
  // Em duplas para não estourar o limite de requisições do Bubble
  const out: R[][] = [];
  for (let i = 0; i < tipos.length; i += 2) {
    const lote = await Promise.all(tipos.slice(i, i + 2).map((t) => lerTodos<R>(c, t, 10000)));
    out.push(...lote);
  }
  const [orcamentos, salas, itensOrc, eventos, ativos, catalogo, itensAtivo, marcas, clientes, contatos, descontos, faturas, ordens, enderecos, locais] = out;
  return { orcamentos, salas, itensOrc, eventos, ativos, catalogo, itensAtivo, marcas, clientes, contatos, descontos, faturas, ordens, enderecos, locais };
}

// ── Cadastros: completa clientes, locais e contatos-pessoa com o que o Bubble tem ──

export interface RelatorioCadastros {
  clientesAtualizados: number;
  clientesCriados: number;
  contatosCriados: number;
  locaisAtualizados: number;
}

/**
 * Preenche campos EM BRANCO de clientes (razão social, CNPJ, IE/IM, endereço
 * completo) e locais (endereço) a partir do Bubble, cruzando por bubbleId ou
 * nome. Cria os contatos-pessoa que faltarem. Nunca sobrescreve o que já
 * está preenchido aqui.
 */
export async function completarCadastros(companyId: string, d: DadosBubble): Promise<RelatorioCadastros> {
  const rel: RelatorioCadastros = { clientesAtualizados: 0, clientesCriados: 0, contatosCriados: 0, locaisAtualizados: 0 };
  const enderecos = porId(d.enderecos);
  const contatosBubble = porId(d.contatos);
  const vazio = (v: string | null | undefined) => !v || !String(v).trim();

  const endereco = (id: any) => {
    const e = id ? enderecos.get(id) : null;
    if (!e) return null;
    return {
      rua: txt(e.rua) || null,
      numero: txt(e.numero) || null,
      complemento: txt(e.complemento) || null,
      bairro: txt(e.bairro) || null,
      cep: txt(e.cep) || null,
      cidade: txt(e.cidade) || null,
      estado: txt(e.estado).toUpperCase() || null,
    };
  };

  // Clientes
  const contatosDb = await prisma.contact.findMany({
    where: { companyId },
    include: { subContacts: { select: { id: true, nome: true } } },
  });
  const porBubble = new Map(contatosDb.filter((c) => c.bubbleId).map((c) => [c.bubbleId!, c]));
  const porNome = new Map(contatosDb.map((c) => [normalizarChave(c.nomeFantasia), c]));

  for (const cli of d.clientes) {
    const nome = txt(cli["Nome Fantasia"] || cli.nomeEmpresa);
    if (!nome) continue;
    const nosso = porBubble.get(cli._id) || porNome.get(normalizarChave(nome));
    const end = endereco(cli.endereco);
    const dados: Record<string, unknown> = {};
    const candidatos: Record<string, string | null> = {
      razaoSocial: txt(cli.nomeEmpresa) || null,
      cnpj: txt(cli.cnpj) || null,
      inscricaoEstadual: txt(cli.inscricaoEstadual) || null,
      inscricaoMunicipal: txt(cli.inscricaoMunicipal) || null,
      ...(end || {}),
    };

    if (!nosso) {
      const novo = await prisma.contact.create({
        data: {
          companyId,
          type: "CLIENTE",
          nomeFantasia: nome,
          razaoSocial: candidatos.razaoSocial || nome,
          cnpj: candidatos.cnpj,
          inscricaoEstadual: candidatos.inscricaoEstadual,
          inscricaoMunicipal: candidatos.inscricaoMunicipal,
          rua: candidatos.rua, numero: candidatos.numero, complemento: candidatos.complemento,
          bairro: candidatos.bairro, cep: candidatos.cep, cidade: candidatos.cidade, estado: candidatos.estado,
          isPostoServico: normalizarChave(cli["É posto?"]) === "sim",
          bubbleId: cli._id,
        },
        include: { subContacts: { select: { id: true, nome: true } } },
      });
      rel.clientesCriados++;
      porBubble.set(cli._id, novo);
      porNome.set(normalizarChave(nome), novo);
      continue;
    }

    for (const [k, v] of Object.entries(candidatos)) {
      if (v && vazio((nosso as any)[k])) dados[k] = v;
    }
    // razão social igual ao fantasia = placeholder do import anterior → melhora
    if (candidatos.razaoSocial && nosso.razaoSocial === nosso.nomeFantasia && candidatos.razaoSocial !== nosso.nomeFantasia)
      dados.razaoSocial = candidatos.razaoSocial;
    if (!nosso.bubbleId) dados.bubbleId = cli._id;

    // Contatos-pessoa que faltam
    const nomesJa = new Set(nosso.subContacts.map((s) => normalizarChave(s.nome)));
    const novosSubs: { nome: string; email: string | null; telefone: string | null }[] = [];
    for (const cid of (cli.contatos as string[]) || []) {
      const c = contatosBubble.get(cid);
      const n = txt(c?.nome);
      if (!n || nomesJa.has(normalizarChave(n))) continue;
      nomesJa.add(normalizarChave(n));
      novosSubs.push({ nome: n, email: txt(c?.email) || null, telefone: txt(c?.telefone) || null });
    }
    if (novosSubs.length > 0) {
      dados.subContacts = { create: novosSubs };
      rel.contatosCriados += novosSubs.length;
    }

    if (Object.keys(dados).length > 0) {
      await prisma.contact.update({ where: { id: nosso.id }, data: dados });
      rel.clientesAtualizados++;
    }
  }

  // Locais
  const locaisDb = await prisma.local.findMany({ where: { companyId } });
  const locPorBubble = new Map(locaisDb.filter((l) => l.bubbleId).map((l) => [l.bubbleId!, l]));
  const locPorNome = new Map(locaisDb.map((l) => [normalizarChave(l.nome), l]));
  for (const loc of d.locais) {
    const nome = txt(loc.nome);
    if (!nome) continue;
    const nosso = locPorBubble.get(loc._id) || locPorNome.get(normalizarChave(nome));
    if (!nosso) continue;
    const end = endereco(loc.endereco);
    if (!end) continue;
    const dados: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(end)) if (v && vazio((nosso as any)[k])) dados[k] = v;
    if (!nosso.bubbleId) dados.bubbleId = loc._id;
    if (Object.keys(dados).length > 0) {
      await prisma.local.update({ where: { id: nosso.id }, data: dados });
      rel.locaisAtualizados++;
    }
  }

  return rel;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const porId = (lista: R[]) => new Map(lista.map((r) => [r._id as string, r]));
const data = (v: any): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const num = (v: any): number => (typeof v === "number" && !isNaN(v) ? v : Number(v) || 0);
const txt = (v: any): string => (v == null ? "" : String(v).trim());

export function mapearStatus(bubble: string): string {
  const s = normalizarChave(bubble);
  if (!s) return "PENDENTE";
  if (s.includes("aprov") || s.includes("fech") || s.includes("confirm")) return "APROVADO";
  if (s.includes("reprov") || s.includes("recus") || s.includes("perd") || s.includes("declin")) return "REPROVADO";
  if (s.includes("cancel")) return "CANCELADO";
  if (s.includes("aguard") || s.includes("envi") || s.includes("negoc") || s.includes("analis")) return "AGUARDANDO";
  return "PENDENTE";
}

function anoDoOrcamento(o: R, eventos: Map<string, R>): number | null {
  const ev = o.evento ? eventos.get(o.evento) : null;
  const d = data(ev?.dataInicio) || data(o.dataMontagem) || data(o["Created Date"]);
  return d ? d.getFullYear() : null;
}

// ── Plano (prévia) ───────────────────────────────────────────────────────────

export interface Filtro {
  anoMinimo?: number | null;
}

export interface Previa {
  orcamentos: { total: number; noFiltro: number; jaImportados: number; aImportar: number; porStatus: Record<string, number>; statusBubble: Record<string, number> };
  faturas: { total: number; noFiltro: number; jaImportadas: number; aImportar: number; invalidas: number };
  ordens: { total: number; aImportar: number };
  clientes: { encontrados: number; novos: string[] };
  itens: { encontrados: number; novos: string[] };
  locais: { encontrados: number; naoEncontrados: string[] };
  amostra: { numero: number | null; cliente: string; evento: string; status: string; total: number; itens: number }[];
}

interface Indices {
  eventos: Map<string, R>;
  salas: Map<string, R>;
  itensPorSala: Map<string, R[]>;
  ativos: Map<string, R>;
  catalogo: Map<string, R>;
  qtdePorCatalogo: Map<string, number>;
  marcas: Map<string, R>;
  clientes: Map<string, R>;
  contatos: Map<string, R>;
  descontos: Map<string, R>;
}

function indexar(d: DadosBubble): Indices {
  const itensPorSala = new Map<string, R[]>();
  for (const it of d.itensOrc) {
    const s = txt(it.sala);
    if (!s) continue;
    if (!itensPorSala.has(s)) itensPorSala.set(s, []);
    itensPorSala.get(s)!.push(it);
  }
  const qtdePorCatalogo = new Map<string, number>();
  for (const ia of d.itensAtivo) {
    const cat = txt(ia.itemCatalogo);
    if (!cat) continue;
    qtdePorCatalogo.set(cat, (qtdePorCatalogo.get(cat) || 0) + num(ia.qtde));
  }
  return {
    eventos: porId(d.eventos),
    salas: porId(d.salas),
    itensPorSala,
    ativos: porId(d.ativos),
    catalogo: porId(d.catalogo),
    qtdePorCatalogo,
    marcas: porId(d.marcas),
    clientes: porId(d.clientes),
    contatos: porId(d.contatos),
    descontos: porId(d.descontos),
  };
}

/** Catálogo do Bubble por trás de uma linha de orçamento (via ativo → Ref_Catalogo). */
function catalogoDaLinha(it: R, ix: Indices): R | null {
  const ativo = it.ativo ? ix.ativos.get(it.ativo) : null;
  const ref = ativo?.Ref_Catalogo ? ix.catalogo.get(ativo.Ref_Catalogo) : null;
  if (ref) return ref;
  // fallback: o próprio ativo tem nome
  return ativo ? { _id: `ativo:${ativo._id}`, nome: ativo.nome, modelo: "", valorAluguel: num(it.valorPeriodo) } : null;
}

function filtrar(d: DadosBubble, ix: Indices, filtro: Filtro) {
  const ano = filtro.anoMinimo || null;
  const orcs = d.orcamentos.filter((o) => {
    if (!ano) return true;
    const a = anoDoOrcamento(o, ix.eventos);
    return a == null ? true : a >= ano;
  });
  const idsOrc = new Set(orcs.map((o) => o._id));
  const fats = d.faturas.filter((f) => {
    if (!ano) return true;
    if (f.orcamento && idsOrc.has(f.orcamento)) return true;
    const dt = data(f.dataEmissao) || data(f["Created Date"]);
    return dt ? dt.getFullYear() >= ano : true;
  });
  return { orcs, fats };
}

export async function montarPrevia(companyId: string, d: DadosBubble, filtro: Filtro): Promise<Previa> {
  const ix = indexar(d);
  const { orcs, fats } = filtrar(d, ix, filtro);

  const [orcExist, fatExist, contatos, locais, itens] = await Promise.all([
    prisma.orcamento.findMany({ where: { companyId, bubbleId: { not: null } }, select: { bubbleId: true } }),
    prisma.fatura.findMany({ where: { companyId, bubbleId: { not: null } }, select: { bubbleId: true } }),
    prisma.contact.findMany({ where: { companyId }, select: { bubbleId: true, nomeFantasia: true } }),
    prisma.local.findMany({ where: { companyId }, select: { bubbleId: true, nome: true } }),
    prisma.item.findMany({ where: { companyId }, select: { bubbleId: true, nome: true, modelo: true } }),
  ]);
  const orcJa = new Set(orcExist.map((o) => o.bubbleId));
  const fatJa = new Set(fatExist.map((f) => f.bubbleId));
  const contBubble = new Set(contatos.map((c) => c.bubbleId).filter(Boolean));
  const contNome = new Set(contatos.map((c) => normalizarChave(c.nomeFantasia)));
  const locBubble = new Set(locais.map((l) => l.bubbleId).filter(Boolean));
  const locNome = new Set(locais.map((l) => normalizarChave(l.nome)));
  const itemBubble = new Set(itens.map((i) => i.bubbleId).filter(Boolean));
  const itemNomeModelo = new Set(itens.map((i) => normalizarChave(`${i.nome}|${i.modelo || ""}`)));
  const itemNome = new Set(itens.map((i) => normalizarChave(i.nome)));

  const clientesNovos = new Set<string>();
  let clientesEnc = 0;
  const itensNovos = new Set<string>();
  let itensEnc = 0;
  const locaisNao = new Set<string>();
  let locaisEnc = 0;
  const porStatus: Record<string, number> = {};
  const statusBubble: Record<string, number> = {};
  const amostra: Previa["amostra"] = [];
  let aImportar = 0;

  for (const o of orcs) {
    if (orcJa.has(o._id)) continue;
    aImportar++;
    const st = txt(o.status);
    statusBubble[st || "(vazio)"] = (statusBubble[st || "(vazio)"] || 0) + 1;
    const nosso = mapearStatus(st);
    porStatus[nosso] = (porStatus[nosso] || 0) + 1;

    for (const cid of [o["Cliente 1"], o["Cliente 2"]]) {
      if (!cid) continue;
      const cli = ix.clientes.get(cid);
      const nome = txt(cli?.["Nome Fantasia"] || cli?.nomeEmpresa);
      if (contBubble.has(cid) || (nome && contNome.has(normalizarChave(nome)))) clientesEnc++;
      else clientesNovos.add(nome || `(cliente ${cid} sem nome)`);
    }
    const ev = o.evento ? ix.eventos.get(o.evento) : null;
    if (ev?.local) {
      if (locBubble.has(ev.local)) locaisEnc++;
      else {
        locaisNao.add(txt(ev.local));
      }
    }
    let qtdLinhas = 0;
    for (const sid of (o.salas as string[]) || []) {
      for (const it of ix.itensPorSala.get(sid) || []) {
        qtdLinhas++;
        const cat = catalogoDaLinha(it, ix);
        if (!cat) continue;
        const nome = txt(cat.nome);
        const k = normalizarChave(`${nome}|${txt(cat.modelo)}`);
        if (itemBubble.has(cat._id) || itemNomeModelo.has(k) || itemNome.has(normalizarChave(nome))) itensEnc++;
        else itensNovos.add(nome + (cat.modelo ? ` ${cat.modelo}` : ""));
      }
    }
    if (amostra.length < 6) {
      const cli = o["Cliente 1"] ? ix.clientes.get(o["Cliente 1"]) : null;
      amostra.push({
        numero: o["Codigo-num"] ?? null,
        cliente: txt(cli?.["Nome Fantasia"]) || "—",
        evento: txt(ev?.nome) || "—",
        status: `${st || "—"} → ${nosso}`,
        total: num(o.ValorTotalDesconto) || num(o.valorTotal),
        itens: qtdLinhas,
      });
    }
  }

  const fatsNovas = fats.filter((f) => !fatJa.has(f._id));
  const invalidas = fatsNovas.filter((f) => f["isValido?"] === false).length;
  const ordensAImportar = d.ordens.filter((os) => {
    const oid = os["Orçamento da Ordem de Serviço"];
    return oid && orcs.some((o) => o._id === oid);
  }).length;

  return {
    orcamentos: {
      total: d.orcamentos.length,
      noFiltro: orcs.length,
      jaImportados: orcs.length - aImportar,
      aImportar,
      porStatus,
      statusBubble,
    },
    faturas: {
      total: d.faturas.length,
      noFiltro: fats.length,
      jaImportadas: fats.length - fatsNovas.length,
      aImportar: fatsNovas.length - invalidas,
      invalidas,
    },
    ordens: { total: d.ordens.length, aImportar: ordensAImportar },
    clientes: { encontrados: clientesEnc, novos: [...clientesNovos].slice(0, 100) },
    itens: { encontrados: itensEnc, novos: [...itensNovos].slice(0, 200) },
    locais: { encontrados: locaisEnc, naoEncontrados: [...locaisNao].slice(0, 50) },
    amostra,
  };
}

// ── Execução ─────────────────────────────────────────────────────────────────

export interface Relatorio {
  orcamentosCriados: number;
  orcamentosPulados: number;
  ordensCriadas: number;
  faturasCriadas: number;
  faturasPuladas: number;
  clientesCriados: number;
  itensCriados: number;
  contatosCriados: number;
  avisos: string[];
}

export async function executarMigracao(companyId: string, d: DadosBubble, filtro: Filtro): Promise<Relatorio> {
  const ix = indexar(d);
  const { orcs, fats } = filtrar(d, ix, filtro);
  const rel: Relatorio = {
    orcamentosCriados: 0, orcamentosPulados: 0, ordensCriadas: 0, faturasCriadas: 0, faturasPuladas: 0,
    clientesCriados: 0, itensCriados: 0, contatosCriados: 0, avisos: [],
  };

  // Primeiro os cadastros de apoio (endereços, CNPJ, contatos) — assim os
  // orçamentos/faturas já nascem apontando para clientes completos
  const cad = await completarCadastros(companyId, d);
  rel.clientesCriados += cad.clientesCriados;
  rel.contatosCriados += cad.contatosCriados;

  const empresa = await prisma.company.findUnique({ where: { id: companyId } });
  const precoCfg = {
    diasSemana: empresa?.diasSemana ?? 7, diasQuinzena: empresa?.diasQuinzena ?? 15, diasMes: empresa?.diasMes ?? 30,
    descontoSemana: empresa?.descontoSemana ?? 0, descontoQuinzena: empresa?.descontoQuinzena ?? 0, descontoMes: empresa?.descontoMes ?? 0,
  };

  // Índices locais
  const [contatosDb, locaisDb, itensDb, marcasDb, orcDb, fatDb, osDb] = await Promise.all([
    prisma.contact.findMany({ where: { companyId }, include: { subContacts: { select: { id: true, nome: true } } } }),
    prisma.local.findMany({ where: { companyId }, select: { id: true, bubbleId: true, nome: true } }),
    prisma.item.findMany({ where: { companyId }, select: { id: true, bubbleId: true, nome: true, modelo: true, codigo: true } }),
    prisma.marca.findMany({ where: { companyId }, select: { id: true, nome: true } }),
    prisma.orcamento.findMany({ where: { companyId }, select: { id: true, bubbleId: true, numero: true } }),
    prisma.fatura.findMany({ where: { companyId, bubbleId: { not: null } }, select: { bubbleId: true } }),
    prisma.ordemServico.findMany({ where: { companyId }, select: { orcamentoId: true, bubbleId: true } }),
  ]);
  const contPorBubble = new Map(contatosDb.filter((c) => c.bubbleId).map((c) => [c.bubbleId!, c]));
  const contPorNome = new Map(contatosDb.map((c) => [normalizarChave(c.nomeFantasia), c]));
  const locPorBubble = new Map(locaisDb.filter((l) => l.bubbleId).map((l) => [l.bubbleId!, l]));
  const locPorNome = new Map(locaisDb.map((l) => [normalizarChave(l.nome), l]));
  const itemPorBubble = new Map(itensDb.filter((i) => i.bubbleId).map((i) => [i.bubbleId!, i]));
  const itemPorNomeModelo = new Map(itensDb.map((i) => [normalizarChave(`${i.nome}|${i.modelo || ""}`), i]));
  const itemPorNome = new Map(itensDb.map((i) => [normalizarChave(i.nome), i]));
  const marcaPorNome = new Map(marcasDb.map((m) => [normalizarChave(m.nome), m.id]));
  const orcPorBubble = new Map(orcDb.filter((o) => o.bubbleId).map((o) => [o.bubbleId!, o]));
  const fatJa = new Set(fatDb.map((f) => f.bubbleId));
  const osPorOrc = new Set(osDb.map((o) => o.orcamentoId));
  const osBubble = new Set(osDb.map((o) => o.bubbleId).filter(Boolean));
  let maxCodigo = 0;
  for (const i of itensDb) {
    const n = parseInt((i.codigo || "").replace(/\D/g, ""), 10);
    if (!isNaN(n) && n > maxCodigo) maxCodigo = n;
  }

  async function resolverCliente(bubbleId: string | undefined): Promise<{ id: string; nomeFantasia: string; subContacts: { id: string; nome: string }[] } | null> {
    if (!bubbleId) return null;
    const jaPorId = contPorBubble.get(bubbleId);
    if (jaPorId) return jaPorId;
    const cli = ix.clientes.get(bubbleId);
    const nome = txt(cli?.["Nome Fantasia"] || cli?.nomeEmpresa);
    if (!nome) return null;
    const porNome = contPorNome.get(normalizarChave(nome));
    if (porNome) {
      if (!porNome.bubbleId) {
        await prisma.contact.update({ where: { id: porNome.id }, data: { bubbleId } });
        porNome.bubbleId = bubbleId;
      }
      contPorBubble.set(bubbleId, porNome);
      return porNome;
    }
    const novo = await prisma.contact.create({
      data: {
        companyId,
        type: "CLIENTE",
        nomeFantasia: nome,
        razaoSocial: txt(cli?.nomeEmpresa) || nome,
        cnpj: txt(cli?.cnpj) || null,
        inscricaoEstadual: txt(cli?.inscricaoEstadual) || null,
        inscricaoMunicipal: txt(cli?.inscricaoMunicipal) || null,
        isPostoServico: normalizarChave(cli?.["É posto?"]) === "sim",
        bubbleId,
      },
      include: { subContacts: { select: { id: true, nome: true } } },
    });
    rel.clientesCriados++;
    contPorBubble.set(bubbleId, novo);
    contPorNome.set(normalizarChave(nome), novo);
    return novo;
  }

  async function resolverContato(bubbleContatoId: string | undefined, cliente: { id: string; subContacts: { id: string; nome: string }[] } | null): Promise<string | null> {
    if (!bubbleContatoId || !cliente) return null;
    const c = ix.contatos.get(bubbleContatoId);
    const nome = txt(c?.nome);
    if (!nome) return null;
    const existente = cliente.subContacts.find((s) => normalizarChave(s.nome) === normalizarChave(nome));
    if (existente) return existente.id;
    const novo = await prisma.subContact.create({
      data: { contactId: cliente.id, nome, email: txt(c?.email) || null, telefone: txt(c?.telefone) || null },
      select: { id: true, nome: true },
    });
    cliente.subContacts.push(novo);
    rel.contatosCriados++;
    return novo.id;
  }

  function resolverLocal(bubbleLocalId: string | undefined): string | null {
    if (!bubbleLocalId) return null;
    return locPorBubble.get(bubbleLocalId)?.id || null;
  }

  async function resolverItem(cat: R): Promise<string> {
    const jaPorId = itemPorBubble.get(cat._id);
    if (jaPorId) return jaPorId.id;
    const nome = txt(cat.nome) || "Item sem nome";
    const modelo = txt(cat.modelo);
    const achado = itemPorNomeModelo.get(normalizarChave(`${nome}|${modelo}`)) || itemPorNome.get(normalizarChave(nome));
    if (achado) {
      if (!achado.bubbleId && !String(cat._id).startsWith("ativo:")) {
        await prisma.item.update({ where: { id: achado.id }, data: { bubbleId: cat._id } });
        achado.bubbleId = cat._id;
        itemPorBubble.set(cat._id, achado);
      }
      return achado.id;
    }
    // Cria "a revisar" com o que o catálogo do Bubble sabe
    const marcaNome = cat.marca ? txt(ix.marcas.get(cat.marca)?.nome) : "";
    let marcaId: string | null = null;
    if (marcaNome) {
      marcaId = marcaPorNome.get(normalizarChave(marcaNome)) || null;
      if (!marcaId) {
        const m = await prisma.marca.create({ data: { nome: marcaNome, companyId } });
        marcaId = m.id;
        marcaPorNome.set(normalizarChave(marcaNome), m.id);
      }
    }
    maxCodigo += 1;
    const codigo = String(maxCodigo).padStart(4, "0");
    const diaria = num(cat.valorAluguel);
    const calc = calcularPrecos(diaria, precoCfg);
    const quantidade = ix.qtdePorCatalogo.get(cat._id) || 0;
    const novo = await prisma.item.create({
      data: {
        companyId, codigo, nome, modelo: modelo || null, marcaId,
        valorAluguel: diaria, valorSemana: calc.valorSemana, valorQuinzena: calc.valorQuinzena, valorMes: calc.valorMes,
        quantidade, natureza: "EQUIPAMENTO", tipo: "PROPRIO", emCatalogo: true, revisarCadastro: true,
        especificacoes: txt(cat.especificacoes) || null, especificacoesPublicas: txt(cat.especificacoes) || null,
        bubbleId: String(cat._id).startsWith("ativo:") ? null : cat._id,
      },
      select: { id: true, bubbleId: true, nome: true, modelo: true, codigo: true },
    });
    await sincronizarUnidades(novo.id);
    rel.itensCriados++;
    itemPorNomeModelo.set(normalizarChave(`${nome}|${modelo}`), novo);
    itemPorNome.set(normalizarChave(nome), novo);
    if (novo.bubbleId) itemPorBubble.set(novo.bubbleId, novo);
    return novo.id;
  }

  // ── Orçamentos ──
  for (const o of orcs) {
    if (orcPorBubble.has(o._id)) { rel.orcamentosPulados++; continue; }
    const cliente = await resolverCliente(o["Cliente 1"]);
    if (!cliente) {
      rel.avisos.push(`Orçamento ${o["Codigo-num"] ?? o.codigo ?? o._id}: sem cliente — pulado.`);
      rel.orcamentosPulados++;
      continue;
    }
    const cliente2 = o["Cliente 2"] && o["Cliente 2"] !== o["Cliente 1"] ? await resolverCliente(o["Cliente 2"]) : null;
    const contatoId = await resolverContato(o.contatoCliente1, cliente);
    const contato2Id = await resolverContato(o.contatoCliente2, cliente2 || cliente);
    const ev = o.evento ? ix.eventos.get(o.evento) : null;
    const localId = resolverLocal(ev?.local);

    const salasCreate: { nome: string; itens: { create: any[] } }[] = [];
    let bruto = 0;
    for (const sid of (o.salas as string[]) || []) {
      const sala = ix.salas.get(sid);
      const linhas = ix.itensPorSala.get(sid) || [];
      const itensCreate: any[] = [];
      for (const it of linhas) {
        const cat = catalogoDaLinha(it, ix);
        if (!cat) continue;
        const itemId = await resolverItem(cat);
        const quantidade = Math.max(1, Math.round(num(it.qtdeItens) || 1));
        const diarias = Math.max(1, Math.round(num(it.qtdePeriodo) || 1));
        const valorUnitario = num(it.valorPeriodo) || num(cat.valorAluguel);
        const subtotal = quantidade * diarias * valorUnitario;
        bruto += subtotal;
        itensCreate.push({ itemId, quantidade, diarias, valorUnitario, subtotal });
      }
      salasCreate.push({ nome: txt(sala?.nome) || "Sala", itens: { create: itensCreate } });
    }

    // Desconto: percentual único → percentual; senão diferença total×total c/ desconto
    let desconto: number | null = null;
    let descontoTipo = "valor";
    const descs = ((o.descontos as string[]) || []).map((id) => ix.descontos.get(id)).filter(Boolean) as R[];
    const totalBubble = num(o.valorTotal) || bruto;
    const totalComDesc = num(o.ValorTotalDesconto);
    if (descs.length === 1 && normalizarChave(descs[0].forma) === "percentual" && num(descs[0].valor_pct) > 0) {
      desconto = Math.round(num(descs[0].valor_pct) * 100 * 100) / 100;
      descontoTipo = "percentual";
    } else if (totalComDesc > 0 && totalBubble > totalComDesc) {
      desconto = Math.round((totalBubble - totalComDesc) * 100) / 100;
    }
    const total = totalComDesc > 0 ? totalComDesc : totalBubble;

    const numero = Number(o["Codigo-num"]) || parseInt(txt(o.codigo).replace(/\D/g, ""), 10) || 0;
    const statusBubble = txt(o.status);
    const obsInternas = [txt(o["ObservaçãoInterna"]), statusBubble ? `Status no Bubble: ${statusBubble}` : "", "Importado do Bubble."]
      .filter(Boolean).join("\n");

    const criado = await prisma.orcamento.create({
      data: {
        companyId,
        numero: numero || (Math.max(0, ...orcDb.map((x) => x.numero)) + 1),
        bubbleId: o._id,
        clienteId: cliente.id,
        cliente2Id: cliente2?.id || null,
        contatoId,
        contato2Id,
        status: mapearStatus(statusBubble),
        eventoNome: txt(ev?.nome) || null,
        localId,
        dataMontagem: data(ev?.Montagem) || data(o.dataMontagem),
        dataInicio: data(ev?.dataInicio),
        dataFim: data(ev?.dataTermino),
        observacoes: txt(o.observacao) || null,
        obsInternas,
        formaPagamento: txt(o["Forma de pagamento"]) || null,
        desconto,
        descontoTipo,
        total,
        createdAt: data(o["Created Date"]) || undefined,
        salas: { create: salasCreate },
      },
      select: { id: true, numero: true, bubbleId: true },
    });
    orcPorBubble.set(o._id, criado);
    orcDb.push(criado);
    rel.orcamentosCriados++;
  }

  // ── Ordens de serviço ──
  for (const os of d.ordens) {
    if (osBubble.has(os._id)) continue;
    const orc = os["Orçamento da Ordem de Serviço"] ? orcPorBubble.get(os["Orçamento da Ordem de Serviço"]) : null;
    if (!orc || osPorOrc.has(orc.id)) continue;
    await prisma.ordemServico.create({
      data: {
        companyId,
        orcamentoId: orc.id,
        bubbleId: os._id,
        status: os["realizado?"] ? "CONCLUIDA" : "ABERTA",
        horarioMontagem: data(os.Montagem),
        observacoes: txt(os.ObservacaoOS) || null,
        createdAt: data(os["Created Date"]) || undefined,
      },
    });
    osPorOrc.add(orc.id);
    rel.ordensCriadas++;
  }

  // ── Faturas ──
  for (const f of fats) {
    if (fatJa.has(f._id)) { rel.faturasPuladas++; continue; }
    if (f["isValido?"] === false) { rel.faturasPuladas++; continue; }
    const cliente = await resolverCliente(f.cliente);
    const orc = f.orcamento ? orcPorBubble.get(f.orcamento) : null;
    const clienteNome = cliente?.nomeFantasia || txt(ix.clientes.get(f.cliente)?.["Nome Fantasia"]) || "Cliente";
    const posto = f["PostodeServiço?"] === true;
    await prisma.fatura.create({
      data: {
        companyId,
        numero: Number(f.numeroNota) || 0,
        bubbleId: f._id,
        origem: orc ? "ORCAMENTO" : "DIRETA",
        orcamentoId: orc?.id || null,
        clienteId: cliente?.id || null,
        clienteNome,
        tipoDestinatario: posto ? "POSTO" : "CLIENTE",
        isPostoServico: posto,
        mesRef: [txt(f["MêsEmissão"]), txt(f.Ano)].filter(Boolean).join("/"),
        dataEmissao: data(f.dataEmissao) || data(f["Created Date"]) || new Date(),
        dataVencimento: data(f.dataVencimento) || data(f.dataEmissao) || new Date(),
        valor: num(f.ValorTotal),
        descritivo: txt(f.descritivo) || null,
        emitidaEm: data(f.dataEmissao) || undefined,
        emitidaPor: "Bubble",
        createdAt: data(f["Created Date"]) || undefined,
      },
    });
    fatJa.add(f._id);
    rel.faturasCriadas++;
  }

  // Numeração: o próximo documento continua depois do maior importado
  const [maxOrc, maxFat] = await Promise.all([
    prisma.orcamento.aggregate({ where: { companyId }, _max: { numero: true } }),
    prisma.fatura.aggregate({ where: { companyId, emissoraId: null }, _max: { numero: true } }),
  ]);
  await prisma.company.update({
    where: { id: companyId },
    data: {
      orcamentoNumeroInicial: Math.max(empresa?.orcamentoNumeroInicial || 1, (maxOrc._max.numero || 0) + 1),
      faturaNumeroInicial: Math.max(empresa?.faturaNumeroInicial || 1, (maxFat._max.numero || 0) + 1),
    },
  });

  return rel;
}
