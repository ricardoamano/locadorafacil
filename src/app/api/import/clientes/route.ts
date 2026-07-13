import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { montarImportacaoClientes } from "@/lib/import-bubble";

// Importa clientes + contatos do CSV do Bubble para a empresa atual.
// POST { clientesCsv, contatosCsv, confirmar? }:
//  - sem confirmar → devolve a prévia (estatísticas + amostra), nada é gravado
//  - confirmar: true → grava os clientes (Contact) e contatos (SubContact)

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
  if (!clientesCsv.trim())
    return NextResponse.json({ error: "Envie o arquivo de clientes." }, { status: 400 });

  let resultado;
  try {
    resultado = montarImportacaoClientes(clientesCsv, contatosCsv);
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
        contatos: c.subcontatos.map((s) => s.nome),
      })),
    });
  }

  // Gravação — evita duplicar clientes já existentes (mesmo nome fantasia)
  const existentes = await prisma.contact.findMany({
    where: { companyId, type: "CLIENTE" },
    select: { nomeFantasia: true },
  });
  const jaTem = new Set(existentes.map((e) => e.nomeFantasia.trim().toLowerCase()));

  let criados = 0;
  let pulados = 0;
  let contatosCriados = 0;

  for (const c of resultado.clientes) {
    if (jaTem.has(c.nomeFantasia.trim().toLowerCase())) {
      pulados++;
      continue;
    }
    await prisma.contact.create({
      data: {
        type: "CLIENTE",
        nomeFantasia: c.nomeFantasia,
        razaoSocial: c.razaoSocial,
        cnpj: c.cnpj,
        rua: c.rua,
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
    jaTem.add(c.nomeFantasia.trim().toLowerCase());
  }

  return NextResponse.json({
    ok: true,
    criados,
    pulados,
    contatosCriados,
    postos: resultado.stats.postos,
  });
}
