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
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, UserCheck } from "lucide-react";

const tipoLabels: Record<string, string> = {
  FUNCIONARIO: "Funcionário",
  FREELANCER: "Freelancer",
  TECNICO: "Técnico",
};

interface Membro {
  id: string;
  nome: string;
  telefone: string | null;
  rg: string | null;
  cpf: string | null;
  tipo: string;
  pix: string | null;
  cache: number | null;
}

interface FormData {
  id?: string;
  nome: string;
  telefone: string;
  rg: string;
  cpf: string;
  tipo: string;
  pix: string;
  cache: string;
}

const empty = (): FormData => ({
  nome: "", telefone: "", rg: "", cpf: "", tipo: "FREELANCER", pix: "", cache: "",
});

export default function MembrosPage() {
  const { toast } = useToast();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormData>(empty());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchMembros = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/membros");
      const data = await res.json();
      setMembros(data.membros || []);
    } catch {
      toast("Erro ao carregar membros.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMembros();
  }, [fetchMembros]);

  function openCreate() {
    setForm(empty());
    setModalOpen(true);
  }
  function openEdit(m: Membro) {
    setForm({
      id: m.id,
      nome: m.nome,
      telefone: m.telefone || "",
      rg: m.rg || "",
      cpf: m.cpf || "",
      tipo: m.tipo,
      pix: m.pix || "",
      cache: m.cache != null ? String(m.cache) : "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast("Informe o nome.", "error");
      return;
    }
    setSaving(true);
    try {
      const url = form.id ? `/api/membros/${form.id}` : "/api/membros";
      const res = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast(form.id ? "Membro atualizado!" : "Membro criado!", "success");
      setModalOpen(false);
      fetchMembros();
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
      const res = await fetch(`/api/membros/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Membro excluído.", "success");
      setDeleteId(null);
      fetchMembros();
    } catch {
      toast("Erro ao excluir. Verifique se não está escalado em uma OS.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Equipe" }, { label: "Membros" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Membros da Equipe</h1>
            <p className="text-sm text-slate-500 mt-1">
              Funcionários, freelancers e técnicos para escalar nos eventos
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Novo Membro
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : membros.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <UserCheck className="h-8 w-8" />
              <p className="text-sm">Nenhum membro cadastrado ainda</p>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Adicionar Membro
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Nome", "Tipo", "Telefone", "PIX", "Cachê", "Ações"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                        i >= 4 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {membros.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-blue-700 text-sm font-bold">
                          {m.nome.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-sm font-medium text-slate-900">{m.nome}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{tipoLabels[m.tipo] || m.tipo}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{m.telefone || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{m.pix || "—"}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                      {m.cache != null ? formatCurrency(m.cache) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(m)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(m.id)}
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
          title={form.id ? "Editar Membro" : "Novo Membro"}
          size="xl"
        >
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Input
                    label="Nome *"
                    value={form.nome}
                    onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>
                <Select
                  label="Tipo"
                  value={form.tipo}
                  onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                  options={Object.entries(tipoLabels).map(([value, label]) => ({ value, label }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Telefone"
                  value={form.telefone}
                  onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
                <Input
                  label="RG"
                  value={form.rg}
                  onChange={(e) => setForm((p) => ({ ...p, rg: e.target.value }))}
                />
                <Input
                  label="CPF"
                  value={form.cpf}
                  onChange={(e) => setForm((p) => ({ ...p, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Chave PIX"
                  value={form.pix}
                  onChange={(e) => setForm((p) => ({ ...p, pix: e.target.value }))}
                  placeholder="CPF, email, telefone ou aleatória"
                />
                <Input
                  label="Cachê padrão (R$)"
                  type="number"
                  step="0.01"
                  value={form.cache}
                  onChange={(e) => setForm((p) => ({ ...p, cache: e.target.value }))}
                  placeholder="0,00"
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
          message="Deseja realmente excluir este membro?"
        />
      </main>
    </>
  );
}
