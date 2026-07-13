// Seções da OS pública — o admin de cada empresa decide o que expor.
// Chaves NUNCA mudam (a config salva depende delas).

export interface SecaoOsPublica {
  key: string;
  label: string;
  descricao: string;
}

export const SECOES_OS_PUBLICA: SecaoOsPublica[] = [
  { key: "cliente", label: "Cliente e tipo de evento", descricao: "Nome do cliente e o tipo do evento no cabeçalho" },
  { key: "datas", label: "Datas e horários", descricao: "Período do evento, montagem e desmontagem (com observações)" },
  { key: "local", label: "Local + navegação", descricao: "Nome, endereço, observação do local e botões Google Maps/Waze" },
  { key: "infoEvento", label: "Informações do evento", descricao: "Texto livre do responsável, com selo de atualização" },
  { key: "produtores", label: "Contatos no evento", descricao: "Produtores com botão de WhatsApp e observações" },
  { key: "anexos", label: "Arquivos e links", descricao: "Briefings, PDFs, apresentações e links" },
  { key: "equipe", label: "Equipe escalada", descricao: "Membros escalados com função, dia e horário de entrada e saída" },
  { key: "equipeContatos", label: "Contatos da equipe", descricao: "Telefone (WhatsApp) e e-mail dos técnicos escalados" },
  { key: "veiculos", label: "Veículos escalados", descricao: "Veículos da operação com placa, motorista e observações" },
  { key: "equipamentos", label: "Equipamentos", descricao: "Lista de equipamentos por sala + extras/acessórios" },
  { key: "servicos", label: "Serviços contratados", descricao: "Serviços do orçamento (sem valores)" },
  { key: "observacoes", label: "Observações operacionais", descricao: "Observações gerais da OS" },
  { key: "historico", label: "Histórico de alterações", descricao: "Linha do tempo de mudanças com autor e hora" },
];

export type ConfigOsPublica = Record<string, boolean>;

/** Config da empresa mesclada com o padrão (tudo visível). */
export function configOsPublica(json: unknown): ConfigOsPublica {
  const salvo = (json || {}) as Record<string, unknown>;
  const cfg: ConfigOsPublica = {};
  for (const s of SECOES_OS_PUBLICA) {
    cfg[s.key] = salvo[s.key] === undefined ? true : Boolean(salvo[s.key]);
  }
  return cfg;
}
