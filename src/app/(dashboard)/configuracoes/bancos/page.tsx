"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, ArrowUp, ArrowDown, Landmark, Power } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Banco {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export default function BancosConfigPage() {
  const { toast } = useToast();
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchBancos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bancos");
      const data = await res.json();
      setBancos(data.bancos || []);
    } catch {
      toast("Erro ao carregar bancos.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBancos();
  }, [fetchBancos]);

  async function criar() {
    if (!novoNome.trim()) return;
    setCriando(true);
    try {
      const res = await fetch("/api/bancos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novoNome }),
      });
      if (!res.ok) throw new Error();
      toast("Banco criado!", "success");
      setNovoNome("");
      fetchBancos();
    } catch {
      toast("Erro ao criar.", "error");
    } finally {
      setCriando(false);
    }
  }

  async function atualizar(id: string, data: Partial<Banco>) {
    try {
      const res = await fetch(`/api/bancos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      fetchBancos();
    } catch {
      toast("Erro ao atualizar.", "error");
    }
  }

  async function mover(index: number, dir: -1 | 1) {
    const alvo = bancos[index];
    const vizinho = bancos[index + dir];
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
      const res = await fetch(`/api/bancos/${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Erro ao excluir.", "error");
        return;
      }
      toast("Banco excluído.", "success");
      setDeleteId(null);
      fetchBancos();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <Header
        breadcrumbs={[{ label: "Configurações" }, { label: "Bancos" }]}
      />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Bancos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Contas bancárias usadas no fluxo de caixa — informe por qual banco você recebe e paga cada transação
          </p>
        </div>

        <div className="max-w-2xl space-y-4">
          <div className="flex gap-2">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome do banco (ex: Itaú PJ, Nubank, Caixa)"
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
            ) : bancos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-400">
                <Landmark className="h-7 w-7" />
                <p className="text-sm">Nenhum banco cadastrado</p>
              </div>
            ) : (
              bancos.map((m, i) => (
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
                      disabled={i === bancos.length - 1}
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
          message="Excluir este banco? Prefira desativar se ele já foi usado em transações."
        />
      </main>
    </>
  );
}
