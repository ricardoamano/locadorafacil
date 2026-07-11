import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string; role?: string };

const TIPOS_PADRAO = [
  "Corporativo",
  "Show",
  "Feira",
  "Congresso",
  "Casamento",
  "Formatura",
  "Social",
  "Esportivo",
  "Religioso",
  "Outro",
];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tiposEvento: true },
  });
  const salvos = empresa?.tiposEvento;
  const tipos =
    Array.isArray(salvos) && salvos.length > 0
      ? (salvos as string[]).filter((t) => typeof t === "string")
      : TIPOS_PADRAO;
  return NextResponse.json({ tipos, personalizado: Array.isArray(salvos) && salvos.length > 0 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as SessionUser;
  if (!u.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });
  if (u.role !== "ADMIN")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();

  // null = restaurar padrão
  if (body.tipos === null) {
    await prisma.company.update({
      where: { id: u.companyId },
      data: { tiposEvento: Prisma.DbNull },
    });
    return NextResponse.json({ tipos: TIPOS_PADRAO });
  }

  const tipos = (Array.isArray(body.tipos) ? body.tipos : [])
    .map((t: unknown) => String(t).trim().slice(0, 60))
    .filter((t: string, i: number, arr: string[]) => t && arr.indexOf(t) === i);

  if (tipos.length === 0)
    return NextResponse.json({ error: "Informe ao menos um tipo de evento." }, { status: 400 });

  await prisma.company.update({
    where: { id: u.companyId },
    data: { tiposEvento: tipos },
  });
  return NextResponse.json({ tipos });
}
