"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, ArrowUp, ArrowDown, CreditCard, Power } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Metodo {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export default function PagamentosConfigPage() {
  const { toast } = useToast();
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchMetodos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/metodos-pagamento");
      const data = await res.json();
      setMetodos(data.metodos || []);
    } catch {
      toast("Erro ao carregar métodos.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMetodos();
  }, [fetchMetodos]);

  async function criar() {
    if (!novoNome.trim()) return;
    setCriando(true);
    try {
      const res = await fetch("/api/metodos-pagamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novoNome }),
      });
      if (!res.ok) throw new Error();
      toast("Método criado!", "success");
      setNovoNome("");
      fetchMetodos();
    } catch {
      toast("Erro ao criar.", "error");
    } finally {
      setCriando(false);
    }
  }

  async function atualizar(id: string, data: Partial<Metodo>) {
    try {
      const res = await fetch(`/api/metodos-pagamento/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      fetchMetodos();
    } catch {
      toast("Erro ao atualizar.", "error");
    }
  }

  async function mover(index: number, dir: -1 | 1) {
    const alvo = metodos[index];
    const vizinho = metodos[index + dir];
    if (!alvo || !vizinho) return;
    await Promise.all([
      atualizar(alvo.id, { ordem: vizinho.ordem }),
      atualizar(vizinho.id, { ordem: alvo.ordem }),
    ]);
  }

  async function excluir() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/metodos-pagamento/${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast("Método excluído.", "success");
      setDeleteId(null);
      fetchMetodos();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <Header
        breadcrumbs={[{ label: "Configurações" }, { label: "Métodos de Pagamento" }]}
      />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Métodos de Pagamento</h1>
          <p className="text-sm text-slate-500 mt-1">
            Somente os métodos ativos aparecem em orçamentos, faturas e financeiro
          </p>
        </div>

        <div className="max-w-2xl space-y-4">
          <div className="flex gap-2">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome do método (ex: PIX parcelado)"
              onKeyDown={(e) => e.key === "Enter" && criar()}
            />
            <Button onClick={criar} loading={criando}>
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : metodos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400">
                <CreditCard className="h-7 w-7" />
                <p className="text-sm">Nenhum método cadastrado</p>
              </div>
            ) : (
              metodos.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
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
                      disabled={i === metodos.length - 1}
                      className="text-slate-300 hover:text-slate-600 disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span
                    className={`flex-1 text-sm font-medium ${
                      m.ativo ? "text-slate-900" : "text-slate-400 line-through"
                    }`}
                  >
                    {m.nome}
                  </span>
                  <Badge variant={m.ativo ? "success" : "neutral"}>
                    {m.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <button
                    onClick={() => atualizar(m.id, { ativo: !m.ativo })}
                    className={`p-1.5 rounded-md transition-colors ${
                      m.ativo
                        ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                        : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                    }`}
                    title={m.ativo ? "Desativar" : "Ativar"}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(m.id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <ConfirmDialog
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={excluir}
          loading={deleteLoading}
          message="Excluir este método de pagamento? Prefira desativar se ele já foi usado."
        />
      </main>
    </>
  );
}
