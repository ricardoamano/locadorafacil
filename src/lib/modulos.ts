// Registro central de módulos do sistema.
// Chaves internas NUNCA mudam (rotas/permissões dependem delas);
// a personalização do menu altera apenas rótulos/visibilidade.
export interface ModuloDef {
  key: string;
  label: string;
  href: string;
  apiPrefixes: string[];
}

export const MODULOS: ModuloDef[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", apiPrefixes: [] },
  {
    key: "indicadores",
    label: "Indicadores",
    href: "/indicadores",
    apiPrefixes: ["/api/indicadores"],
  },
  { key: "clientes", label: "Clientes", href: "/clientes", apiPrefixes: [] },
  { key: "fornecedores", label: "Fornecedores", href: "/fornecedores", apiPrefixes: [] },
  { key: "locais", label: "Locais", href: "/locais", apiPrefixes: ["/api/locais"] },
  {
    key: "ativos",
    label: "Ativos",
    href: "/ativos",
    apiPrefixes: ["/api/itens", "/api/marcas"],
  },
  { key: "orcamentos", label: "Orçamentos", href: "/orcamentos", apiPrefixes: ["/api/orcamentos"] },
  { key: "crm", label: "CRM / Follow-up", href: "/crm", apiPrefixes: ["/api/crm"] },
  {
    key: "ordens-servico",
    label: "Ordens de Serviço",
    href: "/ordens-servico",
    apiPrefixes: ["/api/ordens-servico", "/api/nestor"],
  },
  { key: "financeiro", label: "Financeiro", href: "/financeiro", apiPrefixes: ["/api/transacoes"] },
  { key: "calendario", label: "Calendário", href: "/calendario", apiPrefixes: [] },
  { key: "equipe", label: "Equipe", href: "/equipe", apiPrefixes: ["/api/veiculos"] },
  { key: "faturas", label: "Faturas", href: "/faturas", apiPrefixes: ["/api/faturas"] },
  { key: "tarefas", label: "Tarefas", href: "/tarefas", apiPrefixes: ["/api/tarefas"] },
  {
    key: "postos-servico",
    label: "Postos de Serviço",
    href: "/postos-servico",
    apiPrefixes: [],
  },
  { key: "contratos", label: "Contratos", href: "/contratos", apiPrefixes: ["/api/contratos"] },
  { key: "links", label: "Links", href: "/links", apiPrefixes: ["/api/links"] },
  { key: "ajuda", label: "Ajuda", href: "/ajuda", apiPrefixes: [] },
  {
    key: "configuracoes",
    label: "Configurações",
    href: "/configuracoes",
    apiPrefixes: [
      "/api/usuarios",
      "/api/metodos-pagamento",
      "/api/modelos-contrato",
      "/api/politica-precos",
    ],
  },
];

export const TODAS_CHAVES = MODULOS.map((m) => m.key);

// Padrão para perfil USER sem permissões definidas: tudo menos Configurações
export const PADRAO_USER = TODAS_CHAVES.filter((k) => k !== "configuracoes");

/** Módulo dono de um caminho de página, ou null se livre */
export function moduloDaRota(pathname: string): string | null {
  for (const m of MODULOS) {
    if (pathname === m.href || pathname.startsWith(m.href + "/")) return m.key;
  }
  return null;
}

/** Módulo dono de um caminho de API, ou null se compartilhado/livre */
export function moduloDaApi(pathname: string): string | null {
  for (const m of MODULOS) {
    for (const p of m.apiPrefixes) {
      if (pathname === p || pathname.startsWith(p + "/")) return m.key;
    }
  }
  return null;
}

export function podeAcessar(
  modulos: string[] | null | undefined,
  role: string | undefined,
  chave: string
): boolean {
  if (role === "ADMIN") return true;
  const lista = modulos && modulos.length > 0 ? modulos : PADRAO_USER;
  return lista.includes(chave);
}
