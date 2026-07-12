import { NextRequest } from "next/server";

// Leitura de documentos enviados para análise por IA (Banco de Preços,
// importação de OS de posto...): aceita PDF (vai como documento direto),
// planilhas XLSX/XLS, CSV, DOCX e TXT/MD (convertidos em texto), ou o
// texto colado no corpo JSON `{ texto, nome? }`.

// Blocos de conteúdo enviados à IA.
export type BlocoDocumento =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
    };

export const LIMITE_TEXTO = 200_000; // ~50k tokens

/** Converte planilhas, DOCX e arquivos de texto em texto puro. */
export async function extrairTextoArquivo(file: File): Promise<string | null> {
  const nome = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (
    nome.endsWith(".xlsx") ||
    nome.endsWith(".xls") ||
    file.type.includes("spreadsheet") ||
    file.type === "application/vnd.ms-excel"
  ) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    return wb.SheetNames.map(
      (n) => `## Aba: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`
    ).join("\n\n");
  }
  if (nome.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ buffer: buf });
    return r.value;
  }
  if (
    nome.endsWith(".csv") ||
    nome.endsWith(".txt") ||
    nome.endsWith(".md") ||
    file.type.startsWith("text/")
  ) {
    return buf.toString("utf8");
  }
  return null;
}

export type EntradaDocumento =
  | { blocos: BlocoDocumento[]; nomeDocumento: string; extras: Record<string, unknown> }
  | { erro: string; status: number };

/**
 * Lê a entrada da requisição (JSON `{texto, nome?}` ou multipart com `file`)
 * e devolve os blocos prontos para a IA. `extras` traz os demais campos do
 * corpo (JSON) ou do formulário, para parâmetros adicionais da rota.
 */
export async function lerDocumentoDaRequisicao(req: NextRequest): Promise<EntradaDocumento> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const texto = String(body?.texto || "").trim();
    if (!texto) return { erro: "Cole o texto do documento", status: 400 };
    const { texto: _t, nome: _n, ...extras } = body as Record<string, unknown>;
    return {
      blocos: [{ type: "text", text: `DOCUMENTO:\n\n${texto.slice(0, LIMITE_TEXTO)}` }],
      nomeDocumento: String(body?.nome || "").trim().slice(0, 200) || "texto colado",
      extras,
    };
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") return { erro: "Envie um arquivo", status: 400 };
  if (file.size > 4 * 1024 * 1024)
    return { erro: "Arquivo muito grande — limite de 4 MB", status: 400 };

  const extras: Record<string, unknown> = {};
  formData.forEach((v, k) => {
    if (k !== "file" && typeof v === "string") extras[k] = v;
  });

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return {
      blocos: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        },
      ],
      nomeDocumento: file.name,
      extras,
    };
  }

  let texto: string | null = null;
  try {
    texto = await extrairTextoArquivo(file);
  } catch (e) {
    console.error("[documentos] Falha ao ler o arquivo:", e);
    return { erro: "Não consegui ler este arquivo — ele pode estar corrompido.", status: 422 };
  }
  if (texto === null)
    return {
      erro: "Formato não suportado — use PDF, XLSX, XLS, CSV, DOCX, TXT ou MD.",
      status: 400,
    };
  if (!texto.trim()) return { erro: "O arquivo não contém texto legível.", status: 422 };

  return {
    blocos: [{ type: "text", text: `DOCUMENTO:\n\n${texto.slice(0, LIMITE_TEXTO)}` }],
    nomeDocumento: file.name,
    extras,
  };
}
