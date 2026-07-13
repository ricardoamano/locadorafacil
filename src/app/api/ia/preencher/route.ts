import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { clienteIa, extrairJson, MODELO_AUTOFILL, MODELO_PROPOSTA } from "@/lib/ia";

// Autopreenchimento com IA: itens, locais e clientes

// A IA (com busca na web e download de fotos) leva dezenas de segundos;
// sem isso a função é encerrada pela Vercel antes de terminar.
export const maxDuration = 300;

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

// Busca na web mídia do produto (best-effort): fotos e 1 link de vídeo.
// Fotos: tenta baixar e gravar no banco (URL interna, estável); o que não
// baixar, devolve a URL direta para o navegador tentar exibir. Vídeo: só a URL
// (YouTube) — confiável, pois não depende de download.
async function buscarMidiaDoModelo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ia: any,
  companyId: string,
  info: { nome: string; marca: string; modelo: string }
): Promise<{ fotos: string[]; videoUrl: string | null }> {
  const consulta = [info.marca, info.modelo || info.nome].filter(Boolean).join(" ");
  if (!consulta.trim()) return { fotos: [], videoUrl: null };

  const resposta = await ia.messages.create(
    {
      model: MODELO_PROPOSTA,
      max_tokens: 1500,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }],
      messages: [
        {
          role: "user",
          content: `Pesquise na web o produto "${consulta}" (equipamento de eventos) e responda APENAS com um JSON:
{
  "imagens": ["até 3 URLs DIRETAS de imagens .jpg/.jpeg/.png/.webp, preferindo fotos oficiais do fabricante em fundo branco"],
  "video": "1 URL de vídeo do YouTube demonstrando/reviewando este modelo (ou null se não achar um confiável)"
}`,
        },
      ],
    },
    { timeout: 25_000, maxRetries: 0 }
  );

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

  const fotos: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0 (LocadoraFacil)" },
      });
      const mime = res.headers.get("content-type")?.split(";")[0] || "";
      if (res.ok && mime.startsWith("image/")) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length >= 5_000 && buffer.length <= 3 * 1024 * 1024) {
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
          fotos.push(`/api/arquivos/${arquivo.id}`);
        }
      }
    } catch {
      // não deu para baixar — ignora (fotos vêm do Google/colar, mais confiável)
    }
  }

  const video =
    typeof json?.video === "string" && /^https?:\/\/[^ ]*(youtube\.com|youtu\.be)/i.test(json.video)
      ? json.video
      : null;

  return { fotos, videoUrl: video };
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
    // 1º: banco interno de preços de mercado (PDFs de parceiros/concorrentes)
    const termos = [String(body.modelo || ""), String(body.marca || ""), String(body.texto || "")]
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9à-ú]+/)
      .filter((t) => t.length >= 3);
    if (termos.length > 0) {
      const registros = await prisma.precoMercado.findMany({
        where: {
          companyId,
          OR: termos.map((t) => ({
            OR: [
              { equipamento: { contains: t, mode: "insensitive" as const } },
              { modelo: { contains: t, mode: "insensitive" as const } },
            ],
          })),
        },
        take: 60,
        orderBy: { createdAt: "desc" },
      });
      // relevância: registros que batem com mais termos primeiro
      const pontuados = registros
        .map((r) => {
          const alvo = `${r.equipamento} ${r.modelo || ""} ${r.marca || ""}`.toLowerCase();
          const pontos = termos.filter((t) => alvo.includes(t)).length;
          return { r, pontos };
        })
        .filter((x) => x.pontos >= Math.min(2, termos.length))
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 15)
        .map((x) => x.r);

      if (pontuados.length > 0) {
        const media = (vals: (number | null)[]) => {
          const nums = vals.filter((v): v is number => v != null && v > 0);
          return nums.length > 0
            ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
            : null;
        };
        const diarias = pontuados.map((r) => r.diaria).filter((v): v is number => v != null && v > 0);
        return NextResponse.json({
          dados: {
            origem: "banco",
            diaria: media(pontuados.map((r) => r.diaria)),
            diariaMin: diarias.length > 0 ? Math.min(...diarias) : null,
            diariaMax: diarias.length > 0 ? Math.max(...diarias) : null,
            semana: media(pontuados.map((r) => r.semana)),
            quinzena: media(pontuados.map((r) => r.quinzena)),
            mes: media(pontuados.map((r) => r.mes)),
            reposicao: media(pontuados.map((r) => r.reposicao)),
            fontes: [...new Set(pontuados.map((r) => r.fonte).filter(Boolean))],
            observacao: `Baseado em ${pontuados.length} registro(s) do seu Banco de Preços de Mercado.`,
          },
        });
      }
    }

    try {
      const consulta = [String(body.marca || ""), String(body.modelo || "") || String(body.texto || "")]
        .filter(Boolean)
        .join(" ");
      // Busca na web com timeout: se demorar demais (a web search pode levar
      // minutos), cai na estimativa da IA sem web — o botão responde sempre.
      let textoR = "";
      try {
        const resposta = await iaP.messages.create(
          {
            model: MODELO_PROPOSTA,
            max_tokens: 2000,
            tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
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
          },
          { timeout: 40_000, maxRetries: 0 }
        );
        textoR = resposta.content
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((b: any) => b.type === "text")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((b: any) => b.text)
          .join("");
      } catch {
        // busca web demorou demais ou falhou — segue para a estimativa sem web
      }
      const dadosP = extrairJson(textoR);
      const vazio =
        !dadosP ||
        [dadosP.diaria, dadosP.semana, dadosP.quinzena, dadosP.mes, dadosP.reposicao].every(
          (v) => v == null
        );
      if (!vazio) return NextResponse.json({ dados: { origem: "web", ...dadosP } });

      // 3º: estimativa da IA (sem web) com aviso explícito
      const est = await iaP.messages.create({
        model: MODELO_PROPOSTA,
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `Estime valores TÍPICOS de mercado no Brasil para a locação do equipamento de eventos: "${consulta}" (${String(
              body.texto || ""
            )}). Use seu conhecimento geral (regra comum: diária ≈ 5% a 10% do valor do equipamento novo). Responda APENAS com JSON: {"diaria": n, "semana": n, "quinzena": n, "mes": n, "reposicao": n}`,
          },
        ],
      });
      const textoE = est.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b.type === "text")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => b.text)
        .join("");
      const dadosE = extrairJson(textoE) || {};
      return NextResponse.json({
        dados: {
          origem: "estimativa",
          ...dadosE,
          aviso:
            "Não tivemos informações suficientes para criar nossas sugestões — os valores abaixo são uma ESTIMATIVA da IA. Alimente o Banco de Preços de Mercado com orçamentos de parceiros e concorrentes para sugestões reais.",
          observacao: "Estimativa sem fontes de mercado.",
        },
      });
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
    // Itens usam o Sonnet (specs técnicas mais precisas); local/cliente ficam no Haiku
    const resposta = await ia.messages.create({
      model: tipo === "item" ? MODELO_PROPOSTA : MODELO_AUTOFILL,
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

    // Itens: tenta achar fotos + link de vídeo do modelo na web (best-effort).
    // Timeout curto e sem travar — se não achar fotos, segue e avisa.
    if (tipo === "item") {
      try {
        const midia = await buscarMidiaDoModelo(ia, companyId, {
          nome: String(body.texto || ""),
          marca: String(dados.marca || body.marca || ""),
          modelo: String(dados.modelo || body.modelo || ""),
        });
        dados.fotos = midia.fotos;
        if (midia.videoUrl) dados.videoUrl = midia.videoUrl;
        if (!midia.fotos.length) {
          dados.fotosAviso =
            "Não encontrei fotos do modelo na web — adicione manualmente na galeria.";
        }
      } catch {
        dados.fotos = [];
        dados.fotosAviso = "Busca de mídia indisponível agora — adicione manualmente.";
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
