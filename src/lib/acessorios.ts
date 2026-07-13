import { prisma } from "@/lib/prisma";
import { proximoCodigoItem } from "@/lib/unidades";

// Vincula acessórios a um item. Nomes que ainda não existem viram itens novos
// (ex.: "Cabo de energia", "Controle remoto") com quantidade 0 para ajuste depois.

export async function vincularAcessorios(
  companyId: string,
  itemBaseId: string,
  nomes: string[]
): Promise<{ criados: string[]; vinculados: number }> {
  const criados: string[] = [];
  let vinculados = 0;

  const unicos = [...new Set(nomes.map((n) => n.trim()).filter((n) => n.length >= 2))].slice(0, 20);

  for (const nome of unicos) {
    let acessorio = await prisma.item.findFirst({
      where: { companyId, nome: { equals: nome, mode: "insensitive" as const } },
      select: { id: true },
    });

    if (!acessorio) {
      const codigo = await proximoCodigoItem(companyId);
      acessorio = await prisma.item.create({
        data: {
          codigo,
          nome,
          natureza: "EQUIPAMENTO",
          tipo: "PROPRIO",
          quantidade: 0,
          // Acessório não é alugado sozinho — fora do catálogo público por padrão
          emCatalogo: false,
          publicado: false,
          companyId,
        },
        select: { id: true },
      });
      criados.push(nome);
    }

    if (acessorio.id === itemBaseId) continue;

    const jaVinculado = await prisma.itemAcessorio.findFirst({
      where: { itemBaseId, acessorioId: acessorio.id },
      select: { id: true },
    });
    if (!jaVinculado) {
      await prisma.itemAcessorio.create({
        data: { itemBaseId, acessorioId: acessorio.id },
      });
      // Item que virou acessório sai do catálogo público (não se aluga avulso)
      await prisma.item.update({
        where: { id: acessorio.id },
        data: { emCatalogo: false, publicado: false },
      });
      vinculados++;
    }
  }

  return { criados, vinculados };
}
