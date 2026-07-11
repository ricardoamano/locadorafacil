"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw, MenuSquare } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Itens raiz do menu (chaves internas fixas — só o visual muda)
const ITENS_PADRAO: { key: string; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "cadastros", label: "Cadastros" },
  { key: "ativos", label: "Ativos" },
  { key: "orcamentos", label: "Orçamentos" },
  { key: "ordens-servico", label: "Ordens de Serviço" },
  { key: "financeiro", label: "Financeiro" },
  { key: "calendario", label: "Calendário" },
  { key: "equipe", label: "Equipe" },
  { key: "faturas", label: "Faturas" },
  { key: "tarefas", label: "Tarefas" },
  { key: "postos-servico", label: "Postos de Serviço" },
  { key: "contratos", label: "Contratos" },
  { key: "links", label: "Links" },
  { key: "configuracoes", label: "Configurações" },
];

interface ItemCfg {
  key: string;
  label: string;
  hidden: boolean;
}

function padrao(): ItemCfg[] {
  return ITENS_PADRAO.map((i) => ({ key: i.key, label: i.label, hidden: false }));
}

export default function MenuConfigPage() {
  const { toast } = useToast();
  const [itens, setItens] = useState<ItemCfg[]>(padrao());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurarOpen, setRestaurarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/menu-config")
      .then((r) => r.json())
      .then((d: any) => {
        const cfg = d.menuConfig?.itens;
        if (Array.isArray(cfg) && cfg.length > 0) {
          const base = new Map(ITENS_PADRAO.map((i) => [i.key, i.label]));
          const ordenados: ItemCfg[] = [];
          const usados = new Set<string>();
          for (const c of cfg) {
            if (!base.has(c.key)) continue;
            usados.add(c.key);
            ordenados.push({
              key: c.key,
              label: c.label || base.get(c.key)!,
              hidden: !!c.hidden && c.key !== "configuracoes",
            });
          }
          for (const i of ITENS_PADRAO) {
            if (!usados.has(i.key))
              ordenados.push({ key: i.key, label: i.label, hidden: false });
          }
          setItens(ordenados);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mover(i: number, dir: -1 | 1) {
    setItens((prev) => {
      const arr = [...prev];
      const alvo = i + dir;
      if (alvo < 0 || alvo >= arr.length) return prev;
      [arr[i], arr[alvo]] = [arr[alvo], arr[i]];
      return arr;
    });
  }

  function setLabel(i: number, label: string) {
    setItens((prev) => {
      const arr = [...prev];
      arr[i] = { ...arr[i], label };
      return arr;
    });
  }

  function toggleHidden(i: number) {
    setItens((prev) => {
      const arr = [...prev];
      if (arr[i].key === "configuracoes") return prev; // nunca ocultável
      arr[i] = { ...arr[i], hidden: !arr[i].hidden };
      return arr;
    });
  }

  async function salvar(cfg: ItemCfg[] | null) {
    setSaving(true);
    try {
      const res = await fetch("/api/menu-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuConfig: cfg === null ? null : { itens: cfg },
        }),
      });
      if (res.status === 403) {
        toast("Apenas administradores podem personalizar o menu.", "error");
        return;
      }
      if (!res.ok) throw new Error();
      if (cfg === null) {
        setItens(padrao());
        toast("Menu restaurado ao padrão. Recarregue a página para ver.", "success");
      } else {
        toast(
          "Menu personalizado salvo para todos os usuários da empresa! Recarregue a página para ver.",
          "success"
        );
      }
      setRestaurarOpen(false);
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header
        breadcrumbs={[{ label: "Configurações" }, { label: "Personalização do Menu" }]}
      />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Personalização do Menu
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Renomeie, reordene e oculte itens — vale para todos os usuários. Rotas e
              permissões continuam funcionando normalmente.
            </p>
          </div>
          <Button variant="outline" onClick={() => setRestaurarOpen(true)}>
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
              {itens.map((item, i) => {
                const original = ITENS_PADRAO.find((p) => p.key === item.key);
                return (
                  <div key={item.key} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => mover(i, -1)}
                        disabled={i === 0}
                        className="text-slate-300 hover:text-slate-600 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => mover(i, 1)}
                        disabled={i === itens.length - 1}
                        className="text-slate-300 hover:text-slate-600 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <Input
                        value={item.label}
                        onChange={(e) => setLabel(i, e.target.value)}
                        className={item.hidden ? "opacity-50" : ""}
                      />
                      {original && original.label !== item.label && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          original: {original.label}
                        </p>
                      )}
                    </div>

                    {item.key === "configuracoes" ? (
                      <span
                        className="text-[10px] text-slate-400 uppercase tracking-wide"
                        title="Configurações nunca pode ser ocultada"
                      >
                        sempre visível
                      </span>
                    ) : (
                      <button
                        onClick={() => toggleHidden(i)}
                        className={`p-1.5 rounded-md transition-colors ${
                          item.hidden
                            ? "text-red-500 hover:bg-red-50"
                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                        }`}
                        title={item.hidden ? "Oculto — clique para exibir" : "Visível — clique para ocultar"}
                      >
                        {item.hidden ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Prévia */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MenuSquare className="h-3.5 w-3.5" />
                Prévia do menu
              </p>
              <div className="flex flex-wrap gap-1.5">
                {itens
                  .filter((i) => !i.hidden)
                  .map((i) => (
                    <span
                      key={i.key}
                      className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium"
                    >
                      {i.label}
                    </span>
                  ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => salvar(itens)} loading={saving}>
                Salvar personalização
              </Button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={restaurarOpen}
          onClose={() => setRestaurarOpen(false)}
          onConfirm={() => salvar(null)}
          loading={saving}
          message="Restaurar o menu original para todos os usuários da empresa?"
        />
      </main>
    </>
  );
}
