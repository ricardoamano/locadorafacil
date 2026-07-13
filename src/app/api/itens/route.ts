import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calcularPrecos } from "@/lib/precos";
import { slugify } from "@/lib/utils";
import { proximoCodigoItem, sincronizarUnidades } from "@/lib/unidades";
import { vincularAcessorios } from "@/lib/acessorios";

type SessionUser = { companyId?: string };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const natureza = searchParams.get("natureza") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    companyId,
    ...(natureza ? { natureza } : {}),
    ...(search
      ? {
          OR: [
            { nome: { contains: search, mode: "insensitive" as const } },
            { apelidos: { contains: search, mode: "insensitive" as const } },
            { codigo: { contains: search, mode: "insensitive" as const } },
            // QR de unidade (ex.: 0012-03) encontra o item dono da unidade
            { unidades: { some: { codigo: { equals: search, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [itens, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        categoria: { select: { id: true, nome: true } },
        subCategoria: { select: { id: true, nome: true } },
        marca: { select: { id: true, nome: true } },
        acessoriosAvulsos: { select: { id: true, nome: true, quantidade: true } },
        // Disponibilidade em tempo real calculada pelas unidades serializadas
        unidades: { select: { status: true } },
      },
      orderBy: { nome: "asc" },
      skip,
      take: limit,
    }),
    prisma.item.count({ where }),
  ]);

  return NextResponse.json({ itens, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const body = await req.json();
  const { id: _id, categoria: _c, marca: _m, ...data } = body;

  // Código/SKU: informado (não pode duplicar) ou gerado sequencialmente (0001, 0002...)
  let codigoFinal = data.codigo?.trim() || "";
  if (codigoFinal) {
    const codigoExiste = await prisma.item.findFirst({
      where: { companyId, codigo: codigoFinal },
      select: { id: true },
    });
    if (codigoExiste)
      return NextResponse.json(
        { error: `Já existe um item com o código "${codigoFinal}".` },
        { status: 400 }
      );
  } else {
    codigoFinal = await proximoCodigoItem(companyId);
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
        where: { companyId, slug: slugFinal  },
        select: { id: true },
      })
    ) {
      n += 1;
      slugFinal = `${base}-${n}`;
    }
  }

  const item = await prisma.item.create({
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
      subCategoriaId: data.subCategoriaId || null,
      publicado: !!data.publicado,
      slug: slugFinal,
      descricaoComercial: data.descricaoComercial || null,
      especificacoesPublicas: data.especificacoesPublicas || null,
      fotoCapaUrl: data.fotoCapaUrl || null,
      videoUrl: data.videoUrl || null,
      mostrarCodigo: !!data.mostrarCodigo,
      marcaId: data.marcaId || null,
      modelo: data.modelo?.trim() || null,
      fotos: Array.isArray(data.fotos) ? JSON.stringify(data.fotos) : "[]",
      companyId,
    },
  });

  // Cria as unidades físicas serializadas (codigo-01, codigo-02, ...)
  await sincronizarUnidades(item.id);

  // Acessórios avulsos (checklist de separação, sem código/QR)
  if (Array.isArray(body.acessoriosAvulsos)) {
    const avulsos = body.acessoriosAvulsos
      .map((a: { nome?: string; quantidade?: number | string }) => ({
        nome: String(a.nome || "").trim(),
        quantidade: Math.max(1, Number(a.quantidade) || 1),
      }))
      .filter((a: { nome: string }) => a.nome);
    if (avulsos.length > 0) {
      await prisma.itemAcessorioAvulso.createMany({
        data: avulsos.map((a: { nome: string; quantidade: number }) => ({ ...a, itemId: item.id })),
      });
    }
  }

  // Acessórios sugeridos/selecionados viram itens vinculados
  let acessoriosInfo = null;
  if (Array.isArray(body.acessorios) && body.acessorios.length > 0) {
    acessoriosInfo = await vincularAcessorios(companyId, item.id, body.acessorios);
  }

  return NextResponse.json({ ...item, acessoriosInfo }, { status: 201 });
}
