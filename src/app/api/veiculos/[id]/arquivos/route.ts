import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Documentos do veículo (CRLV, seguro...) e comprovantes/fotos de manutenção.
// Upload de qualquer espécie (até 4 MB) ou link externo.

type SessionUser = { companyId?: string; name?: string | null };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  return u.companyId ? { companyId: u.companyId, nome: u.name || null } : null;
}

const TAMANHO_MAX = 4 * 1024 * 1024;
const MIMES_BLOQUEADOS = [
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
];

async function veiculoDaEmpresa(id: string, companyId: string) {
  return prisma.veiculo.findFirst({ where: { id, companyId }, select: { id: true } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await veiculoDaEmpresa(id, sessao.companyId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    const url = String(body.url || "").trim();
    const titulo = String(body.titulo || "").trim() || url;
    if (!/^https?:\/\//i.test(url))
      return NextResponse.json({ error: "Informe uma URL válida (http/https)" }, { status: 400 });
    const arq = await prisma.veiculoArquivo.create({
      data: {
        veiculoId: id,
        manutencaoId: body.manutencaoId || null,
        tipo: "LINK",
        titulo,
        url,
        criadoPor: sessao.nome,
      },
    });
    return NextResponse.json(arq, { status: 201 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const manutencaoId = (formData.get("manutencaoId") as string) || null;
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
  const arq = await prisma.veiculoArquivo.create({
    data: {
      veiculoId: id,
      manutencaoId,
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
  if (!(await veiculoDaEmpresa(id, sessao.companyId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const arquivoId = req.nextUrl.searchParams.get("arquivoId") || "";
  const arq = await prisma.veiculoArquivo.findFirst({ where: { id: arquivoId, veiculoId: id } });
  if (!arq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.veiculoArquivo.delete({ where: { id: arquivoId } });
  if (arq.arquivoId) await prisma.arquivo.delete({ where: { id: arq.arquivoId } }).catch(() => {});
  return NextResponse.json({ success: true });
}
