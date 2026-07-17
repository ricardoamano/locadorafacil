// Parser de OFX (extrato bancário) — formato SGML/XML usado por praticamente
// todos os bancos brasileiros (Nubank, Itaú, Bradesco, Santander, BB, Inter...).
// Extrai os lançamentos (<STMTTRN>) com id único (FITID), data, valor e descrição.

export interface LancamentoOfx {
  fitid: string;
  data: Date;
  valor: number; // positivo = crédito, negativo = débito
  descricao: string;
}

/** Decodifica o arquivo respeitando o charset declarado no cabeçalho OFX. */
export function decodificarOfx(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const cabecalho = utf8.slice(0, 600).toUpperCase();
  // OFX antigo declara CHARSET:1252 / ENCODING:USASCII → latin1 cobre os acentos
  if (
    cabecalho.includes("CHARSET:1252") ||
    cabecalho.includes("ISO-8859-1") ||
    utf8.includes("�")
  ) {
    return new TextDecoder("windows-1252", { fatal: false }).decode(buf);
  }
  return utf8;
}

function campo(bloco: string, tag: string): string | null {
  // SGML (sem fechamento) e XML (com fechamento) — pega até quebra/tag seguinte
  const re = new RegExp(`<${tag}>([^<\r\n]*)`, "i");
  const m = bloco.match(re);
  return m ? m[1].trim() : null;
}

function parseDataOfx(s: string | null): Date | null {
  if (!s) return null;
  // DTPOSTED: YYYYMMDD[HHMMSS[.XXX]][timezone] — usamos só a data local
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function parseValorOfx(s: string | null): number | null {
  if (!s) return null;
  // Bancos BR às vezes usam vírgula decimal no TRNAMT
  const n = Number(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

/** Extrai os lançamentos de um arquivo OFX. Lança erro legível se não for OFX. */
export function parseOfx(conteudo: string): LancamentoOfx[] {
  if (!/OFX/i.test(conteudo.slice(0, 2000)) && !/<STMTTRN>/i.test(conteudo))
    throw new Error("O arquivo não parece ser um OFX. Exporte o extrato do banco em formato OFX.");

  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi) || [];
  const lancamentos: LancamentoOfx[] = [];

  for (const bloco of blocos) {
    const data = parseDataOfx(campo(bloco, "DTPOSTED"));
    const valor = parseValorOfx(campo(bloco, "TRNAMT"));
    if (!data || valor == null || valor === 0) continue;

    const memo = campo(bloco, "MEMO");
    const name = campo(bloco, "NAME");
    const descricao = (memo && name && memo !== name ? `${name} — ${memo}` : memo || name || "Lançamento").slice(0, 300);

    // FITID é o id único do banco; sem ele, derivamos um estável do conteúdo
    const fitid =
      campo(bloco, "FITID") ||
      `${data.toISOString().slice(0, 10)}|${valor.toFixed(2)}|${descricao}`.slice(0, 200);

    lancamentos.push({ fitid, data, valor, descricao });
  }

  if (lancamentos.length === 0)
    throw new Error("Nenhum lançamento encontrado no arquivo. Confira se o período exportado tem movimentações.");
  return lancamentos;
}
