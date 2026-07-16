import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Mídias da visita: fotos, vídeos curtos e arquivos (PDF, PPTX, DOCX...).
// Limite de 4 MB por envio (teto do corpo na Vercel) — fotos são comprimidas
// no navegador antes de subir; vídeos precisam ser curtos.

export const maxDuration = 60;

type SessUser = { companyId?: string; name?: string | null; email?: string | null };

const TAMANHO_MAX = 4 * 1024 * 1024;
const MIMES_BLOQUEADOS = [
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
];

async function getSessao() {
  const session = await auth();
  const u = session?.user as SessUser | undefined;
  if (!u?.companyId) return null;
  return { companyId: u.companyId, nome: u.name || u.email || "—" };
}

async function visitaDaEmpresa(id: string, companyId: string) {
  return prisma.visitaTecnica.findFirst({ where: { id, companyId }, select: { id: true } });
}

function tipoPorMime(mime: string): string {
  if (mime.startsWith("image/")) return "FOTO";
  if (mime.startsWith("video/")) return "VIDEO";
  return "ARQUIVO";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await visitaDaEmpresa(id, sessao.companyId)))
    return NextResponse.json({ error: "Visita não encontrada" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string")
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  if (file.size > TAMANHO_MAX)
    return NextResponse.json(
      {
        error:
          "Arquivo muito grande — o limite é 4 MB por envio. Fotos são comprimidas automaticamente; vídeos precisam ser curtos (ou suba no Drive e cole o link nas observações).",
      },
      { status: 400 }
    );
  if (MIMES_BLOQUEADOS.includes(file.type))
    return NextResponse.json({ error: "Tipo de arquivo não permitido" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const arquivo = await prisma.arquivo.create({
    data: {
      nome: file.name || "midia",
      mime: file.type || "application/octet-stream",
      tamanho: buffer.length,
      dados: buffer,
      companyId: sessao.companyId,
    },
    select: { id: true },
  });
  const url = `/api/arquivos/${arquivo.id}`;

  // Substituição (ex.: foto anotada por cima da original)
  const substituirId = String(formData.get("substituirId") || "");
  if (substituirId) {
    const alvo = await prisma.visitaMidia.findFirst({
      where: { id: substituirId, visitaId: id },
    });
    if (!alvo) return NextResponse.json({ error: "Mídia não encontrada" }, { status: 404 });
    const atualizada = await prisma.visitaMidia.update({
      where: { id: substituirId },
      data: { url, arquivoId: arquivo.id },
    });
    return NextResponse.json(atualizada);
  }

  const total = await prisma.visitaMidia.count({ where: { visitaId: id } });
  const midia = await prisma.visitaMidia.create({
    data: {
      visitaId: id,
      tipo: tipoPorMime(file.type || ""),
      url,
      arquivoId: arquivo.id,
      nome: String(formData.get("nome") || file.name || "").slice(0, 200) || null,
      descricao: String(formData.get("descricao") || "").trim() || null,
      ordem: total,
      criadoPor: sessao.nome,
    },
  });
  return NextResponse.json(midia, { status: 201 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await visitaDaEmpresa(id, sessao.companyId)))
    return NextResponse.json({ error: "Visita não encontrada" }, { status: 404 });

  const body = await req.json();
  const midiaId = String(body.midiaId || "");
  const alvo = await prisma.visitaMidia.findFirst({ where: { id: midiaId, visitaId: id } });
  if (!alvo) return NextResponse.json({ error: "Mídia não encontrada" }, { status: 404 });

  const midia = await prisma.visitaMidia.update({
    where: { id: midiaId },
    data: {
      ...(body.descricao !== undefined ? { descricao: String(body.descricao) || null } : {}),
      ...(body.nome !== undefined ? { nome: String(body.nome).slice(0, 200) || null } : {}),
    },
  });
  return NextResponse.json(midia);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await visitaDaEmpresa(id, sessao.companyId)))
    return NextResponse.json({ error: "Visita não encontrada" }, { status: 404 });

  const midiaId = req.nextUrl.searchParams.get("midiaId") || "";
  const alvo = await prisma.visitaMidia.findFirst({ where: { id: midiaId, visitaId: id } });
  if (!alvo) return NextResponse.json({ error: "Mídia não encontrada" }, { status: 404 });

  await prisma.visitaMidia.delete({ where: { id: midiaId } });
  if (alvo.arquivoId)
    await prisma.arquivo.deleteMany({ where: { id: alvo.arquivoId, companyId: sessao.companyId } });
  return NextResponse.json({ success: true });
}
