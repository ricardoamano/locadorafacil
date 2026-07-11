"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2, Truck, Copy } from "lucide-react";

interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  ano: number | null;
  tipo: string | null;
  capacidadeCarga: string | null;
}

interface FormData {
  id?: string;
  placa: string;
  modelo: string;
  ano: string;
  tipo: string;
  capacidadeCarga: string;
}

const empty = (): FormData => ({ placa: "", modelo: "", ano: "", tipo: "", capacidadeCarga: "" });

export default function VeiculosPage() {
  const { toast } = useToast();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormData>(empty());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }
  function toggleTodos() {
    setSelecionados((prev) =>
      prev.size === veiculos.length ? new Set() : new Set(veiculos.map((v) => v.id))
    );
  }
  async function copiarSelecionados() {
    const lista = veiculos.filter((v) => selecionados.has(v.id));
    if (lista.length === 0) {
      toast("Selecione ao menos um veículo.", "error");
      return;
    }
    const texto = lista
      .map((v) =>
        [
          v.modelo,
          v.placa ? `Placa: ${v.placa}` : null,
          v.ano ? `Ano: ${v.ano}` : null,
          v.tipo ? `Tipo: ${v.tipo}` : null,
          v.capacidadeCarga ? `Capacidade: ${v.capacidadeCarga}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(texto);
      toast(`Dados de ${lista.length} veículo(s) copiados!`, "success");
    } catch {
      toast("Não foi possível copiar.", "error");
    }
  }

  const fetchVeiculos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/veiculos");
      const data = await res.json();
      setVeiculos(data.veiculos || []);
    } catch {
      toast("Erro ao carregar veículos.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchVeiculos();
  }, [fetchVeiculos]);

  async function handleSave() {
    if (!form.placa.trim() || !form.modelo.trim()) {
      toast("Informe placa e modelo.", "error");
      return;
    }
    setSaving(true);
    try {
      const url = form.id ? `/api/veiculos/${form.id}` : "/api/veiculos";
      const res = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast(form.id ? "Veículo atualizado!" : "Veículo criado!", "success");
      setModalOpen(false);
      fetchVeiculos();
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
      const res = await fetch(`/api/veiculos/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Veículo excluído.", "success");
      setDeleteId(null);
      fetchVeiculos();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Equipe" }, { label: "Veículos" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Veículos</h1>
            <p className="text-sm text-slate-500 mt-1">Frota para transporte de equipamentos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selecionados.size > 0 && (
              <Button variant="outline" onClick={copiarSelecionados}>
                <Copy className="h-4 w-4" />
                Copiar dados ({selecionados.size})
              </Button>
            )}
            <Button
              onClick={() => {
                setForm(empty());
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo Veículo
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : veiculos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <Truck className="h-8 w-8" />
              <p className="text-sm">Nenhum veículo cadastrado ainda</p>
            </div>
          ) : (
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={veiculos.length > 0 && selecionados.size === veiculos.length}
                      onChange={toggleTodos}
                      title="Selecionar todos os listados"
                      className="h-4 w-4 rounded cursor-pointer"
                    />
                  </th>
                  {["Placa", "Modelo", "Ano", "Tipo", "Capacidade", "Ações"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                        i === 5 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {veiculos.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selecionados.has(v.id)}
                        onChange={() => toggleSelecionado(v.id)}
                        className="h-4 w-4 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-medium text-slate-700">{v.placa}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{v.modelo}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{v.ano || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{v.tipo || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{v.capacidadeCarga || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setForm({
                              id: v.id,
                              placa: v.placa,
                              modelo: v.modelo,
                              ano: v.ano != null ? String(v.ano) : "",
                              tipo: v.tipo || "",
                              capacidadeCarga: v.capacidadeCarga || "",
                            });
                            setModalOpen(true);
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(v.id)}
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
          title={form.id ? "Editar Veículo" : "Novo Veículo"}
          size="lg"
        >
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Placa *"
                  value={form.placa}
                  onChange={(e) => setForm((p) => ({ ...p, placa: e.target.value }))}
                  placeholder="ABC-1D23"
                />
                <div className="col-span-2">
                  <Input
                    label="Modelo *"
                    value={form.modelo}
                    onChange={(e) => setForm((p) => ({ ...p, modelo: e.target.value }))}
                    placeholder="Ex: Fiat Ducato"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Ano"
                  type="number"
                  value={form.ano}
                  onChange={(e) => setForm((p) => ({ ...p, ano: e.target.value }))}
                  placeholder="2022"
                />
                <Input
                  label="Tipo"
                  value={form.tipo}
                  onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                  placeholder="Van, Caminhão..."
                />
                <Input
                  label="Capacidade de Carga"
                  value={form.capacidadeCarga}
                  onChange={(e) => setForm((p) => ({ ...p, capacidadeCarga: e.target.value }))}
                  placeholder="Ex: 1.500 kg"
                />
              </div>
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
          message="Deseja realmente excluir este veículo?"
        />
      </main>
    </>
  );
}
