import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { montarImportacaoClientes } from "@/lib/import-bubble";

// Importa clientes + contatos (+ endereços opcional) do CSV do Bubble.
// POST { clientesCsv, contatosCsv, enderecosCsv?, confirmar? }:
//  - sem confirmar → prévia (estatísticas + amostra), nada é gravado
//  - confirmar → cria clientes novos e ATUALIZA o endereço em branco dos já
//    existentes (cruzando a rua com o arquivo de Endereços)

export const maxDuration = 60;

type SessionUser = { companyId?: string };

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

  // Prévia (sem gravar)
  if (!body.confirmar) {
    return NextResponse.json({
      previa: true,
      stats: resultado.stats,
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

  // Índice dos clientes já existentes (por nome fantasia) para atualizar endereço
  const existentes = await prisma.contact.findMany({
    where: { companyId, type: "CLIENTE" },
    select: { id: true, nomeFantasia: true, cep: true, numero: true, cidade: true, estado: true },
  });
  const porNome = new Map(existentes.map((e) => [e.nomeFantasia.trim().toLowerCase(), e]));

  let criados = 0;
  let atualizados = 0;
  let pulados = 0;
  let contatosCriados = 0;

  for (const c of resultado.clientes) {
    const chave = c.nomeFantasia.trim().toLowerCase();
    const existente = porNome.get(chave);

    if (existente) {
      // Já existe: completa só os campos de endereço que estiverem em branco
      const vazio = (v: string | null) => !v || !v.trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: any = {};
      if (c.enderecoCompleto) {
        if (vazio(existente.cep) && c.cep) patch.cep = c.cep;
        if (vazio(existente.numero) && c.numero) patch.numero = c.numero;
        if (vazio(existente.cidade) && c.cidade) patch.cidade = c.cidade;
        if (vazio(existente.estado) && c.estado) patch.estado = c.estado;
        if (c.bairro) patch.bairro = c.bairro;
      }
      if (Object.keys(patch).length > 0) {
        await prisma.contact.update({ where: { id: existente.id }, data: patch });
        atualizados++;
      } else {
        pulados++;
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
          create: c.subcontatos.map((s) => ({
            nome: s.nome,
            email: s.email,
            telefone: s.telefone,
          })),
        },
      },
    });
    criados++;
    contatosCriados += c.subcontatos.length;
    porNome.set(chave, {
      id: "novo",
      nomeFantasia: c.nomeFantasia,
      cep: c.cep,
      numero: c.numero,
      cidade: c.cidade,
      estado: c.estado,
    });
  }

  return NextResponse.json({
    ok: true,
    criados,
    atualizados,
    pulados,
    contatosCriados,
    comEndereco: resultado.stats.comEndereco,
    postos: resultado.stats.postos,
  });
}
