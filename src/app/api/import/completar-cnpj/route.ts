import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Completa o endereço dos clientes a partir do CNPJ (dados públicos da Receita
// via BrasilAPI): preenche CEP, número, complemento, bairro, cidade e UF —
// apenas os campos que estiverem em branco. Processa em lotes para respeitar
// o tempo de execução e o limite da API; o front chama em loop até terminar.

export const maxDuration = 60;

type SessionUser = { companyId?: string };

function soDigitos(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

async function buscarCnpj(cnpj: string) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 429) return { rateLimited: true as const };
    if (!res.ok) return null;
    return (await res.json()) as {
      cep?: string;
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      municipio?: string;
      uf?: string;
    };
  } catch {
    return null;
  }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const limite = Math.min(30, Math.max(1, Number(body.limite) || 20));

  // Clientes com CNPJ e endereço incompleto (falta cidade ou estado)
  const candidatos = await prisma.contact.findMany({
    where: {
      companyId,
      type: "CLIENTE",
      cnpj: { not: null },
      OR: [{ cidade: null }, { cidade: "" }, { estado: null }, { estado: "" }],
    },
    select: {
      id: true,
      cnpj: true,
      cep: true,
      rua: true,
      numero: true,
      complemento: true,
      bairro: true,
      cidade: true,
      estado: true,
    },
  });

  const elegiveis = candidatos.filter((c) => soDigitos(c.cnpj).length === 14);
  const lote = elegiveis.slice(0, limite);

  let preenchidos = 0;
  let semDados = 0;
  let rateLimited = false;

  for (const c of lote) {
    const dados = await buscarCnpj(soDigitos(c.cnpj));
    if (dados && "rateLimited" in dados) {
      rateLimited = true;
      break;
    }
    if (!dados) {
      semDados++;
      await espera(150);
      continue;
    }
    // Só preenche o que está em branco
    const patch: Record<string, string> = {};
    const vazio = (v: string | null) => !v || !v.trim();
    if (vazio(c.cep) && dados.cep) patch.cep = dados.cep.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2");
    if (vazio(c.rua) && dados.logradouro) patch.rua = dados.logradouro;
    if (vazio(c.numero) && dados.numero) patch.numero = String(dados.numero);
    if (vazio(c.complemento) && dados.complemento) patch.complemento = dados.complemento;
    if (vazio(c.bairro) && dados.bairro) patch.bairro = dados.bairro;
    if (vazio(c.cidade) && dados.municipio) patch.cidade = dados.municipio;
    if (vazio(c.estado) && dados.uf) patch.estado = dados.uf.toUpperCase();

    if (Object.keys(patch).length > 0) {
      await prisma.contact.update({ where: { id: c.id }, data: patch });
      preenchidos++;
    } else {
      semDados++;
    }
    await espera(200); // respeita o limite da BrasilAPI
  }

  const restantes = elegiveis.length - lote.length + (rateLimited ? lote.length - (preenchidos + semDados) : 0);

  return NextResponse.json({
    ok: true,
    processados: lote.length,
    preenchidos,
    semDados,
    rateLimited,
    restantes: Math.max(0, restantes),
    totalElegiveis: elegiveis.length,
  });
}
