import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = {
  companyId?: string;
  role?: string;
  isOwner?: boolean;
  modulos?: string[] | null;
};

// Perfil do usuário logado + configuração de menu da empresa
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as SessionUser;

  let menuConfig = null;
  if (u.companyId) {
    const empresa = await prisma.company.findUnique({
      where: { id: u.companyId },
      select: { menuConfig: true, name: true },
    });
    menuConfig = empresa?.menuConfig ?? null;
  }

  return NextResponse.json({
    name: session.user.name,
    email: session.user.email,
    role: u.role || "USER",
    isOwner: !!u.isOwner,
    modulos: u.modulos ?? null,
    menuConfig,
  });
}
