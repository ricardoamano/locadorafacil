"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Sparkles, RotateCcw, Plus, Trash2, FileText, Truck, Wand2 } from "lucide-react";

// Configuração de IA da empresa: chave da Claude API + skills nomeadas.
// A empresa pode ter várias skills (ex.: uma para propostas, outra para escala
// de equipe/veículos). Cada skill tem um tipo que define onde é usada.

type SkillTipo = "PROPOSTA" | "ESCALA" | "GERAL";
interface Skill {
  id: string;
  nome: string;
  tipo: SkillTipo;
  instrucoes: string;
}

const TIPO_OPCOES = [
  { value: "PROPOSTA", label: "Propostas (Projeto Especial)" },
  { value: "ESCALA", label: "Escala de equipe e veículos (OS)" },
  { value: "GERAL", label: "Geral" },
];

const TIPO_ICONE: Record<SkillTipo, React.ReactNode> = {
  PROPOSTA: <FileText className="h-4 w-4 text-violet-700" />,
  ESCALA: <Truck className="h-4 w-4 text-violet-700" />,
  GERAL: <Wand2 className="h-4 w-4 text-violet-700" />,
};

function novoId() {
  return `skill-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export default function ConfigIaPage() {
  const { toast } = useToast();
  const [configurado, setConfigurado] = useState(false);
  const [chave, setChave] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [padroes, setPadroes] = useState<Record<string, string>>({});
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
        setSkills(d.skills || []);
        setPadroes(d.padroes || {});
      })
      .catch(() => {});
  }, []);

  function atualizar(id: string, campo: keyof Skill, valor: string) {
    setSkills((p) => p.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)));
  }

  function adicionar() {
    setSkills((p) => [
      ...p,
      { id: novoId(), nome: "Nova skill", tipo: "GERAL", instrucoes: "" },
    ]);
  }

  function remover(id: string) {
    setSkills((p) => p.filter((s) => s.id !== id));
  }

  async function salvar() {
    setSaving(true);
    try {
      const res = await fetch("/api/empresa/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave: chave || undefined, skills }),
      });
      if (!res.ok) throw new Error();
      toast("Configuração de IA salva!", "success");
      setChave("");
      const st = await fetch("/api/empresa/ia").then((r) => r.json());
      setConfigurado(st.configurado);
      setSkills(st.skills || []);
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
            Autopreenchimento de cadastros e assistentes com a Claude API.
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
          ? "✅ IA ativa: botões ✨ nos cadastros, chat de propostas no Projeto Especial e assistente de escala na OS."
          : "⚠️ Cole a chave da API abaixo para ativar. Sem ela, os recursos de IA ficam ocultos."}
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

      {/* Skills */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Skills da IA</h2>
            <p className="text-xs text-slate-400">
              Instruções que treinam cada assistente. Você pode ter várias — a de
              <strong> Propostas</strong> alimenta o Projeto Especial e a de
              <strong> Escala</strong> alimenta o chat de logística dentro da OS.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={adicionar}>
            <Plus className="h-4 w-4" />
            Nova skill
          </Button>
        </div>

        {skills.length === 0 && (
          <p className="text-sm text-slate-400 py-6 text-center">
            Nenhuma skill. Clique em “Nova skill” para adicionar.
          </p>
        )}

        {skills.map((s) => {
          const padrao = padroes[s.tipo];
          return (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3"
            >
              <div className="flex items-start gap-3">
                <span className="h-8 w-8 shrink-0 rounded-full bg-violet-100 flex items-center justify-center mt-5">
                  {TIPO_ICONE[s.tipo]}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                  <Input
                    label="Nome da skill"
                    value={s.nome}
                    onChange={(e) => atualizar(s.id, "nome", e.target.value)}
                    placeholder="Ex.: Gerador de propostas"
                  />
                  <Select
                    label="Usada em"
                    value={s.tipo}
                    onChange={(e) => atualizar(s.id, "tipo", e.target.value)}
                    options={TIPO_OPCOES}
                  />
                </div>
                <button
                  onClick={() => remover(s.id)}
                  className="text-slate-300 hover:text-red-500 mt-5"
                  title="Remover skill"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                value={s.instrucoes}
                onChange={(e) => atualizar(s.id, "instrucoes", e.target.value)}
                rows={12}
                className="font-mono text-xs"
                placeholder="Cole aqui a sua skill / instruções para a IA..."
              />
              {padrao && (
                <button
                  onClick={() => atualizar(s.id, "instrucoes", padrao)}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600"
                >
                  <RotateCcw className="h-3 w-3" />
                  Usar instruções padrão deste tipo
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={salvar} loading={saving}>
          Salvar
        </Button>
      </div>
    </div>
  );
}
