import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Classificações de manutenção de veículos — padrão + as criadas pela empresa.

type SessionUser = { companyId?: string };

const TIPOS_PADRAO = [
  "Troca de óleo",
  "Pneus",
  "Revisão",
  "Freios",
  "Bateria",
  "Funilaria",
  "Alinhamento",
];

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

function customDaEmpresa(tiposManutencao: unknown): string[] {
  return Array.isArray(tiposManutencao)
    ? tiposManutencao.map((t) => String(t)).filter(Boolean)
    : [];
}

export async function GET() {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tiposManutencao: true },
  });
  const custom = customDaEmpresa(c?.tiposManutencao);
  return NextResponse.json({ padrao: TIPOS_PADRAO, custom });
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const nome = String(body.nome || "").trim();
  if (!nome) return NextResponse.json({ error: "Informe o nome" }, { status: 400 });

  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tiposManutencao: true },
  });
  const custom = customDaEmpresa(c?.tiposManutencao);
  const todos = [...TIPOS_PADRAO, ...custom];
  if (todos.some((t) => t.toLowerCase() === nome.toLowerCase()))
    return NextResponse.json({ padrao: TIPOS_PADRAO, custom });

  const novos = [...custom, nome];
  await prisma.company.update({
    where: { id: companyId },
    data: { tiposManutencao: novos },
  });
  return NextResponse.json({ padrao: TIPOS_PADRAO, custom: novos }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nome = req.nextUrl.searchParams.get("nome") || "";
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tiposManutencao: true },
  });
  const custom = customDaEmpresa(c?.tiposManutencao).filter(
    (t) => t.toLowerCase() !== nome.toLowerCase()
  );
  await prisma.company.update({
    where: { id: companyId },
    data: { tiposManutencao: custom },
  });
  return NextResponse.json({ padrao: TIPOS_PADRAO, custom });
}
