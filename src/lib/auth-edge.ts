import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Lightweight auth for Edge Runtime (middleware) - no database calls
export const { auth: authEdge } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {},
      authorize: () => null,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub as string;
        (session.user as { companyId?: string }).companyId =
          token.companyId as string;
        (session.user as { companyName?: string }).companyName =
          token.companyName as string;
      }
      return session;
    },
  },
});
