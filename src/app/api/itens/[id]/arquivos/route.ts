import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Arquivos do item — manuais, apresentações, vídeo-tutoriais, documentos...
// Aceita upload de qualquer espécie (até 4 MB) ou link externo.

type SessionUser = { companyId?: string; name?: string | null };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId ? { companyId: u.companyId, nome: u.name || null } : null;
}

const TAMANHO_MAX = 4 * 1024 * 1024; // 4 MB (limite de corpo da Vercel)
const MIMES_BLOQUEADOS = [
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
];

async function itemDaEmpresa(id: string, companyId: string) {
  return prisma.item.findFirst({ where: { id, companyId }, select: { id: true } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await itemDaEmpresa(id, sessao.companyId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const arquivos = await prisma.itemArquivo.findMany({
    where: { itemId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ arquivos });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await itemDaEmpresa(id, sessao.companyId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") || "";

  // Link externo (JSON)
  if (contentType.includes("application/json")) {
    const body = await req.json();
    const url = String(body.url || "").trim();
    const titulo = String(body.titulo || "").trim() || url;
    if (!/^https?:\/\//i.test(url))
      return NextResponse.json({ error: "Informe uma URL válida (http/https)" }, { status: 400 });
    const arq = await prisma.itemArquivo.create({
      data: { itemId: id, tipo: "LINK", titulo, url, criadoPor: sessao.nome },
    });
    return NextResponse.json(arq, { status: 201 });
  }

  // Upload de arquivo (multipart) — qualquer espécie
  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string")
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  if (file.size > TAMANHO_MAX)
    return NextResponse.json(
      { error: "Arquivo muito grande — o limite é 4 MB. Para arquivos maiores, cole o link (Drive, YouTube...)." },
      { status: 400 }
    );
  if (MIMES_BLOQUEADOS.includes(file.type))
    return NextResponse.json({ error: "Tipo de arquivo não permitido" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const arquivo = await prisma.arquivo.create({
    data: {
      nome: file.name || "arquivo",
      mime: file.type || "application/octet-stream",
      tamanho: file.size,
      dados: buffer,
      companyId: sessao.companyId,
    },
    select: { id: true },
  });
  const arq = await prisma.itemArquivo.create({
    data: {
      itemId: id,
      tipo: "ARQUIVO",
      titulo: file.name || "arquivo",
      url: `/api/arquivos/${arquivo.id}`,
      arquivoId: arquivo.id,
      criadoPor: sessao.nome,
    },
  });
  return NextResponse.json(arq, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await itemDaEmpresa(id, sessao.companyId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const arquivoId = req.nextUrl.searchParams.get("arquivoId") || "";
  const arq = await prisma.itemArquivo.findFirst({ where: { id: arquivoId, itemId: id } });
  if (!arq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.itemArquivo.delete({ where: { id: arquivoId } });
  if (arq.arquivoId) {
    await prisma.arquivo.delete({ where: { id: arq.arquivoId } }).catch(() => {});
  }
  return NextResponse.json({ success: true });
}
