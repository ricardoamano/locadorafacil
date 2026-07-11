import { prisma } from "@/lib/prisma";

export function codigoUnidade(codigoItem: string, numero: number) {
  return `${codigoItem}-${String(numero).padStart(2, "0")}`;
}

/** Próximo código numérico sequencial de item na empresa (0001, 0002, ...) */
export async function proximoCodigoItem(companyId: string): Promise<string> {
  const itens = await prisma.item.findMany({
    where: { companyId },
    select: { codigo: true },
  });
  let max = 0;
  for (const i of itens) {
    const n = parseInt((i.codigo || "").replace(/\D/g, ""), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1).padStart(4, "0");
}

/**
 * Garante unidades físicas = quantidade do item (cria as que faltam, nunca
 * remove — unidades sobrando devem ser baixadas manualmente para auditoria).
 */
export async function sincronizarUnidades(itemId: string) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, codigo: true, quantidade: true, companyId: true },
  });
  if (!item || !item.codigo) return;

  const ativas = await prisma.itemUnidade.count({
    where: { itemId, status: { not: "BAIXADA" } },
  });
  const faltam = (item.quantidade || 0) - ativas;
  if (faltam <= 0) return;

  const ultima = await prisma.itemUnidade.findFirst({
    where: { itemId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  let numero = ultima?.numero || 0;
  const novas = [];
  for (let k = 0; k < faltam; k++) {
    numero += 1;
    novas.push({
      itemId,
      numero,
      codigo: codigoUnidade(item.codigo, numero),
      status: "EM_ESTOQUE",
      companyId: item.companyId,
    });
  }
  await prisma.itemUnidade.createMany({ data: novas, skipDuplicates: true });
}

/** Ao alterar o código do item, atualiza o prefixo dos códigos das unidades */
export async function renomearCodigosUnidades(itemId: string, codigoItem: string) {
  if (!codigoItem) return;
  const unidades = await prisma.itemUnidade.findMany({
    where: { itemId },
    select: { id: true, numero: true, codigo: true },
  });
  for (const u of unidades) {
    const novo = codigoUnidade(codigoItem, u.numero);
    if (novo !== u.codigo) {
      await prisma.itemUnidade.update({ where: { id: u.id }, data: { codigo: novo } });
    }
  }
}
