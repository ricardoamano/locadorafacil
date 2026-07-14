import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Contas bancárias da empresa (dados para pagamento) — várias por empresa.
// Mantém a 1ª conta espelhada em Company.banco/agencia/conta/pix (usada na fatura).

type SessionUser = { companyId?: string; email?: string | null };

async function getAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (!u.companyId) return null;
  const dbUser = await prisma.user.findFirst({
    where: { email: session.user.email as string, companyId: u.companyId },
    select: { role: true },
  });
  return dbUser?.role === "SUPERADMIN" ? u.companyId : null;
}

async function sincronizarPrincipal(companyId: string) {
  const primeira = await prisma.contaBancaria.findFirst({
    where: { companyId },
    orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
  });
  await prisma.company.update({
    where: { id: companyId },
    data: {
      banco: primeira?.banco || null,
      agencia: primeira?.agencia || null,
      conta: primeira?.conta || null,
      pix: primeira?.pix || null,
    },
  });
}

export async function GET() {
  const session = await auth();
  const companyId = (session?.user as SessionUser | undefined)?.companyId;
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const contas = await prisma.contaBancaria.findMany({
    where: { companyId },
    orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ contas });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dados(b: any) {
  return {
    banco: String(b.banco || "").trim(),
    agencia: String(b.agencia || "").trim() || null,
    conta: String(b.conta || "").trim() || null,
    tipoConta: b.tipoConta === "Poupança" ? "Poupança" : "Corrente",
    pix: String(b.pix || "").trim() || null,
    pixTipo: String(b.pixTipo || "").trim() || null,
  };
}

export async function POST(req: NextRequest) {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const body = await req.json();
  const d = dados(body);
  if (!d.banco) return NextResponse.json({ error: "Informe o banco" }, { status: 400 });
  const total = await prisma.contaBancaria.count({ where: { companyId } });
  const conta = await prisma.contaBancaria.create({
    data: { ...d, companyId, ordem: total },
  });
  await sincronizarPrincipal(companyId);
  return NextResponse.json(conta, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const body = await req.json();
  const id = String(body.id || "");
  const existe = await prisma.contaBancaria.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!existe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = dados(body);
  if (!d.banco) return NextResponse.json({ error: "Informe o banco" }, { status: 400 });
  const conta = await prisma.contaBancaria.update({ where: { id }, data: d });
  await sincronizarPrincipal(companyId);
  return NextResponse.json(conta);
}

export async function DELETE(req: NextRequest) {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") || "";
  const existe = await prisma.contaBancaria.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!existe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.contaBancaria.delete({ where: { id } });
  await sincronizarPrincipal(companyId);
  return NextResponse.json({ success: true });
}
