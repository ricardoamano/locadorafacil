import { authEdge } from "@/lib/auth-edge";
import { NextResponse } from "next/server";
import { moduloDaRota, moduloDaApi, podeAcessar } from "@/lib/modulos";

export default authEdge((req) => {
  const isAuthenticated = !!req.auth;
  const path = req.nextUrl.pathname;
  const isApiRoute = path.startsWith("/api/");

  const user = req.auth?.user as
    | { role?: string; modulos?: string[] | null }
    | undefined;

  // APIs protegidas por módulo (JWT assinado — validação de backend)
  if (isApiRoute) {
    if (!isAuthenticated) return NextResponse.next(); // rotas de auth cuidam disso
    const chave = moduloDaApi(path);
    if (chave && !podeAcessar(user?.modulos, user?.role, chave)) {
      return NextResponse.json(
        { error: "Sem permissão para este módulo" },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Bloqueio de acesso direto por URL a módulos sem autorização
  const chave = moduloDaRota(path);
  if (chave && !podeAcessar(user?.modulos, user?.role, chave)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!login|register|catalogo|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
