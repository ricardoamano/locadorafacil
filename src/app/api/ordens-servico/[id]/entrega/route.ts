import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { resumoSeparacao, qtdCarregada } from "@/lib/separacao";

// Entrega no evento ("o que ficou") — lista dos itens separados com a
// quantidade que permaneceu com o cliente + termo assinado.

type SessionUser = { companyId?: string; name?: string | null; email?: string | null };

async function getSessao() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (!u.companyId) return null;
  return { companyId: u.companyId, usuario: u.name || u.email || "sistema" };
}

interface LinhaSnapshot {
  itemId: string;
  nome: string;
  codigo: string;
  separado: number;
  ficou: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const os = await prisma.ordemServico.findFirst({
    where: { id, companyId: sessao.companyId },
    select: { id: true },
  });
  if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

  const resumo = await resumoSeparacao(id);
  const houveConferencia = resumo.some((i) => i.saida > 0);

  const entrega = await prisma.osEntrega.findUnique({ where: { osId: id } });
  const salvos = new Map<string, number>();
  if (entrega && Array.isArray(entrega.itens)) {
    for (const l of entrega.itens as unknown as LinhaSnapshot[]) {
      if (l && l.itemId) salvos.set(l.itemId, l.ficou);
    }
  }

  // Só itens que embarcam (separado > 0) entram na lista de "o que ficou"
  const itens = resumo
    .map((i) => {
      const separado = qtdCarregada(i, houveConferencia);
      return {
        itemId: i.itemId,
        nome: i.nome,
        codigo: i.codigo,
        apelidos: i.apelidos,
        separado,
        // "ficou" salvo, senão assume que tudo voltou (0) até o usuário marcar
        ficou: salvos.has(i.itemId) ? Math.min(salvos.get(i.itemId)!, separado) : 0,
      };
    })
    .filter((i) => i.separado > 0);

  return NextResponse.json({
    itens,
    houveConferencia,
    observacoes: entrega?.observacoes || "",
    entrega: entrega
      ? {
          publicToken: entrega.publicToken,
          clienteNome: entrega.clienteNome,
          clienteDoc: entrega.clienteDoc,
          aceiteEm: entrega.aceiteEm,
          temAssinatura: Boolean(entrega.aceiteAssinatura),
        }
      : null,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const os = await prisma.ordemServico.findFirst({
    where: { id, companyId: sessao.companyId },
    select: { id: true },
  });
  if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

  const body = await req.json();
  const ficouPorItem = new Map<string, number>();
  if (Array.isArray(body.itens)) {
    for (const l of body.itens) {
      if (l && typeof l.itemId === "string")
        ficouPorItem.set(l.itemId, Math.max(0, Number(l.ficou) || 0));
    }
  }

  // Reconstrói o snapshot a partir da separação real (não confia só no cliente)
  const resumo = await resumoSeparacao(id);
  const houveConferencia = resumo.some((i) => i.saida > 0);
  const snapshot: LinhaSnapshot[] = resumo
    .map((i) => {
      const separado = qtdCarregada(i, houveConferencia);
      const ficou = Math.min(ficouPorItem.get(i.itemId) ?? 0, separado);
      return { itemId: i.itemId, nome: i.nome, codigo: i.codigo, separado, ficou };
    })
    .filter((l) => l.separado > 0);

  const observacoes = typeof body.observacoes === "string" ? body.observacoes : null;

  const entrega = await prisma.osEntrega.upsert({
    where: { osId: id },
    create: {
      osId: id,
      companyId: sessao.companyId,
      publicToken: randomUUID().replace(/-/g, ""),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      itens: snapshot as any,
      observacoes,
      registradoPor: sessao.usuario,
    },
    update: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      itens: snapshot as any,
      observacoes,
    },
  });

  return NextResponse.json({
    ok: true,
    publicToken: entrega.publicToken,
    ficaram: snapshot.filter((l) => l.ficou > 0).length,
  });
}
