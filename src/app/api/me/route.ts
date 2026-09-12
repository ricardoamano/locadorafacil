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
  let empresaInfo: { nome: string; logoUrl: string | null; ferramentasMigracao: boolean } | null = null;
  if (u.companyId) {
    const empresa = await prisma.company.findUnique({
      where: { id: u.companyId },
      select: { menuConfig: true, name: true, logoUrl: true, ferramentasMigracao: true },
    });
    menuConfig = empresa?.menuConfig ?? null;
    if (empresa)
      empresaInfo = {
        nome: empresa.name,
        logoUrl: empresa.logoUrl,
        ferramentasMigracao: empresa.ferramentasMigracao,
      };
  }

  // Celular do vendedor: vem do perfil de membro vinculado ao usuário
  let telefone: string | null = null;
  if (session.user.email) {
    const eu = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { membro: { select: { telefone: true } } },
    });
    telefone = eu?.membro?.telefone || null;
  }

  return NextResponse.json({
    name: session.user.name,
    email: session.user.email,
    telefone,
    role: u.role || "USER",
    isOwner: !!u.isOwner,
    modulos: u.modulos ?? null,
    menuConfig,
    empresa: empresaInfo,
  });
}
