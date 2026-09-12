import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { montarImportacaoClientes, type ClienteImport } from "@/lib/import-bubble";
import { compararRegistros, normalizarChave, type Decisao } from "@/lib/importar-revisao";

// Importa clientes + contatos (+ endereços opcional) do CSV do Bubble.
// POST { clientesCsv, contatosCsv, enderecosCsv?, confirmar?, decisoes? }:
//  - sem confirmar → prévia: estatísticas, amostra e COMPARAÇÃO com o que já
//    existe (novos / iguais / divergentes para revisão item a item)
//  - confirmar → cria os novos; para os já existentes segue a decisão:
//    manter (só completa campos em branco), atualizar (sobrescreve com o
//    arquivo) ou criar (novo registro mesmo assim)

export const maxDuration = 60;

type SessionUser = { companyId?: string };

const CAMPOS_COMPARAR = [
  { campo: "razaoSocial", label: "Razão social" },
  { campo: "cnpj", label: "CNPJ" },
  { campo: "rua", label: "Rua" },
  { campo: "numero", label: "Número" },
  { campo: "cidade", label: "Cidade" },
  { campo: "estado", label: "Estado" },
  { campo: "cep", label: "CEP" },
  { campo: "inscricaoEstadual", label: "Inscrição estadual" },
] as const;

type CampoCliente = (typeof CAMPOS_COMPARAR)[number]["campo"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  const clientesCsv = String(body.clientesCsv || "");
  const contatosCsv = String(body.contatosCsv || "");
  const enderecosCsv = body.enderecosCsv ? String(body.enderecosCsv) : undefined;
  if (!clientesCsv.trim())
    return NextResponse.json({ error: "Envie o arquivo de clientes." }, { status: 400 });

  let resultado;
  try {
    resultado = montarImportacaoClientes(clientesCsv, contatosCsv, enderecosCsv);
  } catch {
    return NextResponse.json(
      { error: "Não consegui ler os arquivos. Confira se são os CSVs exportados do Bubble." },
      { status: 400 }
    );
  }

  const existentes = await prisma.contact.findMany({
    where: { companyId, type: "CLIENTE" },
    include: { subContacts: { select: { nome: true } } },
  });
  const porNome = new Map(existentes.map((e) => [normalizarChave(e.nomeFantasia), e]));

  // Prévia + comparação (sem gravar)
  if (!body.confirmar) {
    const comp = compararRegistros(resultado.clientes, existentes, {
      chaveNovo: (c) => normalizarChave(c.nomeFantasia),
      chaveExistente: (e) => normalizarChave(e.nomeFantasia),
      idExistente: (e) => e.id,
      resumoExistente: (e) =>
        [e.razaoSocial, e.cnpj, [e.cidade, e.estado].filter(Boolean).join("/")]
          .filter(Boolean)
          .join(" · "),
      campos: CAMPOS_COMPARAR.map((c) => ({
        campo: c.campo,
        label: c.label,
        novo: (n: ClienteImport) => n[c.campo as CampoCliente],
        atual: (e) => e[c.campo as CampoCliente],
      })),
    });
    return NextResponse.json({
      previa: true,
      stats: resultado.stats,
      comparacao: {
        novos: comp.novos.length,
        iguais: comp.iguais,
        divergentes: comp.divergentes.map((d) => ({
          chave: d.chave,
          titulo: d.novo.nomeFantasia,
          existenteResumo: d.existenteResumo,
          diffs: d.diffs,
        })),
      },
      amostra: resultado.clientes.slice(0, 8).map((c) => ({
        nomeFantasia: c.nomeFantasia,
        razaoSocial: c.razaoSocial,
        cnpj: c.cnpj,
        posto: c.isPostoServico,
        cidade: c.cidade,
        enderecoCompleto: c.enderecoCompleto,
        contatos: c.subcontatos.map((s) => s.nome),
      })),
    });
  }

  const decisoes = (body.decisoes || {}) as Record<string, Decisao>;
  let criados = 0;
  let atualizados = 0;
  let mantidos = 0;
  let contatosCriados = 0;

  for (const c of resultado.clientes) {
    const chave = normalizarChave(c.nomeFantasia);
    const decisao = decisoes[chave];
    const existente = decisao === "criar" ? undefined : porNome.get(chave);

    if (existente) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: any = {};
      const vazio = (v: string | null) => !v || !v.trim();
      const campos: CampoCliente[] = [
        "razaoSocial", "cnpj", "rua", "numero", "cidade", "estado", "cep", "inscricaoEstadual",
      ];
      for (const k of campos) {
        const novo = c[k];
        if (!novo) continue;
        // manter = só completa o que está em branco; atualizar = sobrescreve
        if (decisao === "atualizar" ? novo !== existente[k] : vazio(existente[k])) patch[k] = novo;
      }
      if (c.bairro && (decisao === "atualizar" || vazio(existente.bairro))) patch.bairro = c.bairro;
      if (c.inscricaoMunicipal && (decisao === "atualizar" || vazio(existente.inscricaoMunicipal)))
        patch.inscricaoMunicipal = c.inscricaoMunicipal;
      if (!existente.bubbleId && c.bubbleId) patch.bubbleId = c.bubbleId;

      // Contatos (pessoas) que ainda não existem no cliente entram sempre
      const nomesExistentes = new Set(existente.subContacts.map((s) => normalizarChave(s.nome)));
      const novosSubs = c.subcontatos.filter((s) => !nomesExistentes.has(normalizarChave(s.nome)));
      if (novosSubs.length > 0) {
        patch.subContacts = {
          create: novosSubs.map((s) => ({ nome: s.nome, email: s.email, telefone: s.telefone })),
        };
        contatosCriados += novosSubs.length;
      }

      if (Object.keys(patch).length > 0) {
        await prisma.contact.update({ where: { id: existente.id }, data: patch });
        atualizados++;
      } else {
        mantidos++;
      }
      continue;
    }

    await prisma.contact.create({
      data: {
        type: "CLIENTE",
        nomeFantasia: c.nomeFantasia,
        razaoSocial: c.razaoSocial,
        cnpj: c.cnpj,
        rua: c.rua,
        cep: c.cep,
        numero: c.numero,
        bairro: c.bairro,
        cidade: c.cidade,
        estado: c.estado,
        inscricaoEstadual: c.inscricaoEstadual,
        inscricaoMunicipal: c.inscricaoMunicipal,
        isPostoServico: c.isPostoServico,
        bubbleId: c.bubbleId,
        companyId,
        subContacts: {
          create: c.subcontatos.map((s) => ({ nome: s.nome, email: s.email, telefone: s.telefone })),
        },
      },
    });
    criados++;
    contatosCriados += c.subcontatos.length;
  }

  return NextResponse.json({
    ok: true,
    criados,
    atualizados,
    mantidos,
    pulados: mantidos,
    contatosCriados,
    comEndereco: resultado.stats.comEndereco,
    postos: resultado.stats.postos,
  });
}
