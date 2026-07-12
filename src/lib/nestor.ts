// NESTOR — assistente de WhatsApp da empresa.
// Envia OS aos técnicos escalados, avisos de alteração e lembretes de datas.
// Envio automático via WhatsApp Business Cloud API (Meta) quando a empresa
// configurou as credenciais; caso contrário a UI oferece links wa.me.

const GRAPH_URL = "https://graph.facebook.com/v21.0";

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

// ── Modelos de mensagem (sem valores financeiros — mesma regra da OS) ─────────

function fmtData(d: Date | string | null | undefined): string {
  if (!d) return "a definir";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtDataHora(d: Date | string | null | undefined): string {
  if (!d) return "a definir";
  const x = new Date(d);
  return `${x.toLocaleDateString("pt-BR")} às ${x.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export interface DadosOsMensagem {
  numero: number | string;
  eventoNome?: string | null;
  dataInicio?: Date | string | null;
  dataFim?: Date | string | null;
  horarioMontagem?: Date | string | null;
  horarioDesmontagem?: Date | string | null;
  localNome?: string | null;
  localEndereco?: string | null;
  observacoes?: string | null;
  empresaNome: string;
}

export interface DadosEscalado {
  nome: string;
  funcao?: string | null;
  horarioEntrada?: Date | string | null;
}

export function mensagemEscala(os: DadosOsMensagem, m: DadosEscalado): string {
  const linhas = [
    `🤖 *NESTOR* — ${os.empresaNome}`,
    ``,
    `Olá, ${m.nome}! Você está *escalado(a)* para o evento:`,
    ``,
    `📋 *OS #${os.numero}* — ${os.eventoNome || "Evento"}`,
    `📅 Evento: ${fmtData(os.dataInicio)}${os.dataFim ? ` até ${fmtData(os.dataFim)}` : ""}`,
  ];
  if (os.horarioMontagem) linhas.push(`🔧 Montagem: ${fmtDataHora(os.horarioMontagem)}`);
  if (os.horarioDesmontagem)
    linhas.push(`📦 Desmontagem: ${fmtDataHora(os.horarioDesmontagem)}`);
  if (m.horarioEntrada) linhas.push(`⏰ Sua entrada: ${fmtDataHora(m.horarioEntrada)}`);
  if (m.funcao) linhas.push(`🎯 Função: ${m.funcao}`);
  if (os.localNome) {
    linhas.push(`📍 Local: ${os.localNome}${os.localEndereco ? ` — ${os.localEndereco}` : ""}`);
  }
  if (os.observacoes) linhas.push(``, `📝 Observações: ${os.observacoes}`);
  linhas.push(``, `Qualquer dúvida, fale com a produção. Bom trabalho! 💪`);
  return linhas.join("\n");
}

export function mensagemAlteracao(os: DadosOsMensagem, m: DadosEscalado): string {
  const linhas = [
    `🤖 *NESTOR* — ${os.empresaNome}`,
    ``,
    `⚠️ *Atenção, ${m.nome}!* Houve *alteração* na OS em que você está escalado(a):`,
    ``,
    `📋 *OS #${os.numero}* — ${os.eventoNome || "Evento"}`,
    `📅 Evento: ${fmtData(os.dataInicio)}${os.dataFim ? ` até ${fmtData(os.dataFim)}` : ""}`,
  ];
  if (os.horarioMontagem) linhas.push(`🔧 Montagem: ${fmtDataHora(os.horarioMontagem)}`);
  if (os.horarioDesmontagem)
    linhas.push(`📦 Desmontagem: ${fmtDataHora(os.horarioDesmontagem)}`);
  if (m.horarioEntrada) linhas.push(`⏰ Sua entrada: ${fmtDataHora(m.horarioEntrada)}`);
  if (os.localNome) {
    linhas.push(`📍 Local: ${os.localNome}${os.localEndereco ? ` — ${os.localEndereco}` : ""}`);
  }
  if (os.observacoes) linhas.push(``, `📝 Observações: ${os.observacoes}`);
  linhas.push(``, `Confira os dados atualizados acima. ✅`);
  return linhas.join("\n");
}

export function mensagemLembrete(os: DadosOsMensagem, m: DadosEscalado): string {
  const linhas = [
    `🤖 *NESTOR* — ${os.empresaNome}`,
    ``,
    `🔔 *Lembrete, ${m.nome}!* Amanhã tem evento e você está escalado(a):`,
    ``,
    `📋 *OS #${os.numero}* — ${os.eventoNome || "Evento"}`,
    `📅 Evento: ${fmtData(os.dataInicio)}${os.dataFim ? ` até ${fmtData(os.dataFim)}` : ""}`,
  ];
  if (os.horarioMontagem) linhas.push(`🔧 Montagem: ${fmtDataHora(os.horarioMontagem)}`);
  if (m.horarioEntrada) linhas.push(`⏰ Sua entrada: ${fmtDataHora(m.horarioEntrada)}`);
  if (m.funcao) linhas.push(`🎯 Função: ${m.funcao}`);
  if (os.localNome) {
    linhas.push(`📍 Local: ${os.localNome}${os.localEndereco ? ` — ${os.localEndereco}` : ""}`);
  }
  linhas.push(``, `Até amanhã! 💪`);
  return linhas.join("\n");
}
