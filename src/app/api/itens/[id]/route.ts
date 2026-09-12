import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vincularAcessorios } from "@/lib/acessorios";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
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
      // Editar/salvar pelo formulário completo = cadastro revisado
      revisarCadastro: false,
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
      subCategoriaId: data.subCategoriaId || null,
      publicado: !!data.publicado,
      slug: slugFinal,
      descricaoComercial: data.descricaoComercial || null,
      especificacoesPublicas: data.especificacoes || null,
      observacaoInterna: data.observacaoInterna || null,
      fotoCapaUrl: data.fotoCapaUrl || null,
      videoUrl: data.videoUrl || null,
      mostrarCodigo: !!data.mostrarCodigo,
    },
  });

  // Mantém unidades serializadas em dia com código e quantidade
  if (codigoFinal !== existing.codigo) await renomearCodigosUnidades(id, codigoFinal);
  await sincronizarUnidades(id);

  // Acessórios avulsos: substitui a lista (checklist de separação)
  if (Array.isArray(body.acessoriosAvulsos)) {
    const avulsos = body.acessoriosAvulsos
      .map((a: { nome?: string; quantidade?: number | string }) => ({
        nome: String(a.nome || "").trim(),
        quantidade: Math.max(1, Number(a.quantidade) || 1),
      }))
      .filter((a: { nome: string }) => a.nome);
    await prisma.itemAcessorioAvulso.deleteMany({ where: { itemId: id } });
    if (avulsos.length > 0) {
      await prisma.itemAcessorioAvulso.createMany({
        data: avulsos.map((a: { nome: string; quantidade: number }) => ({ ...a, itemId: id })),
      });
    }
  }

  let acessoriosInfo = null;
  if (Array.isArray(body.acessorios) && body.acessorios.length > 0) {
    acessoriosInfo = await vincularAcessorios(companyId, item.id, body.acessorios);
  }

  // "Alterar em todos": renomeia outros itens com o mesmo nome antigo e as
  // descrições copiadas em faturas não emitidas / orçamentos pendentes
  let renomeados: { itens: number; faturas: number; orcamentos: number } | null = null;
  const nomeNovo = String(data.nome || "").trim();
  if (data.renomearTodos && nomeNovo && nomeNovo !== existing.nome) {
    const [ri, rf, ro] = await Promise.all([
      prisma.item.updateMany({
        where: { companyId, NOT: { id }, nome: { equals: existing.nome, mode: "insensitive" } },
        data: { nome: nomeNovo },
      }),
      prisma.faturaItem.updateMany({
        where: {
          descricao: { equals: existing.nome, mode: "insensitive" },
          fatura: { companyId, snapshot: { equals: Prisma.DbNull } },
        },
        data: { descricao: nomeNovo },
      }),
      prisma.salaItem.updateMany({
        where: {
          descricaoComercial: { equals: existing.nome, mode: "insensitive" },
          sala: { orcamento: { companyId, status: "PENDENTE" } },
        },
        data: { descricaoComercial: nomeNovo },
      }),
    ]);
    renomeados = { itens: ri.count, faturas: rf.count, orcamentos: ro.count };
  }

  return NextResponse.json({ ...item, acessoriosInfo, renomeados });
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

  // Item com histórico comercial não pode ser excluído (apagaria linhas de
  // orçamentos/OS/faturas já emitidos) — orienta o usuário em vez de dar 500.
  const [emOrcamentos, emOsExtras, emConferencias, emFaturas] = await Promise.all([
    prisma.salaItem.count({ where: { itemId: id } }),
    prisma.osItemExtra.count({ where: { itemId: id } }),
    prisma.osConferencia.count({ where: { itemId: id } }),
    prisma.faturaItem.count({ where: { itemId: id } }),
  ]);
  const usos: string[] = [];
  if (emOrcamentos) usos.push(`${emOrcamentos} orçamento(s)`);
  if (emOsExtras || emConferencias) usos.push("ordens de serviço");
  if (emFaturas) usos.push(`${emFaturas} fatura(s)`);
  if (usos.length > 0)
    return NextResponse.json(
      {
        error: `Este item está em ${usos.join(", ")} e não pode ser excluído — o histórico seria perdido. Se ele saiu de linha, apenas pare de usá-lo em novos orçamentos.`,
      },
      { status: 400 }
    );

  // Vínculo "é acessório de outro item" é só uma sugestão — remove junto.
  await prisma.itemAcessorio.deleteMany({ where: { acessorioId: id } });
  await prisma.item.delete({ where: { id } });
  const sessao = await auth();
  await auditar(sessao?.user as never, {
    tipo: "ALTERACAO",
    modulo: "ativos",
    acao: "Excluiu item",
    detalhe: `${existing.codigo || ""} ${existing.nome}`.trim(),
  });
  return NextResponse.json({ success: true });
}
