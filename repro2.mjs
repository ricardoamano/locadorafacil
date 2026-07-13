import Anthropic from "@anthropic-ai/sdk";
const ia = new Anthropic({ apiKey: process.env.TESTKEY });
const t = (ms) => (ms/1000).toFixed(1) + "s";

// Etapa 1: autofill do item (Haiku)
let t0 = Date.now();
try {
  const r1 = await ia.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: 'Equipamento: "Moving Head Beam 230W". Responda APENAS com JSON: {"marca": "...", "modelo": "..."}' }],
  });
  console.log("1. autofill haiku: OK em", t(Date.now()-t0));
} catch (e) { console.log("1. autofill haiku FALHOU em", t(Date.now()-t0), "-", e.status, e.message?.slice(0,200)); }

// Etapa 2: busca de fotos (Sonnet + web_search, max_uses 2)
t0 = Date.now();
try {
  const r2 = await ia.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }],
    messages: [{ role: "user", content: 'Encontre até 3 URLs DIRETAS de imagens (.jpg/.png/.webp) do produto "Chauvet Intimidator Beam 355 IRC" (equipamento de eventos). Responda APENAS com um JSON: {"imagens": ["url1","url2","url3"]}' }],
  });
  const txt = r2.content.filter(b=>b.type==="text").map(b=>b.text).join("");
  console.log("2. fotos web_search: OK em", t(Date.now()-t0), "— stop:", r2.stop_reason, "— texto:", txt.slice(0,120).replace(/\n/g," "));
} catch (e) { console.log("2. fotos web_search FALHOU em", t(Date.now()-t0), "-", e.status, e.message?.slice(0,300)); }

// Etapa 3: pesquisa de preços (Sonnet + web_search, max_uses 3)
t0 = Date.now();
try {
  const r3 = await ia.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    messages: [{ role: "user", content: 'Pesquise na web quanto locadoras de eventos NO BRASIL cobram pela LOCAÇÃO de: "Moving Head Beam 230W". Responda APENAS com JSON: {"diaria": n, "reposicao": n, "observacao": "..."}' }],
  });
  const txt = r3.content.filter(b=>b.type==="text").map(b=>b.text).join("");
  console.log("3. preços web_search: OK em", t(Date.now()-t0), "— stop:", r3.stop_reason, "— texto:", txt.slice(0,120).replace(/\n/g," "));
} catch (e) { console.log("3. preços web_search FALHOU em", t(Date.now()-t0), "-", e.status, e.message?.slice(0,300)); }
