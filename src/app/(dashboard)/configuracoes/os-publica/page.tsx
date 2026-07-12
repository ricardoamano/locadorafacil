"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Eye, EyeOff, Share2 } from "lucide-react";

// O admin decide quais seções aparecem na OS pública da empresa

interface Secao {
  key: string;
  label: string;
  descricao: string;
}

export default function ConfigOsPublicaPage() {
  const { toast } = useToast();
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [config, setConfig] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [semAcesso, setSemAcesso] = useState(false);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    fetch("/api/empresa/os-publica")
      .then((r) => {
        if (r.status === 401) {
          setSemAcesso(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (!d) return;
        setSecoes(d.secoes || []);
        setConfig(d.config || {});
        setCarregado(true);
      })
      .catch(() => {});
  }, []);

  async function salvar() {
    setSaving(true);
    try {
      const res = await fetch("/api/empresa/os-publica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error();
      toast("Configuração salva! Vale para todas as OS públicas da empresa.", "success");
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
          Apenas administradores podem configurar a OS pública.
        </p>
      </div>
    );
  }
  if (!carregado) return null;

  const visiveis = Object.values(config).filter(Boolean).length;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
          <Share2 className="h-5 w-5 text-blue-700" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">OS Pública</h1>
          <p className="text-sm text-slate-500">
            Escolha o que a equipe vê no link público da OS. Vale para todas as OS da
            empresa e pode ser mudado a qualquer momento.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
        {secoes.map((s) => {
          const ativo = config[s.key] !== false;
          return (
            <button
              key={s.key}
              onClick={() => setConfig((p) => ({ ...p, [s.key]: !ativo }))}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50/60 transition-colors"
            >
              <span
                className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                  ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                }`}
              >
                {ativo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </span>
              <span className="flex-1 min-w-0">
                <span
                  className={`block text-sm font-medium ${
                    ativo ? "text-slate-900" : "text-slate-400 line-through"
                  }`}
                >
                  {s.label}
                </span>
                <span className="block text-xs text-slate-400">{s.descricao}</span>
              </span>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                  ativo ? "bg-emerald-500" : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    ativo ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-slate-400">
          {visiveis} de {secoes.length} seções visíveis · o cabeçalho da OS (número, evento e
          empresa) sempre aparece · valores financeiros nunca aparecem
        </p>
        <Button onClick={salvar} loading={saving}>
          Salvar
        </Button>
      </div>
    </div>
  );
}
