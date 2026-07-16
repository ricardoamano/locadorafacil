// Assistente de WhatsApp da empresa (cada empresa dá o nome que quiser, ex.: NESTOR).
// Envia OS aos técnicos escalados, avisos de alteração e lembretes de datas.
// Envio automático via WhatsApp Business Cloud API (Meta) quando a empresa
// configurou as credenciais; caso contrário a UI oferece links wa.me.
// Os textos são templates editáveis pelo admin, com variáveis {assim}.

const GRAPH_URL = "https://graph.facebook.com/v21.0";

export const ASSISTENTE_PADRAO = "Assistente";

export interface WhatsappConfig {
  whatsappPhoneId: string | null;
  whatsappToken: string | null;
}

export function nestorConfigurado(c: WhatsappConfig | null | undefined): boolean {
  return Boolean(c?.whatsappPhoneId && c?.whatsappToken);
}

/** Normaliza telefone BR para o formato internacional exigido pela API (55DDDNÚMERO). */
export function normalizarTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  let d = telefone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55")) d = `55${d}`;
  // 55 + DDD(2) + número(8 ou 9)
  return d.length >= 12 && d.length <= 13 ? d : null;
}

export function linkWaMe(telefone: string, mensagem: string): string {
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}

/** Envia texto pela Cloud API. Retorna erro legível ou null em caso de sucesso. */
export async function enviarWhatsapp(
  config: WhatsappConfig,
  telefone: string,
  mensagem: string
): Promise<string | null> {
  if (!nestorConfigurado(config)) return "WhatsApp não configurado";
  try {
    const res = await fetch(`${GRAPH_URL}/${config.whatsappPhoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefone,
        type: "text",
        text: { body: mensagem },
      }),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.error?.message || `Erro ${res.status} ao enviar`;
  } catch (e) {
    return e instanceof Error ? e.message : "Falha de conexão com a API";
  }
}

// ── Evolution API (conexão via QR code — número segue no celular) ────────────

export interface EvolutionConfig {
  evolutionUrl: string | null;
  evolutionApiKey: string | null;
  evolutionInstance: string | null;
}

export function evolutionConfigurado(c: EvolutionConfig | null | undefined): boolean {
  return Boolean(c?.evolutionUrl && c?.evolutionApiKey && c?.evolutionInstance);
}

/**
 * Envia texto pela Evolution API. `destino` pode ser um número (55...) ou um
 * JID completo (inclusive de grupo, ...@g.us). Retorna erro legível ou null.
 */
export async function enviarEvolution(
  config: EvolutionConfig,
  destino: string,
  mensagem: string
): Promise<string | null> {
  if (!evolutionConfigurado(config)) return "Evolution API não configurada";
  const base = config.evolutionUrl!.replace(/\/$/, "");
  const url = `${base}/message/sendText/${encodeURIComponent(config.evolutionInstance!)}`;
  const headers = { apikey: config.evolutionApiKey!, "Content-Type": "application/json" };
  try {
    // Formato da Evolution v2; se o servidor for v1, repete no formato antigo
    let res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ number: destino, text: mensagem }),
    });
    if (res.status === 400) {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ number: destino, textMessage: { text: mensagem } }),
      });
    }
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    const detalhe =
      (data as { response?: { message?: unknown }; message?: unknown })?.response?.message ||
      (data as { message?: unknown })?.message;
    return detalhe ? JSON.stringify(detalhe).slice(0, 300) : `Erro ${res.status} ao enviar`;
  } catch (e) {
    return e instanceof Error ? e.message : "Falha de conexão com a Evolution API";
  }
}

/** Estado da conexão da instância (open = conectada ao WhatsApp). */
export async function evolutionEstado(
  config: EvolutionConfig
): Promise<{ state: string | null; erro: string | null }> {
  if (!evolutionConfigurado(config)) return { state: null, erro: "Evolution API não configurada" };
  const base = config.evolutionUrl!.replace(/\/$/, "");
  const url = `${base}/instance/connectionState/${encodeURIComponent(config.evolutionInstance!)}`;
  try {
    const res = await fetch(url, { headers: { apikey: config.evolutionApiKey! } });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const m =
        (data as { response?: { message?: unknown }; message?: unknown })?.response?.message ||
        (data as { message?: unknown })?.message;
      return { state: null, erro: m ? JSON.stringify(m).slice(0, 300) : `Erro ${res.status}` };
    }
    const state =
      (data as { instance?: { state?: string }; state?: string })?.instance?.state ||
      (data as { state?: string })?.state ||
      null;
    return { state, erro: null };
  } catch (e) {
    return { state: null, erro: e instanceof Error ? e.message : "Falha de conexão" };
  }
}

/** Configura (ou atualiza) o webhook da instância para receber as mensagens. */
export async function evolutionSetWebhook(
  config: EvolutionConfig,
  webhookUrl: string
): Promise<string | null> {
  if (!evolutionConfigurado(config)) return "Evolution API não configurada";
  const base = config.evolutionUrl!.replace(/\/$/, "");
  const endpoint = `${base}/webhook/set/${encodeURIComponent(config.evolutionInstance!)}`;
  const headers = { apikey: config.evolutionApiKey!, "Content-Type": "application/json" };
  const eventos = ["MESSAGES_UPSERT"];
  try {
    // Formato Evolution v2
    let res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        webhook: { enabled: true, url: webhookUrl, webhookByEvents: false, base64: false, events: eventos },
      }),
    });
    // Formato Evolution v1 (fallback)
    if (res.status === 400 || res.status === 404) {
      res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ url: webhookUrl, webhook_by_events: false, events: eventos }),
      });
    }
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    const m =
      (data as { response?: { message?: unknown }; message?: unknown })?.response?.message ||
      (data as { message?: unknown })?.message;
    return m ? JSON.stringify(m).slice(0, 300) : `Erro ${res.status} ao configurar webhook`;
  } catch (e) {
    return e instanceof Error ? e.message : "Falha de conexão com a Evolution API";
  }
}

// ── Templates editáveis ───────────────────────────────────────────────────────

export type TipoTemplate = "ESCALA" | "ALTERACAO" | "LEMBRETE";

export const VARIAVEIS_TEMPLATE: { chave: string; descricao: string }[] = [
  { chave: "{assistente}", descricao: "Nome do assistente" },
  { chave: "{empresa}", descricao: "Nome da empresa" },
  { chave: "{nome}", descricao: "Nome do membro da equipe" },
  { chave: "{os}", descricao: "Número da OS" },
  { chave: "{evento}", descricao: "Nome do evento" },
  { chave: "{periodo}", descricao: "Período do evento (início até fim)" },
  { chave: "{montagem}", descricao: "Data/hora da montagem" },
  { chave: "{desmontagem}", descricao: "Data/hora da desmontagem" },
  { chave: "{entrada}", descricao: "Horário de entrada do membro" },
  { chave: "{funcao}", descricao: "Função do membro na escala" },
  { chave: "{local}", descricao: "Nome e endereço do local" },
  { chave: "{link_maps}", descricao: "Link do local no Google Maps" },
  { chave: "{link_waze}", descricao: "Link do local no Waze" },
  { chave: "{link_os}", descricao: "Link público simplificado da OS" },
  { chave: "{produtores}", descricao: "Produtores/contatos do evento (nome, função e WhatsApp)" },
  { chave: "{observacoes}", descricao: "Observações operacionais da OS" },
];

export const TEMPLATES_PADRAO: Record<TipoTemplate, string> = {
  ESCALA: [
    "🤖 *{assistente}* — {empresa}",
    "",
    "Olá, {nome}! Você está *escalado(a)* para o evento:",
    "",
    "📋 *OS #{os}* — {evento}",
    "📅 Evento: {periodo}",
    "🔧 Montagem: {montagem}",
    "📦 Desmontagem: {desmontagem}",
    "⏰ Sua entrada: {entrada}",
    "🎯 Função: {funcao}",
    "📍 Local: {local}",
    "🗺️ Google Maps: {link_maps}",
    "🚗 Waze: {link_waze}",
    "📄 OS completa: {link_os}",
    "",
    "📞 Contatos no evento: {produtores}",
    "",
    "📝 Observações: {observacoes}",
    "",
    "Qualquer dúvida, fale com a produção. Bom trabalho! 💪",
  ].join("\n"),
  ALTERACAO: [
    "🤖 *{assistente}* — {empresa}",
    "",
    "⚠️ *Atenção, {nome}!* Houve *alteração* na OS em que você está escalado(a):",
    "",
    "📋 *OS #{os}* — {evento}",
    "📅 Evento: {periodo}",
    "🔧 Montagem: {montagem}",
    "📦 Desmontagem: {desmontagem}",
    "⏰ Sua entrada: {entrada}",
    "📍 Local: {local}",
    "🗺️ Google Maps: {link_maps}",
    "📄 OS completa: {link_os}",
    "",
    "📞 Contatos no evento: {produtores}",
    "",
    "📝 Observações: {observacoes}",
    "",
    "Confira os dados atualizados acima. ✅",
  ].join("\n"),
  LEMBRETE: [
    "🤖 *{assistente}* — {empresa}",
    "",
    "🔔 *Lembrete, {nome}!* Amanhã tem evento e você está escalado(a):",
    "",
    "📋 *OS #{os}* — {evento}",
    "📅 Evento: {periodo}",
    "🔧 Montagem: {montagem}",
    "⏰ Sua entrada: {entrada}",
    "🎯 Função: {funcao}",
    "📍 Local: {local}",
    "🗺️ Google Maps: {link_maps}",
    "🚗 Waze: {link_waze}",
    "📄 OS completa: {link_os}",
    "",
    "📞 Contatos no evento: {produtores}",
    "",
    "Até amanhã! 💪",
  ].join("\n"),
};

/** Templates da empresa mesclados com os padrões. */
export function templatesDaEmpresa(json: unknown): Record<TipoTemplate, string> {
  const t = (json || {}) as Partial<Record<TipoTemplate, string>>;
  return {
    ESCALA: t.ESCALA?.trim() || TEMPLATES_PADRAO.ESCALA,
    ALTERACAO: t.ALTERACAO?.trim() || TEMPLATES_PADRAO.ALTERACAO,
    LEMBRETE: t.LEMBRETE?.trim() || TEMPLATES_PADRAO.LEMBRETE,
  };
}

/**
 * Preenche o template. Linhas cujo(s) placeholder(s) ficaram todos vazios são
 * removidas (ex.: sem desmontagem definida, a linha da desmontagem some).
 */
export function renderTemplate(template: string, vars: Record<string, string | null | undefined>): string {
  const linhas = template.split("\n").map((linha) => {
    const placeholders = linha.match(/\{[a-z_]+\}/g);
    if (!placeholders) return linha;
    let temValor = false;
    let out = linha;
    for (const ph of placeholders) {
      const v = vars[ph.slice(1, -1)];
      if (v) temValor = true;
      out = out.split(ph).join(v || "");
    }
    return temValor ? out : null;
  });
  // remove linhas descartadas e evita 3+ quebras seguidas
  return linhas
    .filter((l) => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Montagem das variáveis a partir da OS ─────────────────────────────────────

function fmtData(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtDataHora(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const x = new Date(d);
  return `${x.toLocaleDateString("pt-BR")} às ${x.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export interface LocalOs {
  nome?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export function enderecoDoLocal(local: LocalOs | null | undefined): string | null {
  if (!local) return null;
  const e = [local.rua, local.numero, local.bairro, local.cidade].filter(Boolean).join(", ");
  return e || null;
}

export function linkMaps(local: LocalOs | null | undefined): string | null {
  if (!local) return null;
  if (local.lat != null && local.lng != null)
    return `https://www.google.com/maps/search/?api=1&query=${local.lat},${local.lng}`;
  const q = [local.nome, enderecoDoLocal(local), local.estado].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

export function linkWaze(local: LocalOs | null | undefined): string | null {
  if (!local) return null;
  if (local.lat != null && local.lng != null)
    return `https://waze.com/ul?ll=${local.lat},${local.lng}&navigate=yes`;
  const q = [enderecoDoLocal(local), local.estado].filter(Boolean).join(", ");
  return q ? `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes` : null;
}

export interface ProdutorEvento {
  nome?: string | null;
  telefone?: string | null;
  funcao?: string | null;
  observacao?: string | null;
}

/** Lista de produtores formatada para a mensagem (um por linha, com link direto). */
export function formatarProdutores(produtores: unknown): string | null {
  if (!Array.isArray(produtores)) return null;
  const linhas = (produtores as ProdutorEvento[])
    .filter((p) => p?.nome || p?.telefone)
    .map((p) => {
      const nome = p.nome?.trim() || "Contato";
      const funcao = p.funcao?.trim();
      const tel = normalizarTelefone(p.telefone);
      const partes = [`• ${nome}${funcao ? ` (${funcao})` : ""}`];
      if (p.telefone?.trim()) partes.push(`: ${p.telefone.trim()}`);
      if (tel) partes.push(` — https://wa.me/${tel}`);
      if (p.observacao?.trim()) partes.push(`\n  ↳ ${p.observacao.trim()}`);
      return partes.join("");
    });
  // começa com quebra de linha para a lista ficar abaixo do rótulo no template
  return linhas.length > 0 ? "\n" + linhas.join("\n") : null;
}

export interface DadosOsMensagem {
  numero: number | string;
  eventoNome?: string | null;
  dataInicio?: Date | string | null;
  dataFim?: Date | string | null;
  horarioMontagem?: Date | string | null;
  horarioDesmontagem?: Date | string | null;
  local?: LocalOs | null;
  observacoes?: string | null;
  empresaNome: string;
  assistenteNome?: string | null;
  linkOs?: string | null;
  produtores?: unknown;
}

export interface DadosEscalado {
  nome: string;
  funcao?: string | null;
  horarioEntrada?: Date | string | null;
}

export function variaveisMensagem(
  os: DadosOsMensagem,
  m: DadosEscalado
): Record<string, string | null> {
  const inicio = fmtData(os.dataInicio);
  const fim = fmtData(os.dataFim);
  const periodo = inicio ? (fim && fim !== inicio ? `${inicio} até ${fim}` : inicio) : null;
  const endereco = enderecoDoLocal(os.local);
  const localNome = os.local?.nome || null;
  return {
    assistente: os.assistenteNome?.trim() || ASSISTENTE_PADRAO,
    empresa: os.empresaNome,
    nome: m.nome,
    os: String(os.numero ?? ""),
    evento: os.eventoNome || null,
    periodo,
    montagem: fmtDataHora(os.horarioMontagem),
    desmontagem: fmtDataHora(os.horarioDesmontagem),
    entrada: fmtDataHora(m.horarioEntrada),
    funcao: m.funcao || null,
    local: localNome ? (endereco ? `${localNome} — ${endereco}` : localNome) : endereco,
    link_maps: linkMaps(os.local),
    link_waze: linkWaze(os.local),
    link_os: os.linkOs || null,
    produtores: formatarProdutores(os.produtores),
    observacoes: os.observacoes || null,
  };
}

export function montarMensagem(
  tipo: TipoTemplate,
  templates: Record<TipoTemplate, string>,
  os: DadosOsMensagem,
  m: DadosEscalado
): string {
  return renderTemplate(templates[tipo], variaveisMensagem(os, m));
}
