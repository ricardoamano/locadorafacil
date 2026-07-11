"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Truck,
  MapPin,
  Package,
  FileText,
  ClipboardList,
  DollarSign,
  Calendar,
  UserCheck,
  Receipt,
  Link2,
  FileSignature,
  CheckSquare,
  Wrench,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Settings,
} from "lucide-react";
import React from "react";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Cadastros",
    icon: Users,
    children: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/fornecedores", label: "Fornecedores", icon: Truck },
      { href: "/locais", label: "Locais", icon: MapPin },
    ],
  },
  {
    label: "Ativos",
    icon: Package,
    children: [
      { href: "/ativos/itens", label: "Itens", icon: Package },
      { href: "/ativos/categorias", label: "Categorias", icon: Package },
      { href: "/ativos/marcas", label: "Marcas", icon: Package },
    ],
  },
  {
    href: "/orcamentos",
    label: "Orçamentos",
    icon: FileText,
  },
  {
    href: "/ordens-servico",
    label: "Ordens de Serviço",
    icon: ClipboardList,
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: DollarSign,
  },
  {
    href: "/calendario",
    label: "Calendário",
    icon: Calendar,
  },
  {
    label: "Equipe",
    icon: UserCheck,
    children: [
      { href: "/equipe/membros", label: "Membros", icon: UserCheck },
      { href: "/equipe/veiculos", label: "Veículos", icon: Truck },
    ],
  },
  {
    href: "/faturas",
    label: "Faturas",
    icon: Receipt,
  },
  {
    href: "/tarefas",
    label: "Tarefas",
    icon: CheckSquare,
  },
  {
    href: "/postos-servico",
    label: "Postos de Serviço",
    icon: Wrench,
  },
  {
    href: "/contratos",
    label: "Contratos",
    icon: FileSignature,
  },
  {
    href: "/links",
    label: "Links",
    icon: Link2,
  },
  {
    label: "Configurações",
    icon: Settings,
    children: [
      { href: "/configuracoes/empresa", label: "Dados da Empresa", icon: Settings },
      { href: "/configuracoes/usuarios", label: "Usuários", icon: Users },
      { href: "/configuracoes/pagamentos", label: "Métodos de Pagamento", icon: DollarSign },
      { href: "/configuracoes/modelos-contratos", label: "Modelos de Contratos", icon: FileSignature },
    ],
  },
];

function NavItem({
  item,
}: {
  item: (typeof navItems)[number];
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(() => {
    if ("children" in item && item.children) {
      return item.children.some((child) => pathname.startsWith(child.href));
    }
    return false;
  });

  if ("children" in item && item.children) {
    const isActive = item.children.some((child) =>
      pathname.startsWith(child.href)
    );
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "text-blue-700"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        {open && (
          <div className="ml-4 mt-0.5 border-l border-slate-100 pl-3 flex flex-col gap-0.5">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  pathname.startsWith(child.href)
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <child.icon className="h-3.5 w-3.5 shrink-0" />
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const href = (item as { href: string }).href;
  const isActive =
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-blue-50 text-blue-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-100">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <ClipboardList className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-slate-900 text-lg">LocadoraFácil</span>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("a")) onNavigate?.();
        }}
      >
        {navItems.map((item, i) => (
          <NavItem key={i} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-100">
        <p className="text-xs text-slate-400 text-center">LocadoraFácil v1.0</p>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  // Fecha o drawer ao trocar de rota
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Botão hamburguer — só mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed left-3 top-3 z-40 h-9 w-9 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar fixa — desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 border-r border-slate-100 bg-white flex-col z-30">
        <SidebarContent />
      </aside>

      {/* Drawer — mobile */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white flex flex-col shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3.5 h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
