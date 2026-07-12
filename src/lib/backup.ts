import { gzipSync } from "zlib";
import { prisma } from "@/lib/prisma";

// Backup completo da empresa: todas as tabelas em JSON (imagens ficam de fora
// do arquivo — apenas os metadados — para o backup continuar leve).
// Senhas de usuários e o token do WhatsApp nunca entram no arquivo.

const RETENCAO = 14; // snapshots mantidos por empresa

export async function montarBackup(companyId: string) {
  const [
    company,
    users,
    contacts,
    subContacts,
    locais,
    categorias,
    subCategorias,
    marcas,
    itens,
    itemAcessorios,
    itemUnidades,
    kits,
    kitItens,
    eventos,
    orcamentos,
    salas,
    salaItens,
    ordensServico,
    escala,
    osItensExtras,
    osConferencias,
    osAnexos,
    osAlteracoes,
    membros,
    especialidades,
    membroEspecialidades,
    avaliacoes,
    veiculos,
    transacoes,
    faturas,
    faturaItens,
    tarefas,
    tarefaMembros,
    contratos,
    metodosPagamento,
    bancos,
    modelosContrato,
    links,
    arquivosMeta,
  ] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      omit: { whatsappToken: true },
    }),
    prisma.user.findMany({ where: { companyId }, omit: { password: true } }),
    prisma.contact.findMany({ where: { companyId } }),
    prisma.subContact.findMany({ where: { contact: { companyId } } }),
    prisma.local.findMany({ where: { companyId } }),
    prisma.categoria.findMany({ where: { companyId } }),
    prisma.subCategoria.findMany({ where: { categoria: { companyId } } }),
    prisma.marca.findMany({ where: { companyId } }),
    prisma.item.findMany({ where: { companyId } }),
    prisma.itemAcessorio.findMany({ where: { itemBase: { companyId } } }),
    prisma.itemUnidade.findMany({ where: { companyId } }),
    prisma.kit.findMany({ where: { companyId } }),
    prisma.kitItem.findMany({ where: { kit: { companyId } } }),
    prisma.evento.findMany({ where: { companyId } }),
    prisma.orcamento.findMany({ where: { companyId } }),
    prisma.sala.findMany({ where: { orcamento: { companyId } } }),
    prisma.salaItem.findMany({ where: { sala: { orcamento: { companyId } } } }),
    prisma.ordemServico.findMany({ where: { companyId } }),
    prisma.escalaMembro.findMany({ where: { os: { companyId } } }),
    prisma.osItemExtra.findMany({ where: { os: { companyId } } }),
    prisma.osConferencia.findMany({ where: { os: { companyId } } }),
    prisma.osAnexo.findMany({ where: { os: { companyId } } }),
    prisma.osAlteracao.findMany({ where: { os: { companyId } } }),
    prisma.membro.findMany({ where: { companyId } }),
    prisma.especialidade.findMany(),
    prisma.membroEspecialidade.findMany({ where: { membro: { companyId } } }),
    prisma.avaliacao.findMany({ where: { membro: { companyId } } }),
    prisma.veiculo.findMany({ where: { companyId } }),
    prisma.transacao.findMany({ where: { companyId } }),
    prisma.fatura.findMany({ where: { companyId } }),
    prisma.faturaItem.findMany({ where: { fatura: { companyId } } }),
    prisma.tarefa.findMany({ where: { companyId } }),
    prisma.tarefaMembro.findMany({ where: { tarefa: { companyId } } }),
    prisma.contrato.findMany({ where: { companyId } }),
    prisma.metodoPagamento.findMany({ where: { companyId } }),
    prisma.banco.findMany({ where: { companyId } }),
    prisma.modeloContrato.findMany({ where: { companyId } }),
    prisma.link.findMany({ where: { companyId } }),
    prisma.arquivo.findMany({ where: { companyId }, omit: { dados: true } }),
  ]);

  return {
    _backup: {
      sistema: "LocadoraFacil",
      versao: 1,
      geradoEm: new Date().toISOString(),
      empresa: company?.name,
      observacao:
        "Imagens/arquivos binários não estão neste JSON (apenas metadados em 'arquivos').",
    },
    company,
    users,
    contacts,
    subContacts,
    locais,
    categorias,
    subCategorias,
    marcas,
    itens,
    itemAcessorios,
    itemUnidades,
    kits,
    kitItens,
    eventos,
    orcamentos,
    salas,
    salaItens,
    ordensServico,
    escala,
    osItensExtras,
    osConferencias,
    osAnexos,
    osAlteracoes,
    membros,
    especialidades,
    membroEspecialidades,
    avaliacoes,
    veiculos,
    transacoes,
    faturas,
    faturaItens,
    tarefas,
    tarefaMembros,
    contratos,
    metodosPagamento,
    bancos,
    modelosContrato,
    links,
    arquivos: arquivosMeta,
  };
}

/** Gera, salva o snapshot (gzip) e aplica a retenção. Retorna id e tamanho. */
export async function gerarSnapshot(
  companyId: string,
  opts: { automatico?: boolean; criadoPor?: string | null } = {}
) {
  const backup = await montarBackup(companyId);
  const dados = gzipSync(Buffer.from(JSON.stringify(backup)));

  const snap = await prisma.backupSnapshot.create({
    data: {
      companyId,
      tamanho: dados.length,
      dados,
      automatico: opts.automatico ?? false,
      criadoPor: opts.criadoPor ?? null,
    },
    select: { id: true, tamanho: true, createdAt: true },
  });

  // Retenção: mantém os RETENCAO mais recentes
  const antigos = await prisma.backupSnapshot.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    skip: RETENCAO,
    select: { id: true },
  });
  if (antigos.length > 0) {
    await prisma.backupSnapshot.deleteMany({
      where: { id: { in: antigos.map((a) => a.id) } },
    });
  }

  return snap;
}
