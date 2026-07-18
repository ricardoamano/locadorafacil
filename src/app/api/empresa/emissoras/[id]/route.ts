import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";

type SessionUser = { companyId?: string; role?: string };

async function getSuper() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (u.role !== "SUPERADMIN" || !u.companyId) return null;
  return { session, companyId: u.companyId };
}

const CAMPOS_TEXTO = [
  "nome",
  "razaoSocial",
  "cnpj",
  "inscricaoEstadual",
  "inscricaoMunicipal",
  "cep",
  "rua",
  "numero",
  "bairro",
  "cidade",
  "estado",
  "telefone",
  "email",
  "logoUrl",
  "naturezaOperacao",
  "observacaoFatura",
  "banco",
  "agencia",
  "conta",
  "pix",
] as const;

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSuper();
  if (!ctx) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { id } = await params;

  const existe = await prisma.empresaEmissora.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of CAMPOS_TEXTO)
    if (b[k] !== undefined) data[k] = String(b[k] ?? "").trim() || null;
  if (b.bancoId !== undefined) data.bancoId = (b.bancoId as string)?.trim() || null;
  if (b.ativo !== undefined) data.ativo = !!b.ativo;
  if (data.nome === null) delete data.nome;

  const emissora = await prisma.empresaEmissora.update({ where: { id }, data });
  await auditar(ctx.session.user as never, {
    tipo: "ALTERACAO",
    modulo: "configuracoes",
    acao: `Editou empresa emissora "${emissora.nome}"`,
  });
  return NextResponse.json(emissora);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSuper();
  if (!ctx) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { id } = await params;

  const existe = await prisma.empresaEmissora.findFirst({
    where: { id, companyId: ctx.companyId },
    include: { _count: { select: { faturas: true } } },
  });
  if (!existe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existe._count.faturas > 0)
    return NextResponse.json(
      { error: `Há ${existe._count.faturas} fatura(s) emitidas por ela — desative em vez de excluir.` },
      { status: 400 }
    );

  await prisma.empresaEmissora.delete({ where: { id } });
  await auditar(ctx.session.user as never, {
    tipo: "ALTERACAO",
    modulo: "configuracoes",
    acao: `Excluiu empresa emissora "${existe.nome}"`,
  });
  return NextResponse.json({ success: true });
}
