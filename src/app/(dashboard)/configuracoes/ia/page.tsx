"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Sparkles, RotateCcw } from "lucide-react";

// Configuração de IA da empresa (chave da Claude API + skill de propostas)

export default function ConfigIaPage() {
  const { toast } = useToast();
  const [configurado, setConfigurado] = useState(false);
  const [chave, setChave] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [padrao, setPadrao] = useState("");
  const [saving, setSaving] = useState(false);
  const [semAcesso, setSemAcesso] = useState(false);

  useEffect(() => {
    fetch("/api/empresa/ia")
      .then((r) => {
        if (r.status === 401) {
          setSemAcesso(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (!d) return;
        setConfigurado(d.configurado);
        setInstrucoes(d.instrucoes || "");
        setPadrao(d.instrucoesPadrao || "");
      })
      .catch(() => {});
  }, []);

  async function salvar() {
    setSaving(true);
    try {
      const res = await fetch("/api/empresa/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave: chave || undefined, instrucoes }),
      });
      if (!res.ok) throw new Error();
      toast("Configuração de IA salva!", "success");
      setChave("");
      const st = await fetch("/api/empresa/ia").then((r) => r.json());
      setConfigurado(st.configurado);
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (semAcesso) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-slate-500">
          Apenas administradores podem configurar a Inteligência Artificial.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-violet-700" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Inteligência Artificial</h1>
          <p className="text-sm text-slate-500">
            Autopreenchimento de cadastros e geração de propostas com a Claude API.
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
          ? "✅ IA ativa: botões ✨ nos cadastros de itens, locais e clientes, e chat de propostas no Projeto Especial."
          : "⚠️ Cole a chave da API abaixo para ativar. Sem ela, os botões de IA ficam ocultos."}
      </div>

      {/* Chave */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
        <Input
          label={configurado ? "Chave da API (já configurada — preencha só para trocar)" : "Chave da API Anthropic"}
          type="password"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          placeholder={configurado ? "••••••••••••" : "sk-ant-..."}
        />
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">Como obter (5 minutos, só na primeira vez):</p>
          <p>1. Acesse <strong>platform.claude.com</strong> e crie uma conta</p>
          <p>2. Em Billing, adicione um cartão (cobrança só pelo uso — centavos por preenchimento)</p>
          <p>3. Em API Keys → <strong>Create Key</strong> → copie e cole aqui</p>
          <p className="pt-1">Cada empresa usa a própria chave e paga o próprio consumo — o sistema é multiempresa. A chave fica só no servidor e nunca aparece de volta.</p>
        </div>
      </div>

      {/* Skill de propostas */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Instruções do gerador de propostas (sua skill)
          </h2>
          <p className="text-xs text-slate-400">
            É o &quot;treinamento&quot; do assistente de propostas do Projeto Especial. Cole aqui a
            sua skill ou edite o modelo abaixo — a IA seguirá exatamente estas instruções.
          </p>
        </div>
        <Textarea
          value={instrucoes}
          onChange={(e) => setInstrucoes(e.target.value)}
          rows={16}
          className="font-mono text-xs"
        />
        <button
          onClick={() => setInstrucoes(padrao)}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600"
        >
          <RotateCcw className="h-3 w-3" />
          Restaurar instruções padrão
        </button>
      </div>

      <div className="flex justify-end">
        <Button onClick={salvar} loading={saving}>
          Salvar
        </Button>
      </div>
    </div>
  );
}
