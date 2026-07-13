// Recorrência de tarefas (estilo Google Agenda). Ao concluir uma tarefa
// recorrente, geramos automaticamente a próxima ocorrência com as datas
// deslocadas por um intervalo, mantendo responsáveis e atribuídos.

import type { PrismaClient } from "@prisma/client";

export type Recorrencia = "DIARIA" | "SEMANAL" | "MENSAL" | "ANUAL";

export const RECORRENCIA_OPCOES: { value: string; label: string }[] = [
  { value: "", label: "Não repetir" },
  { value: "DIARIA", label: "Todos os dias" },
  { value: "SEMANAL", label: "Toda semana" },
  { value: "MENSAL", label: "Todo mês" },
  { value: "ANUAL", label: "Todo ano" },
];

/** Desloca uma data pelo intervalo da recorrência. */
export function proximaData(d: Date, r: Recorrencia): Date {
  const nd = new Date(d);
  if (r === "DIARIA") nd.setDate(nd.getDate() + 1);
  else if (r === "SEMANAL") nd.setDate(nd.getDate() + 7);
  else if (r === "MENSAL") nd.setMonth(nd.getMonth() + 1);
  else if (r === "ANUAL") nd.setFullYear(nd.getFullYear() + 1);
  return nd;
}

/**
 * Gera a próxima ocorrência de uma tarefa recorrente que acabou de ser concluída.
 * Retorna o id da nova tarefa, ou null se não houver recorrência ou já passou
 * do limite (recorrenciaAte).
 */
export async function gerarProximaOcorrencia(
  prisma: PrismaClient,
  tarefaId: string
): Promise<string | null> {
  const t = await prisma.tarefa.findUnique({
    where: { id: tarefaId },
    include: {
      responsaveis: { select: { membroId: true } },
      atribuidos: { select: { userId: true } },
    },
  });
  if (!t || !t.recorrencia) return null;
  const r = t.recorrencia as Recorrencia;

  const novaInicio = proximaData(t.dataInicio, r);
  const novaEntrega = proximaData(t.dataEntrega, r);

  if (t.recorrenciaAte && novaInicio > t.recorrenciaAte) return null;

  // Evita duplicar: se já existe uma ocorrência futura desta série, não recria.
  const jaExiste = await prisma.tarefa.findFirst({
    where: {
      companyId: t.companyId,
      recorrenteDe: t.recorrenteDe || t.id,
      dataInicio: novaInicio,
      status: { not: "CONCLUIDA" },
    },
    select: { id: true },
  });
  if (jaExiste) return null;

  const nova = await prisma.tarefa.create({
    data: {
      nome: t.nome,
      instrucoes: t.instrucoes,
      dataInicio: novaInicio,
      dataEntrega: novaEntrega,
      status: "NAO_INICIADA",
      criadorId: t.criadorId,
      companyId: t.companyId,
      recorrencia: t.recorrencia,
      recorrenciaAte: t.recorrenciaAte,
      recorrenteDe: t.recorrenteDe || t.id,
      responsaveis: {
        create: t.responsaveis.map((m) => ({ membroId: m.membroId })),
      },
      atribuidos: {
        create: t.atribuidos.map((u) => ({ userId: u.userId })),
      },
    },
    select: { id: true },
  });
  return nova.id;
}
