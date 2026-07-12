"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Bot, Send, RotateCcw } from "lucide-react";

// Configuração do assistente de WhatsApp da empresa (nome, credenciais e textos)

const VARIAVEIS: { chave: string; descricao: string }[] = [
  { chave: "{assistente}", descricao: "nome do assistente" },
  { chave: "{empresa}", descricao: "nome da empresa" },
  { chave: "{nome}", descricao: "nome do membro" },
  { chave: "{os}", descricao: "número da OS" },
  { chave: "{evento}", descricao: "nome do evento" },
  { chave: "{periodo}", descricao: "período do evento" },
  { chave: "{montagem}", descricao: "data/hora da montagem" },
  { chave: "{desmontagem}", descricao: "data/hora da desmontagem" },
  { chave: "{entrada}", descricao: "horário de entrada do membro" },
  { chave: "{funcao}", descricao: "função na escala" },
  { chave: "{local}", descricao: "nome e endereço do local" },
  { chave: "{link_maps}", descricao: "link Google Maps" },
  { chave: "{link_waze}", descricao: "link Waze" },
  { chave: "{link_os}", descricao: "link público da OS" },
  { chave: "{produtores}", descricao: "produtores/contatos do evento (com link de WhatsApp)" },
  { chave: "{observacoes}", descricao: "observações da OS" },
];

const TIPOS: { key: "ESCALA" | "ALTERACAO" | "LEMBRETE"; label: string; hint: string }[] = [
  { key: "ESCALA", label: "📋 Escala", hint: "enviada quando o membro é escalado para a OS" },
  { key: "ALTERACAO", label: "⚠️ Alteração", hint: "enviada quando a OS muda" },
  { key: "LEMBRETE", label: "🔔 Lembrete", hint: "enviada automaticamente na véspera do evento" },
];

