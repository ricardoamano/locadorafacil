import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.local.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const local = await prisma.local.update({
    where: { id },
    data: {
      nome: body.nome,
      cep: body.cep || null,
      rua: body.rua || null,
      numero: body.numero || null,
      bairro: body.bairro || null,
      complemento: body.complemento || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      lat: body.lat != null && body.lat !== "" ? Number(body.lat) : null,
      lng: body.lng != null && body.lng !== "" ? Number(body.lng) : null,
      observacoes: body.observacoes || null,
    },
  });

  return NextResponse.json(local);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.local.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.local.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
