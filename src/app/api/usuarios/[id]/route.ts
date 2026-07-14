import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

type SessionUser = { companyId?: string };

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const admin = await prisma.user.findFirst({
    where: { email: session.user.email as string, companyId, role: "SUPERADMIN", ativo: true },
  });
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const alvo = await prisma.user.findFirst({ where: { id, companyId } });
  if (!alvo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // Proteções do owner (admin principal): nunca pode ser desativado ou rebaixado
  if (alvo.isOwner) {
    if (body.ativo === false)
      return NextResponse.json(
        { error: "O administrador principal não pode ser desativado" },
        { status: 400 }
      );
    if (body.role && body.role !== "SUPERADMIN")
      return NextResponse.json(
        { error: "O administrador principal não pode ser rebaixado" },
        { status: 400 }
      );
  }
  // Ninguém se auto-desativa
  if (alvo.id === admin.id && body.ativo === false)
    return NextResponse.json(
      { error: "Você não pode desativar o próprio usuário" },
      { status: 400 }
    );

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.role !== undefined)
    data.role = ["ADMIN", "SUPERADMIN"].includes(body.role) ? body.role : "USER";
  if (body.ativo !== undefined) data.ativo = !!body.ativo;
  if (body.modulos !== undefined) {
    data.permissions = Array.isArray(body.modulos) ? { modulos: body.modulos } : null;
  }
  if (body.password) {
    if (String(body.password).length < 6)
      return NextResponse.json(
        { error: "Senha deve ter ao menos 6 caracteres" },
        { status: 400 }
      );
    data.password = await bcrypt.hash(body.password, 10);
  }

  const usuario = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, isOwner: true, ativo: true },
  });
  return NextResponse.json(usuario);
}
