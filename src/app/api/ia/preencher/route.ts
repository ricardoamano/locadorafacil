import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { clienteIa, extrairJson, MODELO_AUTOFILL } from "@/lib/ia";

// Autopreenchimento com IA: itens, locais e clientes

type SessionUser = { companyId?: string };

async function getCompanyId() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as SessionUser).companyId ?? null;
}

const PROMPTS: Record<string, (texto: string, contexto: string) => string> = {
  item: (texto, contexto) => `Você preenche cadastros de equipamentos/serviços de uma locadora de tecnologia para eventos no Brasil.

${texto}
${contexto}

Se marca e modelo forem informados, baseie as especificações e o consumo NO MODELO REAL do fabricante (dados de catálogo). Se não conhecer o modelo exato, use valores típicos da categoria e seja conservador.

Responda APENAS com um JSON válido neste formato (sem texto antes ou depois):
{
  "marca": "marca/fabricante identificado no nome ou informado (ex: Chauvet, Shure), ou null",
  "modelo": "modelo específico do fabricante (ex: MAC Aura XB, SM58), ou null",
  "especificacoes": "especificações técnicas do modelo em tópicos separados por \\n (potência, dimensões, peso, conexões, ângulo/alcance, alimentação...)",
  "descricaoComercial": "descrição comercial curta e vendedora (máx 100 caracteres)",
  "especificacoesPublicas": "versão resumida das especificações para o catálogo público",
  "watts": consumo típico em watts do modelo (número, ou null se não se aplica),
  "apelidoComercial": "UM apelido comercial curto e memorável para o equipamento (como a equipe chamaria no dia a dia, ex: 'Moving Beam', 'Line Array P')",
  "apelidos": "sinônimos e apelidos de busca separados por vírgula",
  "valorReposicao": preço aproximado de compra de uma unidade NOVA no Brasil, em reais (número, ou null se não souber),
  "categoriaSugerida": "nome da categoria mais adequada da lista fornecida, ou null",
  "acessorios": ["lista de acessórios que normalmente acompanham este equipamento, ex: 'Cabo de energia PowerCon', 'Controle remoto', 'Case de transporte' — máximo 6"]
}`,
  local: (texto) => `Você preenche cadastros de locais de eventos no Brasil.

Local: "${texto}"

Se você conhecer este local de eventos, preencha com os dados reais; se não tiver certeza, deixe os campos em branco ("") em vez de inventar.
Responda APENAS com um JSON válido:
{
  "nome": "nome oficial do local",
  "cep": "CEP se souber, senão \\"\\"",
  "rua": "", "numero": "", "bairro": "", "cidade": "", "estado": "UF",
  "observacoes": "informações úteis para produção de eventos neste local (docas, acesso de carga, restrições de horário), ou \\"\\""
}`,
  cliente: (texto) => `Você preenche cadastros de empresas clientes no Brasil.

Empresa: "${texto}"

Se conhecer a empresa, preencha com dados reais; na dúvida, deixe em branco ("") em vez de inventar. NUNCA invente CNPJ.
Responda APENAS com um JSON válido:
{
  "nomeFantasia": "nome fantasia",
  "razaoSocial": "razão social provável ou \\"\\"",
  "cidade": "", "estado": "UF ou \\"\\"",
  "perfil": "1 frase sobre o que a empresa faz, ou \\"\\""
}`,
};

// Busca na web URLs de imagens do produto, baixa (máx 3, 3MB cada) e grava
// no banco como Arquivo — devolve URLs internas prontas para a galeria.
async function buscarFotosDoModelo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ia: any,
  companyId: string,
  info: { nome: string; marca: string; modelo: string }
): Promise<string[]> {
  const consulta = [info.marca, info.modelo || info.nome].filter(Boolean).join(" ");
  if (!consulta.trim()) return [];

  const resposta = await ia.messages.create({
    model: MODELO_AUTOFILL,
    max_tokens: 1500,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    messages: [
      {
        role: "user",
        content: `Encontre até 3 URLs DIRETAS de imagens (terminadas em .jpg, .jpeg, .png ou .webp, ou URLs de imagem de CDNs) do produto "${consulta}" (equipamento de eventos), preferindo fotos oficiais do fabricante em fundo branco. Responda APENAS com um JSON: {"imagens": ["url1", "url2", "url3"]}`,
      },
    ],
  });

  const texto = resposta.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any) => b.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b: any) => b.text)
    .join("");
  const json = extrairJson(texto);
  const urls: string[] = Array.isArray(json?.imagens)
    ? (json!.imagens as string[]).filter((u) => /^https?:\/\//i.test(u)).slice(0, 3)
    : [];

  const salvas: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0 (LocadoraFacil)" },
      });
      if (!res.ok) continue;
      const mime = res.headers.get("content-type")?.split(";")[0] || "";
      if (!mime.startsWith("image/")) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 5_000 || buffer.length > 3 * 1024 * 1024) continue;
      const arquivo = await prisma.arquivo.create({
        data: {
          nome: `ia_${consulta.slice(0, 40)}.${mime.split("/")[1] || "jpg"}`,
          mime,
          tamanho: buffer.length,
          dados: buffer,
          companyId,
        },
        select: { id: true },
      });
      salvas.push(`/api/arquivos/${arquivo.id}`);
    } catch {
      // imagem inacessível — segue para a próxima
    }
  }
  return salvas;
}

