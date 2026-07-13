// CRM — cadência de follow-up para orçamentos ainda não aprovados.
// A rotina lembra a equipe de cobrar feedback do cliente, com base na data de
// criação do orçamento, na proximidade do evento e no último contato feito.

// Orçamentos "em aberto" (não aprovados nem perdidos)
export const STATUS_ABERTO = ["PENDENTE", "AGUARDANDO"];

const DIA = 86_400_000;

// Primeiro follow-up: 2 dias após criar o orçamento.
const DIAS_PRIMEIRO = 2;
// Follow-ups seguintes: a cada 3 dias após o último contato.
const DIAS_INTERVALO = 3;
// Evento próximo: passa a ser prioridade alta.
const DIAS_EVENTO_URGENTE = 7;

export type Prioridade = "ALTA" | "MEDIA" | "BAIXA";

export interface Cadencia {
  proximaData: Date;
  vencido: boolean;
  prioridade: Prioridade;
  diasParaEvento: number | null;
  diasSemContato: number;
}

function meiaNoite(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

/**
 * Calcula quando o próximo follow-up deve acontecer e a prioridade.
 * - proximaDataManual: data agendada manualmente no último follow-up (sobrepõe).
 * - ultimoContato: createdAt do último follow-up registrado (ou null).
 */
export function calcularCadencia(params: {
  createdAt: Date;
  dataEvento: Date | null;
  ultimoContato: Date | null;
  proximaDataManual: Date | null;
  agora: Date;
}): Cadencia {
  const { createdAt, dataEvento, ultimoContato, proximaDataManual, agora } = params;

  let proximaData: Date;
  if (proximaDataManual) {
    proximaData = proximaDataManual;
  } else if (ultimoContato) {
    proximaData = new Date(ultimoContato.getTime() + DIAS_INTERVALO * DIA);
  } else {
    proximaData = new Date(createdAt.getTime() + DIAS_PRIMEIRO * DIA);
  }

  const diasParaEvento = dataEvento
    ? Math.round((meiaNoite(dataEvento).getTime() - meiaNoite(agora).getTime()) / DIA)
    : null;

  // Evento próximo (e ainda em aberto) puxa o follow-up para hoje.
  const eventoUrgente =
    diasParaEvento !== null && diasParaEvento >= 0 && diasParaEvento <= DIAS_EVENTO_URGENTE;
  if (eventoUrgente && proximaData > agora) {
    proximaData = agora;
  }

  const vencido = meiaNoite(proximaData) <= meiaNoite(agora);
  const diasSemContato = Math.round(
    (meiaNoite(agora).getTime() - meiaNoite(ultimoContato || createdAt).getTime()) / DIA
  );

  let prioridade: Prioridade = "BAIXA";
  if (eventoUrgente || (vencido && diasSemContato >= 5)) prioridade = "ALTA";
  else if (vencido) prioridade = "MEDIA";

  return { proximaData, vencido, prioridade, diasParaEvento, diasSemContato };
}

export const CANAL_OPCOES = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "TELEFONE", label: "Telefone" },
  { value: "EMAIL", label: "E-mail" },
  { value: "OUTRO", label: "Outro" },
];

export const RESULTADO_OPCOES = [
  { value: "SEM_RESPOSTA", label: "Sem resposta" },
  { value: "NEGOCIANDO", label: "Negociando" },
  { value: "VAI_PENSAR", label: "Vai pensar / retornar" },
  { value: "GANHOU", label: "Fechou (ganhou)" },
  { value: "PERDEU", label: "Perdeu" },
];
