// Importador de clientes + contatos exportados do Bubble (CSV).
// O export de Clientes não traz o id do Bubble, então o vínculo é reconstruído
// pelo campo "contatos" (lista de nomes) do cliente cruzado com o "nome" de
// cada contato (que tem o clienteId). Registros de teste, cujo clienteId não é
// referenciado por nenhum cliente, ficam de fora automaticamente.

export interface SubContatoImport {
  nome: string;
  email: string | null;
  telefone: string | null;
}

export interface ClienteImport {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string | null;
  rua: string | null;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  isPostoServico: boolean;
  bubbleId: string | null; // id do cliente no Bubble (reconstruído pelos contatos)
  subcontatos: SubContatoImport[];
}

export interface ResultadoImportacao {
  clientes: ClienteImport[];
  stats: {
    clientes: number;
    postos: number;
    comContatos: number;
    semContatos: number;
    subcontatos: number;
    gruposDescartados: number;
  };
}

/** Parser CSV (RFC 4180) — lida com aspas, vírgulas e quebras dentro do campo. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\r") {
        /* ignora */
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const NOMES_INVALIDOS = new Set(["", "n/d", "nd", "n/a", "n", "na", "n.d", "n d", "-", "."]);
function nomeValido(s: string): boolean {
  return !NOMES_INVALIDOS.has(norm(s));
}

// ── Locais (espaços de evento) ──────────────────────────────────────────────

export interface LocalImport {
  nome: string;
  rua: string | null;
  cep: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  bubbleId: string | null;
  enderecoCompleto: boolean; // true se o endereço foi cruzado sem ambiguidade
}

export interface ResultadoLocais {
  locais: LocalImport[];
  stats: { locais: number; comEndereco: number; semEndereco: number; comId: number };
}

/**
 * Importa os locais (espaços de evento). Cruza a rua com o arquivo de endereços
 * (opcional) para preencher CEP/número/cidade quando a rua é única; ruas com
 * mais de um endereço ficam só com o nome da rua (você completa depois).
 */
export function montarImportacaoLocais(
  locaisCsv: string,
  enderecosCsv?: string
): ResultadoLocais {
  // Índice rua-normalizada -> endereço, quando único
  const ruaPara = new Map<string, Map<string, LocalImport>>();
  if (enderecosCsv) {
    const end = parseCsv(enderecosCsv);
    const eH = end[0] || [];
    const iCep = eH.indexOf("cep");
    const iCid = eH.indexOf("cidade");
    const iFmt = eH.indexOf("enderecoFormatado");
    const iEst = eH.indexOf("estado");
    const iNum = eH.indexOf("numero");
    const iBairro = eH.indexOf("bairro");
    for (let i = 1; i < end.length; i++) {
      const r = end[i];
      if (!r || r.length < 7) continue;
      const fmt = (r[iFmt] || "").trim();
      if (!fmt || fmt.startsWith(", ,")) continue;
      const rua = fmt.split(",")[0].trim();
      if (!rua) continue;
      const key = norm(rua);
      if (!ruaPara.has(key)) ruaPara.set(key, new Map());
      const combo = `${(r[iNum] || "").trim()}|${(r[iCep] || "").trim()}`;
      ruaPara.get(key)!.set(combo, {
        nome: "",
        rua,
        cep: (r[iCep] || "").trim() || null,
        numero: (r[iNum] || "").trim() || null,
        bairro: (r[iBairro] || "").trim() || null,
        cidade: (r[iCid] || "").trim() || null,
        estado: (r[iEst] || "").trim().toUpperCase() || null,
        bubbleId: null,
        enderecoCompleto: false,
      });
    }
  }

  const rows = parseCsv(locaisCsv);
  const h = rows[0] || [];
  const kEnd = h.indexOf("endereco");
  const kNome = h.indexOf("nome");
  const kId = h.indexOf("unique id");

  const locais: LocalImport[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    const nome = (r[kNome] || "").trim();
    if (!nome) continue;
    const rua = (r[kEnd] || "").trim() || null;
    const bubbleId = kId >= 0 ? (r[kId] || "").trim() || null : null;

    let cep: string | null = null;
    let numero: string | null = null;
    let bairro: string | null = null;
    let cidade: string | null = null;
    let estado: string | null = null;
    let enderecoCompleto = false;

    if (rua) {
      const combos = ruaPara.get(norm(rua));
      if (combos) {
        const distintos = [...combos.values()].filter((c) => c.numero || c.cep);
        const chaves = new Set(distintos.map((c) => `${c.numero}|${c.cep}`));
        if (chaves.size === 1 && distintos.length) {
          const e = distintos[0];
          cep = e.cep;
          numero = e.numero;
          bairro = e.bairro;
          cidade = e.cidade;
          estado = e.estado;
          enderecoCompleto = true;
        }
      }
    }

    locais.push({ nome, rua, cep, numero, bairro, cidade, estado, bubbleId, enderecoCompleto });
  }

  return {
    locais,
    stats: {
      locais: locais.length,
      comEndereco: locais.filter((l) => l.enderecoCompleto).length,
      semEndereco: locais.filter((l) => !l.enderecoCompleto).length,
      comId: locais.filter((l) => l.bubbleId).length,
    },
  };
}

