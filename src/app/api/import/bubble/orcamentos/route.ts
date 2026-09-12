import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { bubbleConfigurado } from "@/lib/bubble-api";
import { carregarDadosBubble, montarPrevia, executarMigracao, completarCadastros } from "@/lib/bubble-migracao";

// Migração de orçamentos, OS e faturas do Bubble (só superadmin).
// POST { anoMinimo?, confirmar? } → sem confirmar: prévia (nada gravado);
// com confirmar: executa (idempotente — o que já veio não duplica).

export const maxDuration = 300;

type SessionUser = { companyId?: string; role?: string };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as SessionUser;
  if (u.role !== "SUPERADMIN" || !u.companyId)
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const anoMinimo = body.anoMinimo ? Number(body.anoMinimo) || null : null;

  const c = await prisma.company.findUnique({
    where: { id: u.companyId },
    select: { bubbleAppUrl: true, bubbleApiToken: true },
  });
  if (!bubbleConfigurado(c))
    return NextResponse.json({ error: "Configure a conexão com o Bubble primeiro." }, { status: 400 });

  try {
    const dados = await carregarDadosBubble(c!);
    // Só completar cadastros (endereço/CNPJ/contatos de clientes e locais)
    if (body.acao === "cadastros") {
      const cad = await completarCadastros(u.companyId, dados);
      await auditar(session.user as never, {
        tipo: "ALTERACAO",
        modulo: "clientes",
        acao: `Completou cadastros pelo Bubble: ${cad.clientesAtualizados} clientes, ${cad.locaisAtualizados} locais, ${cad.contatosCriados} contatos`,
      });
      return NextResponse.json({ cadastros: cad });
    }
    if (!body.confirmar) {
      const previa = await montarPrevia(u.companyId, dados, { anoMinimo });
      return NextResponse.json({ previa });
    }
    const relatorio = await executarMigracao(u.companyId, dados, { anoMinimo });
    await auditar(session.user as never, {
      tipo: "ALTERACAO",
      modulo: "orcamentos",
      acao: `Migrou do Bubble: ${relatorio.orcamentosCriados} orçamentos, ${relatorio.ordensCriadas} OS, ${relatorio.faturasCriadas} faturas`,
    });
    return NextResponse.json({ relatorio });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha na migração" },
      { status: 502 }
    );
  }
}
