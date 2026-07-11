"use client";

import { useSession, signOut } from "next-auth/react";
import { ChevronRight, LogOut, User } from "lucide-react";
import Link from "next/link";
import React from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
}

export function Header({ breadcrumbs = [] }: HeaderProps) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="fixed top-0 right-0 left-0 md:left-60 h-14 bg-white border-b border-slate-100 flex items-center justify-between pl-14 pr-4 md:px-6 z-20">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-600">
          Home
        </Link>
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            {crumb.href ? (
              <Link
                href={crumb.href}
                className={
                  i === breadcrumbs.length - 1
                    ? "text-slate-900 font-medium"
                    : "text-slate-400 hover:text-slate-600"
                }
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-slate-900 font-medium">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {(session?.user?.name || session?.user?.email || "U")
              .charAt(0)
              .toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-slate-900 leading-none">
              {session?.user?.name || "Usuário"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {(session?.user as { companyName?: string })?.companyName ||
                "Empresa"}
            </p>
          </div>
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-slate-100 bg-white shadow-lg z-20 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(session?.user?.name || session?.user?.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {session?.user?.name || "Usuário"}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {session?.user?.email}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {(session?.user as { role?: string })?.role === "ADMIN"
                    ? "Administrador"
                    : "Usuário"}
                  {" · "}
                  {(session?.user as { companyName?: string })?.companyName || "Empresa"}
                </p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                Sair da conta
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
