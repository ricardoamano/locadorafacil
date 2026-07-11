import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          companyName: user.company?.name,
          role: user.role,
          isOwner: user.isOwner,
          modulos: perms?.modulos ?? null,
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
