import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";

// Empresas emissoras (outros CNPJs do grupo que assinam faturas/recibos).
// Listagem para qualquer usuário com acesso (o seletor da fatura usa);
// criação/edição/exclusão só superadmin.

type SessionUser = { companyId?: string; role?: string };

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

function dadosDoBody(b: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const k of CAMPOS_TEXTO)
    if (b[k] !== undefined) data[k] = String(b[k] ?? "").trim() || null;
  if (b.bancoId !== undefined) data.bancoId = (b.bancoId as string)?.trim() || null;
  if (b.ativo !== undefined) data.ativo = !!b.ativo;
  if (b.faturaNumeroInicial !== undefined)
    data.faturaNumeroInicial =
      b.faturaNumeroInicial === "" || b.faturaNumeroInicial == null
        ? null
        : Math.max(1, Number(b.faturaNumeroInicial) || 1);
  return data;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const emissoras = await prisma.empresaEmissora.findMany({
    where: { companyId },
    orderBy: { nome: "asc" },
    include: {
      bancoRef: { select: { nome: true } },
      _count: { select: { faturas: true } },
    },
  });
  return NextResponse.json({ emissoras });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as SessionUser;
  if (u.role !== "SUPERADMIN" || !u.companyId)
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const b = await req.json();
  if (!b.nome?.trim())
    return NextResponse.json({ error: "Dê um nome à empresa emissora." }, { status: 400 });

  const emissora = await prisma.empresaEmissora.create({
    data: { companyId: u.companyId, nome: b.nome.trim(), ...dadosDoBody(b) },
  });
  await auditar(session.user as never, {
    tipo: "ALTERACAO",
    modulo: "configuracoes",
    acao: `Criou empresa emissora "${emissora.nome}"`,
  });
  return NextResponse.json(emissora, { status: 201 });
}
