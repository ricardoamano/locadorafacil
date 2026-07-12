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
  CalendarDays,
  Bot,
  Share2,
  DatabaseBackup,
  Sparkles,
  LifeBuoy,
} from "lucide-react";
import React from "react";

type NavChild = { href: string; label: string; icon: React.ElementType; moduleKey?: string };
type NavEntry = {
  key: string;
  href?: string;
  label: string;
  icon: React.ElementType;
  children?: NavChild[];
};

const navItems: NavEntry[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    key: "cadastros",
    label: "Cadastros",
    icon: Users,
    children: [
      { href: "/clientes", label: "Clientes", icon: Users, moduleKey: "clientes" },
      { href: "/fornecedores", label: "Fornecedores", icon: Truck, moduleKey: "fornecedores" },
      { href: "/locais", label: "Locais", icon: MapPin, moduleKey: "locais" },
    ],
  },
  {
    key: "ativos",
    label: "Ativos",
    icon: Package,
    children: [
      { href: "/ativos/itens", label: "Itens", icon: Package },
      { href: "/ativos/estoque", label: "Estoque em Tempo Real", icon: Package },
      { href: "/ativos/kits", label: "Kits / Pacotes", icon: Package },
      { href: "/ativos/precos-mercado", label: "Banco de Preços", icon: Package },
      { href: "/ativos/categorias", label: "Categorias", icon: Package },
      { href: "/ativos/marcas", label: "Marcas", icon: Package },
    ],
  },
  { key: "orcamentos", href: "/orcamentos", label: "Orçamentos", icon: FileText },
  { key: "ordens-servico", href: "/ordens-servico", label: "Ordens de Serviço", icon: ClipboardList },
  { key: "financeiro", href: "/financeiro", label: "Financeiro", icon: DollarSign },
  { key: "calendario", href: "/calendario", label: "Calendário", icon: Calendar },
  {
    key: "equipe",
    label: "Equipe",
    icon: UserCheck,
    children: [
      { href: "/equipe/membros", label: "Membros", icon: UserCheck },
      { href: "/equipe/veiculos", label: "Veículos", icon: Truck },
    ],
  },
  { key: "faturas", href: "/faturas", label: "Faturas", icon: Receipt },
  { key: "tarefas", href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { key: "postos-servico", href: "/postos-servico", label: "Postos de Serviço", icon: Wrench },
  { key: "contratos", href: "/contratos", label: "Contratos", icon: FileSignature },
  { key: "links", href: "/links", label: "Links", icon: Link2 },
  { key: "ajuda", href: "/ajuda", label: "Ajuda", icon: LifeBuoy },
  {
    key: "configuracoes",
    label: "Configurações",
    icon: Settings,
    children: [
      { href: "/configuracoes/empresa", label: "Dados da Empresa", icon: Settings },
      { href: "/configuracoes/usuarios", label: "Usuários", icon: Users },
      { href: "/configuracoes/pagamentos", label: "Métodos de Pagamento", icon: DollarSign },
      { href: "/configuracoes/bancos", label: "Bancos", icon: DollarSign },
      { href: "/configuracoes/modelos-contratos", label: "Modelos de Contratos", icon: FileSignature },
      { href: "/configuracoes/precos", label: "Política de Preços", icon: Package },
      { href: "/configuracoes/tipos-evento", label: "Tipos de Evento", icon: CalendarDays },
      { href: "/configuracoes/whatsapp", label: "WhatsApp (Assistente)", icon: Bot },
      { href: "/configuracoes/os-publica", label: "OS Pública", icon: Share2 },
      { href: "/configuracoes/backup", label: "Backup dos Dados", icon: DatabaseBackup },
      { href: "/configuracoes/ia", label: "Inteligência Artificial", icon: Sparkles },
      { href: "/configuracoes/menu", label: "Personalização do Menu", icon: Menu },
    ],
  },
];

const PADRAO_USER_SIDEBAR = navItems
  .map((i) => i.key)
  .filter((k) => k !== "configuracoes");

function podeVer(
  key: string,
  role: string,
  modulos: string[] | null,
  children?: NavChild[]
): boolean {
  if (role === "ADMIN") return true;
  const lista = modulos && modulos.length > 0 ? modulos : PADRAO_USER_SIDEBAR;
  if (key === "configuracoes") return false;
  if (children?.some((c) => c.moduleKey)) {
    return children.some((c) => !c.moduleKey || lista.includes(c.moduleKey));
  }
  return lista.includes(key);
}

interface MenuCfgItem {
  key: string;
  label?: string;
  hidden?: boolean;
}

function aplicarConfig(
  base: NavEntry[],
  cfg: { itens?: MenuCfgItem[] } | null,
  role: string,
  modulos: string[] | null
): NavEntry[] {
  const porChave = new Map(base.map((i) => [i.key, i]));
  const ordem: NavEntry[] = [];
  const usados = new Set<string>();

  for (const c of cfg?.itens || []) {
    const item = porChave.get(c.key);
    if (!item) continue;
    usados.add(c.key);
    if (c.hidden && c.key !== "configuracoes") continue;
    ordem.push(c.label ? { ...item, label: c.label } : item);
  }
  for (const item of base) {
    if (!usados.has(item.key)) ordem.push(item);
  }
  return ordem.filter((i) => {
    if (role !== "ADMIN") {
      let filhos = i.children;
      if (i.key === "cadastros" && filhos) {
        const lista = modulos && modulos.length > 0 ? modulos : PADRAO_USER_SIDEBAR;
        filhos = filhos.filter((c) => !c.moduleKey || lista.includes(c.moduleKey));
        i = { ...i, children: filhos };
      }
    }
    return podeVer(i.key, role, modulos, i.children);
  });
}

function NavItem({ item }: { item: NavEntry }) {
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

function SidebarContent({
  onNavigate,
  items,
  empresa,
}: {
  onNavigate?: () => void;
  items: NavEntry[];
  empresa: { nome: string; logoUrl: string | null } | null;
}) {
  return (
    <>
      {/* Logo da empresa do usuário logado (somente o logo) */}
      <div className="flex items-center justify-center px-4 py-3 border-b border-slate-100 min-h-[65px]">
        {empresa?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={empresa.logoUrl}
            alt={empresa.nome}
            className="max-h-12 max-w-full object-contain"
          />
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <ClipboardList className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-base truncate">
              {empresa?.nome || "LocadoraFácil"}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("a")) onNavigate?.();
        }}
      >
        {items.map((item) => (
          <NavItem key={item.key} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-100">
        <p className="text-xs text-slate-400 text-center">LocadoraFácil</p>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [items, setItems] = React.useState<NavEntry[]>(navItems);
  const [empresa, setEmpresa] = React.useState<{ nome: string; logoUrl: string | null } | null>(null);
  const pathname = usePathname();

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((me) => {
        setItems(
          aplicarConfig(
            navItems,
            me.menuConfig || null,
            me.role || "USER",
            me.modulos || null
          )
        );
        if (me.empresa) setEmpresa(me.empresa);
      })
      .catch(() => setItems(navItems));
  }, []);

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
        <SidebarContent items={items} empresa={empresa} />
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
            <SidebarContent items={items} empresa={empresa} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
