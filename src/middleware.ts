import { authEdge } from "@/lib/auth-edge";
import { NextResponse } from "next/server";

export default authEdge((req) => {
  const isAuthenticated = !!req.auth;
  const path = req.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login") || path.startsWith("/register");
  const isApiRoute = path.startsWith("/api/");

  if (isApiRoute) return NextResponse.next();

  if (!isAuthenticated && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
