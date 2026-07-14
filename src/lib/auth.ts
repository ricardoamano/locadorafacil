import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/auditoria";
import { normalizarPerfis } from "@/lib/perfis";
import bcrypt from "bcryptjs";

// Módulos efetivos que vão no token: ADMIN usa os módulos configurados pelo
// superadmin (ou todos, se não configurado); USER usa os próprios; SUPER = null.
function modulosDoUsuario(
  role: string | null | undefined,
  permsModulos: string[] | null,
  perfisConfig: unknown
): string[] | null {
  if (role === "ADMIN") {
    const cfg = normalizarPerfis(perfisConfig);
    return cfg.adminModulos && cfg.adminModulos.length > 0 ? cfg.adminModulos : null;
  }
  if (role === "USER") return permsModulos;
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { company: true },
        });

        if (!user || !user.password) return null;
        if (user.ativo === false) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        const perms = user.permissions as { modulos?: string[] } | null;
        await auditar(
          {
            id: user.id,
            companyId: user.companyId || undefined,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          { tipo: "LOGIN", acao: "Entrou no sistema" }
        );
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          companyName: user.company?.name,
          role: user.role,
          isOwner: user.isOwner,
          modulos: modulosDoUsuario(user.role, perms?.modulos ?? null, user.company?.perfisConfig),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          companyId?: string;
          companyName?: string;
          role?: string;
          isOwner?: boolean;
          modulos?: string[] | null;
        };
        token.companyId = u.companyId;
        token.companyName = u.companyName;
        token.role = u.role;
        token.isOwner = u.isOwner;
        token.modulos = u.modulos ?? null;
        token.permCheck = Date.now();
      } else if (token.sub) {
        // Revalida role/permissões/ativo no banco a cada 30s, para que mudanças
        // de acesso (ex.: remover um módulo de um usuário) tenham efeito sem
        // exigir novo login. Sem isto, o token guarda as permissões do login.
        const ultima = (token.permCheck as number) || 0;
        if (Date.now() - ultima > 30_000) {
          try {
            const atual = await prisma.user.findUnique({
              where: { id: token.sub as string },
              select: {
                role: true,
                permissions: true,
                ativo: true,
                company: { select: { perfisConfig: true } },
              },
            });
            if (!atual || !atual.ativo) {
              // Usuário desativado/removido: invalida o token (força logout).
              return null;
            }
            const perms = atual.permissions as { modulos?: string[] } | null;
            token.role = atual.role;
            token.modulos = modulosDoUsuario(atual.role, perms?.modulos ?? null, atual.company?.perfisConfig);
            token.permCheck = Date.now();
          } catch {
            // Erro transitório de banco: mantém o token atual e tenta de novo depois.
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub as string;
        (session.user as { companyId?: string }).companyId =
          token.companyId as string;
        (session.user as { companyName?: string }).companyName =
          token.companyName as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { isOwner?: boolean }).isOwner = token.isOwner as boolean;
        (session.user as { modulos?: string[] | null }).modulos =
          (token.modulos as string[] | null) ?? null;
      }
      return session;
    },
  },
});