export default function ConfigWhatsappPage() {
  const { toast } = useToast();
  const [assistente, setAssistente] = useState("");
  const [numero, setNumero] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [token, setToken] = useState("");
  const [tokenConfigurado, setTokenConfigurado] = useState(false);
  const [configurado, setConfigurado] = useState(false);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [padrao, setPadrao] = useState<Record<string, string>>({});
  const [aba, setAba] = useState<"ESCALA" | "ALTERACAO" | "LEMBRETE">("ESCALA");
  const [testarPara, setTestarPara] = useState("");
  const [saving, setSaving] = useState(false);
  const [semAcesso, setSemAcesso] = useState(false);

  useEffect(() => {
    fetch("/api/empresa/whatsapp")
      .then((r) => {
        if (r.status === 401) {
          setSemAcesso(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (!d) return;
        setAssistente(d.assistente || "");
        setNumero(d.numero || "");
        setPhoneId(d.phoneId || "");
        setTokenConfigurado(d.tokenConfigurado);
        setConfigurado(d.configurado);
        setTemplates(d.templates || {});
        setPadrao(d.templatesPadrao || {});
      })
      .catch(() => {});
  }, []);

  async function salvar(comTeste: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/empresa/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistente,
          numero,
          phoneId,
          token: token || undefined,
          templates,
          testarPara: comTeste ? testarPara : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(
        comTeste ? "Configuração salva e mensagem de teste enviada! ✅" : "Configuração salva!",
        "success"
      );
      setToken("");
      const st = await fetch("/api/empresa/whatsapp").then((r) => r.json());
      setTokenConfigurado(st.tokenConfigurado);
      setConfigurado(st.configurado);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (semAcesso) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-slate-500">
          Apenas administradores podem configurar o assistente de WhatsApp.
        </p>
      </div>
    );
  }

  const nomeExibicao = assistente.trim() || "Assistente";

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <Bot className="h-5 w-5 text-emerald-700" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            {nomeExibicao} — WhatsApp da empresa
          </h1>
          <p className="text-sm text-slate-500">
            O assistente que envia OS, alterações e lembretes à equipe escalada.
          </p>
        </div>
      </div>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          configurado
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        {configurado
          ? `✅ Envio automático ativo: ${nomeExibicao} manda as mensagens direto no WhatsApp da equipe, incluindo os lembretes diários automáticos.`
          : `⚠️ Sem credenciais, ${nomeExibicao} funciona em modo manual: prepara as mensagens e abre o WhatsApp para você enviar com um clique. Configure abaixo para ativar o envio 100% automático.`}
      </div>

      {/* Identidade + credenciais */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nome do assistente"
            value={assistente}
            onChange={(e) => setAssistente(e.target.value)}
            placeholder="Ex: NESTOR"
          />
          <Input
            label="Número do WhatsApp (exibição)"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="+55 11 99999-9999"
          />
        </div>
        <Input
          label="Phone Number ID (WhatsApp Business Cloud API)"
          value={phoneId}
          onChange={(e) => setPhoneId(e.target.value)}
          placeholder="Ex: 106540352242922"
        />
        <Input
          label={tokenConfigurado ? "Token de acesso (já configurado — preencha só para trocar)" : "Token de acesso permanente"}
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={tokenConfigurado ? "••••••••••••" : "EAAG..."}
        />

        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">Onde pegar essas credenciais:</p>
          <p>1. Acesse developers.facebook.com → seu app → WhatsApp → Configuração da API</p>
          <p>2. Copie o <strong>Phone Number ID</strong> do número do assistente</p>
          <p>3. Gere um <strong>token permanente</strong> em Configurações do app → Usuários do sistema</p>
          <p className="pt-1">Cada empresa usa o próprio número e o próprio nome — o sistema é multiempresa.</p>
        </div>
      </div>

      {/* Textos das mensagens */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Textos das mensagens</h2>
          <p className="text-xs text-slate-400">
            Edite livremente. Linhas cujas variáveis ficarem vazias (ex.: sem desmontagem) são
            removidas automaticamente da mensagem.
          </p>
        </div>

        <div className="flex gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.key}
              onClick={() => setAba(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                aba === t.key
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">{TIPOS.find((t) => t.key === aba)?.hint}</p>

        <Textarea
          value={templates[aba] || ""}
          onChange={(e) => setTemplates((p) => ({ ...p, [aba]: e.target.value }))}
          rows={14}
          className="font-mono text-xs"
        />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={() => setTemplates((p) => ({ ...p, [aba]: padrao[aba] || "" }))}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600"
          >
            <RotateCcw className="h-3 w-3" />
            Restaurar texto padrão
          </button>
        </div>

        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-medium text-slate-600">
            Variáveis disponíveis ({VARIAVEIS.length})
          </summary>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {VARIAVEIS.map((v) => (
              <p key={v.chave}>
                <code className="bg-slate-100 rounded px-1 py-0.5 text-[11px]">{v.chave}</code>{" "}
                {v.descricao}
              </p>
            ))}
          </div>
        </details>
      </div>

      {/* Salvar + teste */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <Input
              label="Enviar teste para (opcional)"
              value={testarPara}
              onChange={(e) => setTestarPara(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => salvar(true)}
            loading={saving}
            disabled={!testarPara}
          >
            <Send className="h-4 w-4" />
            Salvar e testar
          </Button>
          <Button onClick={() => salvar(false)} loading={saving}>
            Salvar
          </Button>
        </div>
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Teste enviado mas não chegou? Regras do WhatsApp (Meta):</p>
          <p>
            1. <strong>Janela de 24h:</strong> a API só entrega texto livre para quem falou com o
            número nas últimas 24h. Peça para a pessoa mandar um &quot;oi&quot; para o número do
            assistente e teste de novo — vale para os técnicos também.
          </p>
          <p>
            2. <strong>Número de teste da Meta:</strong> só entrega para telefones adicionados em
            &quot;Destinatários permitidos&quot; no painel do app.
          </p>
          <p>
            3. <strong>Token temporário</strong> expira em 24h — gere um token permanente
            (Usuários do sistema) para produção.
          </p>
        </div>
      </div>
    </div>
  );
}
