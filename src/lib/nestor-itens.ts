import { analisarListaItens, importarItens } from "@/lib/itens-importar";

// Cadastro de itens pelo WhatsApp: "cadastra 4 TVs 55 Samsung, 250 a diária".
// Usa a mesma IA/lote da importação; item que já existe tem a quantidade
// atualizada em vez de duplicar.

const REGEX_CADASTRAR =
  /\b(cadastr\w*|adicion\w* (no |ao )?(estoque|invent[aá]rio)|nov[oa]s? ite(m|ns)|inclu\w* (no |ao )?(estoque|invent[aá]rio))\b/i;

export function ehPedidoDeCadastro(texto: string): boolean {
  return REGEX_CADASTRAR.test(texto);
}

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Executa o cadastro e devolve a resposta pronta para o WhatsApp. */
export async function tratarCadastroItens(
  companyId: string,
  texto: string,
  assistente: string,
  appUrl: string
): Promise<string> {
  const analise = await analisarListaItens(companyId, texto);
  if (analise.erro) return `🤖 *${assistente}*\n\n⚠️ ${analise.erro}`;
  if (analise.itens.length === 0)
    return `🤖 *${assistente}*\n\n🤔 Não identifiquei itens para cadastrar. Exemplo: _cadastra 4 TV 55 Samsung, 250 a diária_`;

  const r = await importarItens(companyId, analise.itens);

  const linhas: string[] = [`🤖 *${assistente}*`, ""];
  if (r.criados.length > 0) {
    linhas.push(`✅ *${r.criados.length} ${r.criados.length === 1 ? "item cadastrado" : "itens cadastrados"}:*`);
    for (const c of r.criados) linhas.push(`• [${c.codigo}] ${c.nome} — ${c.quantidade} un.`);
  }
  if (r.atualizados.length > 0) {
    linhas.push("", `🔄 *Já existiam — atualizei:*`);
    for (const a of r.atualizados)
      linhas.push(
        a.de !== a.para
          ? `• [${a.codigo}] ${a.nome}: ${a.de} → ${a.para} un.`
          : `• [${a.codigo}] ${a.nome} (sem mudança de quantidade)`
      );
  }
  const semPreco = analise.itens.filter((i) => i.valorAluguel === 0).length;
  if (semPreco > 0)
    linhas.push("", `⚠️ ${semPreco} ${semPreco === 1 ? "item sem diária" : "itens sem diária"} — defina o valor no sistema.`);
  linhas.push(
    "",
    `Entraram como *a revisar* — complete fotos/descrição quando puder: ${appUrl}/ativos`
  );
  const precos = analise.itens.filter((i) => i.valorAluguel > 0);
  if (precos.length > 0)
    linhas.push(`_Diárias registradas: ${precos.map((p) => `${p.nome} ${moeda(p.valorAluguel)}`).join(", ")}_`);
  return linhas.join("\n");
}
