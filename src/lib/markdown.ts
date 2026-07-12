// Mini-renderizador de Markdown → HTML para as propostas de projeto especial.
// Cobre o que se usa em propostas: títulos, negrito, itálico, listas,
// listas numeradas, tabelas, citações, linhas horizontais e links.
// Todo o texto é escapado antes — seguro contra HTML colado.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string): string {
  return s
    // links [texto](url)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // negrito **texto** ou __texto__
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    // itálico *texto* ou _texto_
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
    // código `x`
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function mdParaHtml(md: string): string {
  const linhas = escapeHtml(md.replace(/\r\n/g, "\n")).split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i];
    const trim = linha.trim();

    if (!trim) {
      i++;
      continue;
    }

    // Linha horizontal
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trim)) {
      out.push("<hr/>");
      i++;
      continue;
    }

    // Títulos
    const h = trim.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const n = h[1].length;
      out.push(`<h${n}>${inline(h[2])}</h${n}>`);
      i++;
      continue;
    }

    // Citação
    if (trim.startsWith("&gt;")) {
      const buf: string[] = [];
      while (i < linhas.length && linhas[i].trim().startsWith("&gt;")) {
        buf.push(inline(linhas[i].trim().replace(/^&gt;\s?/, "")));
        i++;
      }
      out.push(`<blockquote>${buf.join("<br/>")}</blockquote>`);
      continue;
    }

    // Tabela (| a | b |)
    if (trim.startsWith("|") && trim.endsWith("|")) {
      const tabela: string[][] = [];
      while (i < linhas.length && linhas[i].trim().startsWith("|")) {
        const celulas = linhas[i]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
        tabela.push(celulas);
        i++;
      }
      // remove linha separadora |---|---|
      const corpo = tabela.filter((row) => !row.every((c) => /^:?-{2,}:?$/.test(c)));
      const [cab, ...resto] = corpo;
      out.push(
        "<table><thead><tr>" +
          cab.map((c) => `<th>${inline(c)}</th>`).join("") +
          "</tr></thead><tbody>" +
          resto
            .map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>")
            .join("") +
          "</tbody></table>"
      );
      continue;
    }

    // Lista com marcadores
    if (/^[-*+]\s+/.test(trim)) {
      const itens: string[] = [];
      while (i < linhas.length && /^[-*+]\s+/.test(linhas[i].trim())) {
        itens.push(`<li>${inline(linhas[i].trim().replace(/^[-*+]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ul>${itens.join("")}</ul>`);
      continue;
    }

    // Lista numerada
    if (/^\d+[.)]\s+/.test(trim)) {
      const itens: string[] = [];
      while (i < linhas.length && /^\d+[.)]\s+/.test(linhas[i].trim())) {
        itens.push(`<li>${inline(linhas[i].trim().replace(/^\d+[.)]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${itens.join("")}</ol>`);
      continue;
    }

    // Parágrafo (agrupa linhas consecutivas)
    const buf: string[] = [];
    while (
      i < linhas.length &&
      linhas[i].trim() &&
      !/^(#{1,4})\s|^[-*+]\s|^\d+[.)]\s|^\||^&gt;|^(-{3,}|\*{3,}|_{3,})$/.test(linhas[i].trim())
    ) {
      buf.push(inline(linhas[i].trim()));
      i++;
    }
    out.push(`<p>${buf.join("<br/>")}</p>`);
  }

  return out.join("\n");
}