export async function POST(req: NextRequest) {
  const companyId = await getCompanyId();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const tipo = String(body.tipo || "");
  let texto = String(body.texto || "").trim();
  if (tipo === "item") {
    const marca = String(body.marca || "").trim();
    const modelo = String(body.modelo || "").trim();
    texto = `Equipamento/serviço: "${texto}"${marca ? `\nMarca: ${marca}` : ""}${
      modelo ? `\nModelo: ${modelo}` : ""
    }`;
  }
  if (tipo === "precos") {
    if (texto.length < 3)
      return NextResponse.json({ error: "Digite o nome primeiro" }, { status: 400 });
    const iaP = await clienteIa(companyId);
    if (!iaP)
      return NextResponse.json(
        { error: "IA não configurada — peça ao administrador para configurar em Configurações → Inteligência Artificial." },
        { status: 400 }
      );
    try {
      const consulta = [String(body.marca || ""), String(body.modelo || "") || String(body.texto || "")]
        .filter(Boolean)
        .join(" ");
      const resposta = await iaP.messages.create({
        model: MODELO_AUTOFILL,
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [
          {
            role: "user",
            content: `Pesquise na web quanto locadoras de equipamentos para eventos NO BRASIL estão cobrando pela LOCAÇÃO de: "${consulta}" (${String(
              body.texto || ""
            )}).

Procure preços reais de diária de locação em sites de locadoras brasileiras concorrentes. Pesquise também o preço de COMPRA de uma unidade nova no Brasil (valor de reposição).

Responda APENAS com um JSON válido:
{
  "diaria": valor médio de mercado da diária de locação em reais (número, ou null),
  "diariaMin": menor valor encontrado (número ou null),
  "diariaMax": maior valor encontrado (número ou null),
  "semana": valor semanal praticado, ou estimativa típica de mercado (≈3x a diária) (número ou null),
  "quinzena": valor quinzenal praticado ou estimativa (≈4,5x a diária) (número ou null),
  "mes": valor mensal praticado ou estimativa (≈6x a diária) (número ou null),
  "reposicao": preço de compra de uma unidade nova no Brasil em reais (número ou null),
  "observacao": "1-2 frases: em quais fontes/faixas se baseou e o quão confiável é a estimativa"
}`,
          },
        ],
      });
      const textoR = resposta.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b.type === "text")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => b.text)
        .join("");
      const dadosP = extrairJson(textoR);
      if (!dadosP)
        return NextResponse.json(
          { error: "A IA não encontrou preços — tente novamente." },
          { status: 502 }
        );
      return NextResponse.json({ dados: dadosP });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro na IA";
      return NextResponse.json({ error: `Erro na pesquisa de preços: ${msg}` }, { status: 502 });
    }
  }

  if (!PROMPTS[tipo]) return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  if (texto.length < 3)
    return NextResponse.json({ error: "Digite o nome primeiro" }, { status: 400 });

  const ia = await clienteIa(companyId);
  if (!ia)
    return NextResponse.json(
      { error: "IA não configurada — peça ao administrador para configurar em Configurações → Inteligência Artificial." },
      { status: 400 }
    );

  // Contexto para itens: categorias existentes ajudam na sugestão
  let contexto = "";
  if (tipo === "item") {
    const categorias = await prisma.categoria.findMany({
      where: { companyId },
      select: { nome: true },
      take: 50,
    });
    if (categorias.length > 0) {
      contexto = `Categorias existentes: ${categorias.map((c) => c.nome).join(", ")}`;
    }
  }

  try {
    const resposta = await ia.messages.create({
      model: MODELO_AUTOFILL,
      max_tokens: 2000,
      messages: [{ role: "user", content: PROMPTS[tipo](texto, contexto) }],
    });
    const textoResposta = resposta.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const dados = extrairJson(textoResposta);
    if (!dados)
      return NextResponse.json({ error: "A IA não retornou dados válidos — tente de novo." }, { status: 502 });

    // Itens: busca fotos reais do modelo na web e grava no banco
    if (tipo === "item") {
      try {
        dados.fotos = await buscarFotosDoModelo(ia, companyId, {
          nome: String(body.texto || ""),
          marca: String(dados.marca || body.marca || ""),
          modelo: String(dados.modelo || body.modelo || ""),
        });
      } catch {
        dados.fotos = [];
      }
    }

    return NextResponse.json({ dados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na IA";
    const status = msg.includes("authentication") || msg.includes("401") ? 400 : 502;
    return NextResponse.json(
      {
        error:
          status === 400
            ? "Chave de API inválida — confira em Configurações → Inteligência Artificial."
            : `Erro ao consultar a IA: ${msg}`,
      },
      { status }
    );
  }
}
