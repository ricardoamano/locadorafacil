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
    <header className="fixed top-0 right-0 left-60 h-14 bg-white border-b border-slate-100 flex items-center justify-between px-6 z-20">
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
          <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="text-left">
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
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-100 bg-white shadow-lg z-20">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
