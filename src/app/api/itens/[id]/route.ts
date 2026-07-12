import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { vincularAcessorios } from "@/lib/acessorios";
import { auth } from "@/lib/auth";
import { calcularPrecos } from "@/lib/precos";
import { slugify } from "@/lib/utils";
import {
  proximoCodigoItem,
  sincronizarUnidades,
  renomearCodigosUnidades,
} from "@/lib/unidades";

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { id: _id, categoria: _c, marca: _m, ...data } = body;

  const existing = await prisma.item.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Código/SKU: informado (não pode duplicar), mantém o atual ou gera sequencial
  let codigoFinal = data.codigo?.trim() || existing.codigo || "";
  if (!codigoFinal) codigoFinal = await proximoCodigoItem(companyId);
  if (codigoFinal !== existing.codigo) {
    const codigoExiste = await prisma.item.findFirst({
      where: { companyId, codigo: codigoFinal, NOT: { id } },
      select: { id: true },
    });
    if (codigoExiste)
      return NextResponse.json(
        { error: `Já existe um item com o código "${codigoFinal}".` },
        { status: 400 }
      );
  }

  const diaria = Number(data.valorAluguel) || 0;
  const precoManual = !!data.precoManual;
  const empresa = await prisma.company.findUnique({ where: { id: companyId } });
  const calc = calcularPrecos(diaria, {
    diasSemana: empresa?.diasSemana ?? 7,
    diasQuinzena: empresa?.diasQuinzena ?? 15,
    diasMes: empresa?.diasMes ?? 30,
    descontoSemana: empresa?.descontoSemana ?? 0,
    descontoQuinzena: empresa?.descontoQuinzena ?? 0,
    descontoMes: empresa?.descontoMes ?? 0,
  });

  // Slug público: gera do nome quando publicado; garante unicidade na empresa
  let slugFinal: string | null = data.slug ? slugify(String(data.slug)) : null;
  if (!slugFinal && data.publicado) slugFinal = slugify(String(data.nome || ""));
  if (slugFinal) {
    const base = slugFinal;
    let n = 1;
    while (
      await prisma.item.findFirst({
        where: { companyId, slug: slugFinal, NOT: { id }  },
        select: { id: true },
      })
    ) {
      n += 1;
      slugFinal = `${base}-${n}`;
    }
  }

  const item = await prisma.item.update({
    where: { id },
    data: {
      codigo: codigoFinal,
      nome: data.nome,
      natureza: data.natureza === "SERVICO" ? "SERVICO" : "EQUIPAMENTO",
      cobranca:
        data.natureza === "SERVICO"
          ? ["FIXO", "HORA", "DIARIA"].includes(data.cobranca)
            ? data.cobranca
            : "FIXO"
          : null,
      apelidos: data.apelidos || null,
      valorAluguel: diaria,
      precoManual,
      // kVA = Watts ÷ (1000 × FP 0,8) — cálculo automático
      marcaId: data.marcaId || null,
      modelo: data.modelo?.trim() || null,
      ...(Array.isArray(data.fotos) ? { fotos: JSON.stringify(data.fotos) } : {}),
      watts: data.watts != null && data.watts !== "" ? Number(data.watts) : null,
      kva:
        data.watts != null && data.watts !== "" && Number(data.watts) > 0
          ? Math.round((Number(data.watts) / 800) * 1000) / 1000
          : null,
      valorSemana: precoManual && data.valorSemana != null ? Number(data.valorSemana) : calc.valorSemana,
      valorQuinzena: precoManual && data.valorQuinzena != null ? Number(data.valorQuinzena) : calc.valorQuinzena,
      valorMes: precoManual && data.valorMes != null ? Number(data.valorMes) : calc.valorMes,
      tipo: data.tipo || "PROPRIO",
      quantidade: Number(data.quantidade) || 0,
      especificacoes: data.especificacoes || null,
      emCatalogo: data.emCatalogo ?? true,
      categoriaId: data.categoriaId || null,
      publicado: !!data.publicado,
      slug: slugFinal,
      descricaoComercial: data.descricaoComercial || null,
      especificacoesPublicas: data.especificacoesPublicas || null,
      fotoCapaUrl: data.fotoCapaUrl || null,
      videoUrl: data.videoUrl || null,
      mostrarCodigo: !!data.mostrarCodigo,
    },
  });

  // Mantém unidades serializadas em dia com código e quantidade
  if (codigoFinal !== existing.codigo) await renomearCodigosUnidades(id, codigoFinal);
  await sincronizarUnidades(id);

  if (Array.isArray(body.acessorios) && body.acessorios.length > 0) {
    await vincularAcessorios(companyId, item.id, body.acessorios);
  }

  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.item.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.item.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
