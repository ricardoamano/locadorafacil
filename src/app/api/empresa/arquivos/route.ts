import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Documentos e links da empresa (cartão CNPJ, docs fiscais, pastas do Drive...).
// Leitura para qualquer usuário da empresa; anexar/remover só para admin.

type SessionUser = { companyId?: string; role?: string; name?: string | null };

async function getSessao(precisaAdmin: boolean) {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (!u.companyId) return null;
  if (precisaAdmin && u.role !== "SUPERADMIN") return "SEM_ADMIN" as const;
  return { companyId: u.companyId, nome: u.name || null };
}

const TAMANHO_MAX = 4 * 1024 * 1024; // 4 MB
const MIMES_BLOQUEADOS = [
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
];

export async function GET() {
  const sessao = await getSessao(false);
  if (!sessao || sessao === "SEM_ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const arquivos = await prisma.companyArquivo.findMany({
    where: { companyId: sessao.companyId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ arquivos });
}

export async function POST(req: NextRequest) {
  const sessao = await getSessao(true);
  if (sessao === "SEM_ADMIN")
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";

  // Link externo (JSON) — ex.: pasta compartilhada do Google Drive
  if (contentType.includes("application/json")) {
    const body = await req.json();
    const url = String(body.url || "").trim();
    const titulo = String(body.titulo || "").trim() || url;
    if (!/^https?:\/\//i.test(url))
      return NextResponse.json({ error: "Informe uma URL válida (http/https)" }, { status: 400 });
    const arq = await prisma.companyArquivo.create({
      data: { companyId: sessao.companyId, tipo: "LINK", titulo, url, criadoPor: sessao.nome },
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
      { error: "Arquivo muito grande — o limite é 4 MB. Para maiores, cole o link (Drive...)." },
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
  const arq = await prisma.companyArquivo.create({
    data: {
      companyId: sessao.companyId,
      tipo: "ARQUIVO",
      titulo: file.name || "arquivo",
      url: `/api/arquivos/${arquivo.id}`,
      arquivoId: arquivo.id,
      criadoPor: sessao.nome,
    },
  });
  return NextResponse.json(arq, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const sessao = await getSessao(true);
  if (sessao === "SEM_ADMIN")
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") || "";
  const arq = await prisma.companyArquivo.findFirst({
    where: { id, companyId: sessao.companyId },
  });
  if (!arq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.companyArquivo.delete({ where: { id } });
  if (arq.arquivoId) await prisma.arquivo.delete({ where: { id: arq.arquivoId } }).catch(() => {});
  return NextResponse.json({ success: true });
}
