"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, RotateCcw, CalendarDays } from "lucide-react";

export default function TiposEventoPage() {
  const { toast } = useToast();
  const [tipos, setTipos] = useState<string[]>([]);
  const [novo, setNovo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurarOpen, setRestaurarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/tipos-evento")
      .then((r) => r.json())
      .then((d) => setTipos(d.tipos || []))
      .finally(() => setLoading(false));
  }, []);

  function adicionar() {
    const t = novo.trim();
    if (!t) return;
    if (tipos.some((x) => x.toLowerCase() === t.toLowerCase())) {
      toast("Este tipo já existe.", "error");
      return;
    }
    setTipos((prev) => [...prev, t]);
    setNovo("");
  }

  function remover(i: number) {
    setTipos((prev) => prev.filter((_, idx) => idx !== i));
  }

  function renomear(i: number, valor: string) {
    setTipos((prev) => {
      const arr = [...prev];
      arr[i] = valor;
      return arr;
    });
  }

  async function salvar(lista: string[] | null) {
    if (lista !== null && lista.map((t) => t.trim()).filter(Boolean).length === 0) {
      toast("Informe ao menos um tipo de evento.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tipos-evento", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipos: lista === null ? null : lista.map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (res.status === 403) {
        toast("Apenas administradores podem editar os tipos de evento.", "error");
        return;
      }
      if (!res.ok) {
        toast(data.error || "Erro ao salvar.", "error");
        return;
      }
      setTipos(data.tipos || []);
      toast(
        lista === null
          ? "Tipos de evento restaurados ao padrão."
          : "Tipos de evento salvos!",
        "success"
      );
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
        breadcrumbs={[{ label: "Configurações" }, { label: "Tipos de Evento" }]}
      />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tipos de Evento</h1>
            <p className="text-sm text-slate-500 mt-1">
              Padronize as opções do campo &quot;Tipo de Evento&quot; nos orçamentos
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
          <div className="max-w-xl space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-2">
              {tipos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-400">
                  <CalendarDays className="h-6 w-6" />
                  <p className="text-sm">Nenhum tipo cadastrado</p>
                </div>
              ) : (
                tipos.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={t} onChange={(e) => renomear(i, e.target.value)} />
                    <button
                      onClick={() => remover(i)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  adicionar();
                }}
                className="flex items-center gap-2 pt-2 border-t border-slate-50"
              >
                <Input
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  placeholder="Novo tipo de evento..."
                />
                <Button type="submit" variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </form>
            </div>

            <p className="text-xs text-slate-400">
              Orçamentos existentes mantêm o tipo salvo mesmo que ele seja removido
              desta lista.
            </p>

            <div className="flex justify-end">
              <Button onClick={() => salvar(tipos)} loading={saving}>
                Salvar tipos de evento
              </Button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={restaurarOpen}
          onClose={() => setRestaurarOpen(false)}
          onConfirm={() => salvar(null)}
          loading={saving}
          message="Restaurar a lista padrão de tipos de evento?"
        />
      </main>
    </>
  );
}
