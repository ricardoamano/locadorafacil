"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2, Package } from "lucide-react";

interface Categoria {
  id: string;
  nome: string;
  tipo: string;
  subCategorias?: { id: string; nome: string }[];
}

export default function CategoriasPage() {
  const { toast } = useToast();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  // subId preenchido = editando uma subcategoria; categoriaPaiId escolhido no
  // modal = cria/move a subcategoria para dentro dessa categoria.
  const [form, setForm] = useState<{
    id?: string;
    subId?: string;
    nome: string;
    tipo: string;
    categoriaPaiId: string;
  }>({ nome: "", tipo: "ITEM", categoriaPaiId: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [novaSub, setNovaSub] = useState<Record<string, string>>({});
  const [criandoSub, setCriandoSub] = useState<string | null>(null);

  const fetchCategorias = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categorias");
      const data = await res.json();
      setCategorias(data.categorias || []);
    } catch {
      toast("Erro ao carregar categorias.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  async function handleSave() {
    if (!form.nome.trim()) {
      toast("Informe o nome.", "error");
      return;
    }
    setSaving(true);
    try {
      let url: string;
      let method: string;
      let payload: Record<string, unknown>;

      if (form.subId) {
        // Editando uma subcategoria (renomear / mover de categoria pai)
        url = "/api/subcategorias";
        method = "PUT";
        payload = { id: form.subId, nome: form.nome, categoriaId: form.categoriaPaiId };
      } else if (!form.id && form.categoriaPaiId) {
        // Nova subcategoria dentro da categoria pai escolhida
        url = "/api/subcategorias";
        method = "POST";
        payload = { nome: form.nome, categoriaId: form.categoriaPaiId };
      } else {
        url = form.id ? `/api/categorias/${form.id}` : "/api/categorias";
        method = form.id ? "PUT" : "POST";
        payload = { nome: form.nome, tipo: form.tipo };
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast(
        form.subId || (!form.id && form.categoriaPaiId)
          ? "Subcategoria salva!"
          : form.id
            ? "Categoria atualizada!"
            : "Categoria criada!",
        "success"
      );
      setModalOpen(false);
      fetchCategorias();
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/categorias/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Categoria excluída.", "success");
      setDeleteId(null);
      fetchCategorias();
    } catch {
      toast("Erro ao excluir. Verifique se não há itens vinculados.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function criarSub(categoriaId: string) {
    const nome = (novaSub[categoriaId] || "").trim();
    if (!nome || criandoSub) return;
    setCriandoSub(categoriaId);
    try {
      const res = await fetch("/api/subcategorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoriaId, nome }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      setNovaSub((p) => ({ ...p, [categoriaId]: "" }));
      // Atualiza só esta categoria na lista (sem recarregar a tela/piscar)
      setCategorias((prev) =>
        prev.map((c) =>
          c.id === categoriaId
            ? {
                ...c,
                subCategorias: [
                  ...(c.subCategorias || []).filter((s) => s.id !== d.id),
                  { id: d.id, nome: d.nome },
                ],
              }
            : c
        )
      );
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao criar subcategoria.", "error");
    } finally {
      setCriandoSub(null);
    }
  }

  async function excluirSub(id: string) {
    try {
      const res = await fetch(`/api/subcategorias?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCategorias((prev) =>
        prev.map((c) => ({
          ...c,
          subCategorias: (c.subCategorias || []).filter((s) => s.id !== id),
        }))
      );
    } catch {
      toast("Erro ao excluir subcategoria.", "error");
    }
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Ativos" }, { label: "Categorias" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
            <p className="text-sm text-slate-500 mt-1">
              Categorias de itens e categorias financeiras
            </p>
          </div>
          <Button
            onClick={() => {
              setForm({ nome: "", tipo: "ITEM", categoriaPaiId: "" });
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nova Categoria
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : categorias.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <Package className="h-8 w-8" />
              <p className="text-sm">Nenhuma categoria cadastrada</p>
            </div>
          ) : (
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {categorias.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{c.nome}</p>
                      {c.tipo !== "FINANCEIRO" && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {(c.subCategorias || []).map((sc) => (
                            <span
                              key={sc.id}
                              className="group inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[11px] text-blue-700"
                            >
                              <button
                                onClick={() => {
                                  setForm({
                                    subId: sc.id,
                                    nome: sc.nome,
                                    tipo: "ITEM",
                                    categoriaPaiId: c.id,
                                  });
                                  setModalOpen(true);
                                }}
                                title="Editar subcategoria"
                                className="hover:underline"
                              >
                                {sc.nome}
                              </button>
                              <button
                                onClick={() => excluirSub(sc.id)}
                                title="Excluir subcategoria"
                                className="text-blue-300 hover:text-red-500"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <span className="inline-flex items-center gap-1">
                            <input
                              value={novaSub[c.id] || ""}
                              onChange={(e) =>
                                setNovaSub((p) => ({ ...p, [c.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  criarSub(c.id);
                                }
                              }}
                              placeholder={criandoSub === c.id ? "Criando..." : "nova subcategoria"}
                              disabled={criandoSub === c.id}
                              className="h-6 w-40 rounded-full border border-dashed border-slate-300 bg-white px-2 text-[11px] text-slate-600 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            <button
                              type="button"
                              onClick={() => criarSub(c.id)}
                              disabled={criandoSub === c.id || !(novaSub[c.id] || "").trim()}
                              title="Adicionar subcategoria"
                              className="h-6 px-2 rounded-full bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-700 disabled:opacity-40"
                            >
                              + Add
                            </button>
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.tipo === "FINANCEIRO" ? "info" : "neutral"}>
                        {c.tipo === "FINANCEIRO" ? "Financeira" : "Item"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setForm({ id: c.id, nome: c.nome, tipo: c.tipo, categoriaPaiId: "" });
                            setModalOpen(true);
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={
            form.subId
              ? "Editar Subcategoria"
              : form.id
                ? "Editar Categoria"
                : "Nova Categoria"
          }
          size="md"
        >
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Nome *"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Áudio, Microfone, Impressora..."
              />
              {/* Categoria pai: escolher uma transforma em subcategoria (ex.: Áudio → Microfone) */}
              {!form.id && form.tipo === "ITEM" && (
                <Select
                  label="Dentro de (categoria pai)"
                  value={form.categoriaPaiId}
                  onChange={(e) => setForm((p) => ({ ...p, categoriaPaiId: e.target.value }))}
                  options={categorias
                    .filter((c) => c.tipo === "ITEM")
                    .map((c) => ({ value: c.id, label: c.nome }))}
                  placeholder="Nenhuma — é uma categoria principal"
                  clearable={!form.subId}
                />
              )}
              {!form.subId && !form.categoriaPaiId && (
                <Select
                  label="Tipo"
                  value={form.tipo}
                  onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                  options={[
                    { value: "ITEM", label: "Categoria de Item" },
                    { value: "FINANCEIRO", label: "Categoria Financeira" },
                  ]}
                />
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {form.id ? "Salvar" : "Criar"}
            </Button>
          </ModalFooter>
        </Modal>

        <ConfirmDialog
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
          message="Deseja realmente excluir esta categoria?"
        />
      </main>
    </>
  );
}
