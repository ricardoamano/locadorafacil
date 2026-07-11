"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2, CheckSquare } from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  NAO_INICIADA: { label: "Não Iniciada", variant: "warning" },
  EM_ANDAMENTO: { label: "Em andamento", variant: "info" },
  CONCLUIDA: { label: "Concluída", variant: "success" },
  ATRASADA: { label: "Atrasada", variant: "danger" },
};

interface Tarefa {
  id: string;
  nome: string;
  instrucoes: string | null;
  dataInicio: string;
  dataEntrega: string;
  obsExecucao: string | null;
  status: string;
  criador: { id: string; name: string | null };
  responsaveis: { membro: { id: string; nome: string } }[];
}

interface MembroOpt {
  id: string;
  nome: string;
}

interface FormData {
  id?: string;
  nome: string;
  instrucoes: string;
  dataInicio: string;
  dataEntrega: string;
  obsExecucao: string;
  status: string;
  responsaveis: string[];
}

const empty = (): FormData => ({
  nome: "", instrucoes: "", dataInicio: "", dataEntrega: "",
  obsExecucao: "", status: "NAO_INICIADA", responsaveis: [],
});

export default function TarefasPage() {
  const { toast } = useToast();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<MembroOpt[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormData>(empty());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTarefas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, limit: "100" });
      const res = await fetch(`/api/tarefas?${params}`);
      const data = await res.json();
      setTarefas(data.tarefas || []);
    } catch {
      toast("Erro ao carregar tarefas.", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchTarefas();
    fetch("/api/membros")
      .then((r) => r.json())
      .then((d) => setMembros(d.membros || []))
      .catch(() => setMembros([]));
  }, [fetchTarefas]);

  function openCreate() {
    setForm(empty());
    setModalOpen(true);
  }
  function openEdit(t: Tarefa) {
    setForm({
      id: t.id,
      nome: t.nome,
      instrucoes: t.instrucoes || "",
      dataInicio: t.dataInicio ? t.dataInicio.slice(0, 10) : "",
      dataEntrega: t.dataEntrega ? t.dataEntrega.slice(0, 10) : "",
      obsExecucao: t.obsExecucao || "",
      status: t.status,
      responsaveis: t.responsaveis.map((r) => r.membro.id),
    });
    setModalOpen(true);
  }

  function toggleResponsavel(id: string) {
    setForm((p) => ({
      ...p,
      responsaveis: p.responsaveis.includes(id)
        ? p.responsaveis.filter((x) => x !== id)
        : [...p.responsaveis, id],
    }));
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.dataInicio || !form.dataEntrega) {
      toast("Preencha nome e datas.", "error");
      return;
    }
    setSaving(true);
    try {
      const url = form.id ? `/api/tarefas/${form.id}` : "/api/tarefas";
      const res = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast(form.id ? "Tarefa atualizada!" : "Tarefa criada!", "success");
      setModalOpen(false);
      fetchTarefas();
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
      const res = await fetch(`/api/tarefas/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Tarefa excluída.", "success");
      setDeleteId(null);
      fetchTarefas();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Tarefas" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tarefas</h1>
            <p className="text-sm text-slate-500 mt-1">
              Organize o trabalho da equipe com prazos e responsáveis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os status</option>
              {Object.entries(statusConfig).map(([value, cfg]) => (
                <option key={value} value={value}>
                  {cfg.label}
                </option>
              ))}
            </select>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nova Tarefa
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : tarefas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <CheckSquare className="h-8 w-8" />
              <p className="text-sm">Nenhuma tarefa cadastrada</p>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Criar Tarefa
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Tarefa", "Responsáveis", "Criador", "Início", "Entrega", "Status", "Ações"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                          i === 6 ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tarefas.map((t) => {
                  const cfg = statusConfig[t.status] || statusConfig.NAO_INICIADA;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{t.nome}</p>
                        {t.instrucoes && (
                          <p className="text-xs text-slate-400 truncate max-w-56">
                            {t.instrucoes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex -space-x-1.5">
                          {t.responsaveis.slice(0, 4).map((r) => (
                            <span
                              key={r.membro.id}
                              title={r.membro.nome}
                              className="h-7 w-7 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[11px] font-bold text-blue-700"
                            >
                              {r.membro.nome.charAt(0).toUpperCase()}
                            </span>
                          ))}
                          {t.responsaveis.length === 0 && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {t.criador?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(t.dataInicio).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(t.dataEntrega).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(t)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(t.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={form.id ? "Editar Tarefa" : "Nova Tarefa"}
          size="xl"
        >
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Input
                    label="Nome da Tarefa *"
                    value={form.nome}
                    onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                    placeholder="Ex: Preparar equipamentos do evento X"
                  />
                </div>
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  options={Object.entries(statusConfig).map(([value, cfg]) => ({
                    value,
                    label: cfg.label,
                  }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Data de Início *"
                  type="date"
                  value={form.dataInicio}
                  onChange={(e) => setForm((p) => ({ ...p, dataInicio: e.target.value }))}
                />
                <Input
                  label="Data de Entrega *"
                  type="date"
                  value={form.dataEntrega}
                  onChange={(e) => setForm((p) => ({ ...p, dataEntrega: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Responsáveis
                </label>
                {membros.length === 0 ? (
                  <p className="text-xs text-amber-600">
                    Nenhum membro cadastrado. Cadastre em Equipe → Membros.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {membros.map((m) => {
                      const selected = form.responsaveis.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleResponsavel(m.id)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                            selected
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          {m.nome}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Textarea
                label="Instruções para Execução"
                value={form.instrucoes}
                onChange={(e) => setForm((p) => ({ ...p, instrucoes: e.target.value }))}
                placeholder="Como a tarefa deve ser executada..."
                rows={2}
              />
              <Textarea
                label="Observações sobre Execução"
                value={form.obsExecucao}
                onChange={(e) => setForm((p) => ({ ...p, obsExecucao: e.target.value }))}
                placeholder="Anotações após execução..."
                rows={2}
              />
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
          message="Deseja realmente excluir esta tarefa?"
        />
      </main>
    </>
  );
}
