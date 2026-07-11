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
import { Plus, Pencil, Trash2, FileSignature } from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  RASCUNHO: { label: "Rascunho", variant: "neutral" },
  ENVIADO: { label: "Enviado", variant: "info" },
  ASSINADO: { label: "Assinado", variant: "success" },
  CANCELADO: { label: "Cancelado", variant: "danger" },
};

interface Contrato {
  id: string;
  titulo: string;
  status: string;
  conteudo: string | null;
  createdAt: string;
  cliente: { id: string; nomeFantasia: string };
  orcamento: { id: string; numero: number } | null;
}

interface Opt {
  id: string;
  nomeFantasia?: string;
  numero?: number;
  cliente?: { nomeFantasia: string };
}

interface FormData {
  id?: string;
  titulo: string;
  clienteId: string;
  orcamentoId: string;
  status: string;
  conteudo: string;
}

const empty = (): FormData => ({
  titulo: "", clienteId: "", orcamentoId: "", status: "RASCUNHO", conteudo: "",
});

export default function ContratosPage() {
  const { toast } = useToast();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Opt[]>([]);
  const [orcamentos, setOrcamentos] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormData>(empty());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchContratos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contratos");
      const data = await res.json();
      setContratos(data.contratos || []);
    } catch {
      toast("Erro ao carregar contratos.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchContratos();
    fetch("/api/contacts?type=CLIENTE&limit=200")
      .then((r) => r.json())
      .then((d) => setClientes(d.contacts || []));
    fetch("/api/orcamentos?limit=200")
      .then((r) => r.json())
      .then((d) => setOrcamentos(d.orcamentos || []));
  }, [fetchContratos]);

  async function handleSave() {
    if (!form.titulo.trim() || !form.clienteId) {
      toast("Informe título e cliente.", "error");
      return;
    }
    setSaving(true);
    try {
      const url = form.id ? `/api/contratos/${form.id}` : "/api/contratos";
      const res = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast(form.id ? "Contrato atualizado!" : "Contrato criado!", "success");
      setModalOpen(false);
      fetchContratos();
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
      const res = await fetch(`/api/contratos/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Contrato excluído.", "success");
      setDeleteId(null);
      fetchContratos();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Contratos" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contratos</h1>
            <p className="text-sm text-slate-500 mt-1">
              Contratos vinculados a clientes e orçamentos
            </p>
          </div>
          <Button
            onClick={() => {
              setForm(empty());
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo Contrato
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : contratos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <FileSignature className="h-8 w-8" />
              <p className="text-sm">Nenhum contrato criado ainda</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Contrato", "Cliente", "Orçamento", "Criado em", "Status", "Ações"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                          i === 5 ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contratos.map((c) => {
                  const cfg = statusConfig[c.status] || statusConfig.RASCUNHO;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {c.titulo}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {c.cliente?.nomeFantasia}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {c.orcamento ? `#${c.orcamento.numero}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setForm({
                                id: c.id,
                                titulo: c.titulo,
                                clienteId: c.cliente?.id || "",
                                orcamentoId: c.orcamento?.id || "",
                                status: c.status,
                                conteudo: c.conteudo || "",
                              });
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
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={form.id ? "Editar Contrato" : "Novo Contrato"}
          size="xl"
        >
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Input
                    label="Título *"
                    value={form.titulo}
                    onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                    placeholder="Ex: Contrato de locação — Evento X"
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
                <Select
                  label="Cliente *"
                  value={form.clienteId}
                  onChange={(e) => setForm((p) => ({ ...p, clienteId: e.target.value }))}
                  options={clientes.map((c) => ({
                    value: c.id,
                    label: c.nomeFantasia || "",
                  }))}
                  placeholder="Selecione o cliente"
                />
                <Select
                  label="Orçamento Vinculado"
                  value={form.orcamentoId}
                  onChange={(e) => setForm((p) => ({ ...p, orcamentoId: e.target.value }))}
                  options={orcamentos.map((o) => ({
                    value: o.id,
                    label: `#${o.numero}${o.cliente ? ` — ${o.cliente.nomeFantasia}` : ""}`,
                  }))}
                  placeholder="Selecione (opcional)"
                />
              </div>
              <Textarea
                label="Conteúdo do Contrato"
                value={form.conteudo}
                onChange={(e) => setForm((p) => ({ ...p, conteudo: e.target.value }))}
                placeholder="Cole ou escreva o texto do contrato..."
                rows={8}
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
          message="Deseja realmente excluir este contrato?"
        />
      </main>
    </>
  );
}
