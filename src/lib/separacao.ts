import { prisma } from "@/lib/prisma";

// Resumo da separação de uma OS: por item, quanto foi PLANEJADO (orçamento +
// extras), quanto teve SAÍDA (separado/carregou, via conferência QR) e quanto
// teve ENTRADA (voltou ao estoque). Serviços não entram (não embarcam).

export interface ItemSeparado {
  itemId: string;
  nome: string;
  codigo: string;
  apelidos: string | null;
  planejado: number;
  saida: number;
  entrada: number;
  extra: boolean;
}

export async function resumoSeparacao(osId: string): Promise<ItemSeparado[]> {
  const os = await prisma.ordemServico.findUnique({
    where: { id: osId },
    include: {
      orcamento: {
        include: {
          salas: {
            include: {
              itens: {
                include: {
                  item: {
                    select: { id: true, nome: true, codigo: true, apelidos: true, natureza: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!os) return [];

  const mapa = new Map<string, ItemSeparado>();
  for (const sala of os.orcamento?.salas || []) {
    for (const si of sala.itens || []) {
      if (!si.item || si.item.natureza === "SERVICO") continue;
      const at = mapa.get(si.item.id);
      if (at) at.planejado += si.quantidade || 0;
      else
        mapa.set(si.item.id, {
          itemId: si.item.id,
          nome: si.item.nome,
          codigo: si.item.codigo || "",
          apelidos: si.item.apelidos || null,
          planejado: si.quantidade || 0,
          saida: 0,
          entrada: 0,
          extra: false,
        });
    }
  }

  const extras = await prisma.osItemExtra.findMany({
    where: { osId },
    include: { item: { select: { id: true, nome: true, codigo: true, apelidos: true, natureza: true } } },
  });
  for (const ex of extras) {
    if (ex.item.natureza === "SERVICO") continue;
    const at = mapa.get(ex.itemId);
    if (at) at.planejado += ex.quantidade;
    else
      mapa.set(ex.itemId, {
        itemId: ex.itemId,
        nome: ex.item.nome,
        codigo: ex.item.codigo || "",
        apelidos: ex.item.apelidos || null,
        planejado: ex.quantidade,
        saida: 0,
        entrada: 0,
        extra: true,
      });
  }

  const eventos = await prisma.osConferencia.findMany({
    where: { osId },
    select: { itemId: true, tipo: true, quantidade: true },
  });
  for (const ev of eventos) {
    const at = mapa.get(ev.itemId);
    if (!at) continue;
    if (ev.tipo === "SAIDA") at.saida += ev.quantidade;
    else at.entrada += ev.quantidade;
  }

  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

// Quantidade "separada" que embarca: o que teve saída na conferência; se nada
// foi conferido ainda, cai no planejado (para o romaneio não ficar vazio).
export function qtdCarregada(i: ItemSeparado, houveConferencia: boolean): number {
  return houveConferencia ? i.saida : i.planejado;
}