/** Recebe os textos dos dois CSVs e devolve os clientes prontos + estatísticas. */
export function montarImportacaoClientes(
  clientesCsv: string,
  contatosCsv: string
): ResultadoImportacao {
  const contatosRows = parseCsv(contatosCsv);
  const cH = contatosRows[0] || [];
  const cCli = cH.indexOf("Cliente-empresa");
  const cId = cH.indexOf("clienteId");
  const cEmail = cH.indexOf("email");
  const cNome = cH.indexOf("nome");
  const cTel = cH.indexOf("telefone");

  // Agrupa contatos por clienteId (id do Bubble)
  const grupos = new Map<string, { razao: string; contatos: SubContatoImport[] }>();
  for (let i = 1; i < contatosRows.length; i++) {
    const r = contatosRows[i];
    if (!r || r.length < 5) continue;
    const clienteId = (r[cId] || "").trim();
    if (!clienteId) continue;
    if (!grupos.has(clienteId)) grupos.set(clienteId, { razao: "", contatos: [] });
    const g = grupos.get(clienteId)!;
    const razao = (r[cCli] || "").trim();
    if (razao && !g.razao) g.razao = razao;
    g.contatos.push({
      nome: (r[cNome] || "").trim(),
      email: (r[cEmail] || "").trim() || null,
      telefone: (r[cTel] || "").trim() || null,
    });
  }

  // Índice: nome-normalizado -> clienteIds que têm um contato com esse nome
  const nomeParaIds = new Map<string, Set<string>>();
  for (const [id, g] of grupos) {
    for (const c of g.contatos) {
      if (!nomeValido(c.nome)) continue;
      const n = norm(c.nome);
      if (!nomeParaIds.has(n)) nomeParaIds.set(n, new Set());
      nomeParaIds.get(n)!.add(id);
    }
  }

  const clientesRows = parseCsv(clientesCsv);
  const clH = clientesRows[0] || [];
  const kPosto = clH.indexOf("É posto?");
  const kCnpj = clH.indexOf("cnpj");
  const kEnd = clH.indexOf("endereco");
  const kIe = clH.indexOf("inscricaoEstadual");
  const kIm = clH.indexOf("inscricaoMunicipal");
  const kContatos = clH.indexOf("contatos");
  const kNome = clH.indexOf("Nome Fantasia");

  const usados = new Set<string>();
  const clientes: ClienteImport[] = [];
  let comContatos = 0;
  let semContatos = 0;
  let subcontatos = 0;

  for (let i = 1; i < clientesRows.length; i++) {
    const r = clientesRows[i];
    if (!r || r.length < 6) continue;
    const nomeFantasia = (r[kNome] || "").trim();
    if (!nomeFantasia) continue;

    const nomesContatos = (r[kContatos] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(nomeValido);

    // Voto: qual clienteId (grupo) mais combina com a lista de contatos
    const votos = new Map<string, number>();
    for (const nm of nomesContatos) {
      const ids = nomeParaIds.get(norm(nm));
      if (!ids) continue;
      for (const id of ids) votos.set(id, (votos.get(id) || 0) + 1);
    }
    let best: string | null = null;
    let bestV = 0;
    for (const [id, v] of votos) if (v > bestV && !usados.has(id)) ((best = id), (bestV = v));
    if (!best) for (const [id, v] of votos) if (v > bestV) ((best = id), (bestV = v));

    let subs: SubContatoImport[] = [];
    let razao: string | null = null;
    if (best && votos.size) {
      const g = grupos.get(best)!;
      razao = g.razao || null;
      if (!usados.has(best)) {
        subs = g.contatos.filter((c) => nomeValido(c.nome));
        usados.add(best);
      }
      comContatos++;
    } else {
      semContatos++;
    }

    subcontatos += subs.length;
    const cnpj = (r[kCnpj] || "").trim();
    clientes.push({
      nomeFantasia,
      razaoSocial: razao || nomeFantasia,
      cnpj: cnpj && cnpj !== "00.000.000/0000-00" ? cnpj : null,
      rua: (r[kEnd] || "").trim() || null,
      inscricaoEstadual: (r[kIe] || "").trim() || null,
      inscricaoMunicipal: (r[kIm] || "").trim() || null,
      isPostoServico: norm(r[kPosto] || "") === "sim",
      bubbleId: best || null,
      subcontatos: subs,
    });
  }

  const gruposDescartados = [...grupos.keys()].filter((id) => !usados.has(id)).length;

  return {
    clientes,
    stats: {
      clientes: clientes.length,
      postos: clientes.filter((c) => c.isPostoServico).length,
      comContatos,
      semContatos,
      subcontatos,
      gruposDescartados,
    },
  };
}
