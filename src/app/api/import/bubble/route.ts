import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { bubbleConfigurado, lerMeta, lerPagina } from "@/lib/bubble-api";

// Conexão com a Data API do Bubble (só superadmin).
// GET  → estado da conexão + estrutura já descoberta
// POST { appUrl?, token?, acao: "salvar" | "descobrir" }
//   descobrir → lê tipos/campos + 3 registros de amostra de cada tipo e guarda
//   em Company.bubbleMeta (é o que o mapeamento da migração usa)

export const maxDuration = 120;

type SessionUser = { companyId?: string; role?: string };

async function getSuper() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (u.role !== "SUPERADMIN" || !u.companyId) return null;
  return { session, companyId: u.companyId };
}

export async function GET() {
  const ctx = await getSuper();
  if (!ctx) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const c = await prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { bubbleAppUrl: true, bubbleApiToken: true, bubbleMeta: true, ferramentasMigracao: true },
  });
  return NextResponse.json({
    appUrl: c?.bubbleAppUrl || "",
    tokenConfigurado: Boolean(c?.bubbleApiToken),
    configurado: bubbleConfigurado(c),
    meta: c?.bubbleMeta || null,
    ferramentasMigracao: c?.ferramentasMigracao !== false,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await getSuper();
  if (!ctx) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (body.appUrl !== undefined) data.bubbleAppUrl = String(body.appUrl).trim() || null;
  if (body.token === "REMOVER") data.bubbleApiToken = null;
  else if (body.token?.trim()) data.bubbleApiToken = String(body.token).trim();
  // Interruptor único dos botões de importação/migração em todo o sistema
  if (typeof body.ferramentasMigracao === "boolean") data.ferramentasMigracao = body.ferramentasMigracao;
  if (Object.keys(data).length > 0)
    await prisma.company.update({ where: { id: ctx.companyId }, data });

  if (body.acao !== "descobrir") return NextResponse.json({ success: true });

  const c = await prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { bubbleAppUrl: true, bubbleApiToken: true },
  });
  if (!bubbleConfigurado(c))
    return NextResponse.json({ error: "Informe a URL do app e a Private key." }, { status: 400 });

  try {
    const tipos = await lerMeta(c!);
    const meta: Record<string, { campos: unknown[]; total: number; amostra: unknown[] }> = {};
    for (const [tipo, campos] of Object.entries(tipos)) {
      try {
        const p = await lerPagina(c!, tipo, 0, 3);
        meta[tipo] = { campos, total: p.count + p.remaining, amostra: p.results };
      } catch (e) {
        meta[tipo] = {
          campos,
          total: -1,
          amostra: [{ erro: e instanceof Error ? e.message : "falha ao ler" }],
        };
      }
    }
    await prisma.company.update({
      where: { id: ctx.companyId },
      // JSON puro para o tipo Json do Prisma
      data: { bubbleMeta: JSON.parse(JSON.stringify({ lidoEm: new Date().toISOString(), tipos: meta })) },
    });
    await auditar(ctx.session.user as never, {
      tipo: "ALTERACAO",
      modulo: "configuracoes",
      acao: `Leu a estrutura do Bubble (${Object.keys(meta).length} tipos)`,
    });
    return NextResponse.json({
      success: true,
      tipos: Object.entries(meta).map(([nome, m]) => ({
        nome,
        total: m.total,
        campos: (m.campos as { id: string; type: string }[]).map((f) => `${f.id} (${f.type})`),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao conectar no Bubble" },
      { status: 502 }
    );
  }
}
