"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Star,
  Power,
  FileSignature,
  Eye,
} from "lucide-react";

interface Modelo {
  id: string;
  nome: string;
  conteudo: string;
  ativo: boolean;
  padrao: boolean;
  versao: number;
  updatedAt: string;
}

const VARIAVEIS: { grupo: string; itens: { chave: string; rotulo: string }[] }[] = [
  {
    grupo: "Empresa",
    itens: [
      { chave: "empresa.nome", rotulo: "Nome fantasia" },
      { chave: "empresa.razao_social", rotulo: "Razão social" },
      { chave: "empresa.cnpj", rotulo: "CNPJ" },
      { chave: "empresa.endereco", rotulo: "Endereço" },
      { chave: "empresa.telefone", rotulo: "Telefone" },
      { chave: "empresa.email", rotulo: "E-mail" },
      { chave: "empresa.responsavel", rotulo: "Responsável" },
    ],
  },
  {
    grupo: "Cliente",
    itens: [
      { chave: "cliente.nome", rotulo: "Nome" },
      { chave: "cliente.razao_social", rotulo: "Razão social" },
      { chave: "cliente.cpf_cnpj", rotulo: "CPF/CNPJ" },
      { chave: "cliente.endereco", rotulo: "Endereço" },
    ],
  },
  {
    grupo: "Orçamento e Evento",
    itens: [
      { chave: "orcamento.numero", rotulo: "Nº do orçamento" },
      { chave: "orcamento.valor_total", rotulo: "Valor total" },
      { chave: "evento.nome", rotulo: "Nome do evento" },
      { chave: "evento.data_inicio", rotulo: "Data de início" },
      { chave: "evento.data_fim", rotulo: "Data de fim" },
      { chave: "evento.local", rotulo: "Local" },
      { chave: "evento.equipamentos", rotulo: "Lista de equipamentos" },
    ],
  },
  {
    grupo: "Pagamento e Outros",
    itens: [
      { chave: "pagamento.forma", rotulo: "Forma de pagamento" },
      { chave: "pagamento.condicoes", rotulo: "Condições" },
      { chave: "ordem_servico.numero", rotulo: "Nº da OS" },
      { chave: "data.hoje", rotulo: "Data de hoje" },
    ],
  },
];

export default function ModelosContratosPage() {
  const { toast } = useToast();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<Modelo | null>(null);
  const [form, setForm] = useState<{ id?: string; nome: string; conteudo: string; padrao: boolean }>({
    nome: "",
    conteudo: "",
    padrao: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchModelos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/modelos-contrato");
      const data = await res.json();
      setModelos(data.modelos || []);
    } catch {
      toast("Erro ao carregar modelos.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchModelos();
  }, [fetchModelos]);

  function inserirVariavel(chave: string) {
    const tag = `{{${chave}}}`;
    const ta = textareaRef.current;
    if (!ta) {
      setForm((p) => ({ ...p, conteudo: p.conteudo + tag }));
      return;
    }
    const start = ta.selectionStart ?? form.conteudo.length;
    const end = ta.selectionEnd ?? start;
    const novo = form.conteudo.slice(0, start) + tag + form.conteudo.slice(end);
    setForm((p) => ({ ...p, conteudo: novo }));
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + tag.length;
    }, 0);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast("Informe o nome do modelo.", "error");
      return;
    }
    setSaving(true);
    try {
      const url = form.id ? `/api/modelos-contrato/${form.id}` : "/api/modelos-contrato";
      const res = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast(form.id ? "Modelo atualizado!" : "Modelo criado!", "success");
      setEditorOpen(false);
      fetchModelos();
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function acao(id: string, data?: Record<string, unknown>, metodo = "PUT") {
    try {
      const res = await fetch(`/api/modelos-contrato/${id}`, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: data ? JSON.stringify(data) : undefined,
      });
      if (!res.ok) throw new Error();
      fetchModelos();
      return true;
    } catch {
      toast("Erro na operação.", "error");
      return false;
    }
  }

  async function excluir() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/modelos-contrato/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Modelo excluído.", "success");
      setDeleteId(null);
      fetchModelos();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <Header
        breadcrumbs={[{ label: "Configurações" }, { label: "Modelos de Contratos" }]}
      />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Modelos de Contratos</h1>
            <p className="text-sm text-slate-500 mt-1">
              Modelos com variáveis que são preenchidas automaticamente ao gerar um contrato
            </p>
          </div>
          <Button
            onClick={() => {
              setForm({ nome: "", conteudo: "", padrao: modelos.length === 0 });
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo Modelo
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50 max-w-3xl">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : modelos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <FileSignature className="h-8 w-8" />
              <p className="text-sm">Nenhum modelo cadastrado ainda</p>
            </div>
          ) : (
            modelos.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <div className="flex-1 min-w-40">
                  <p
                    className={`text-sm font-medium ${
                      m.ativo ? "text-slate-900" : "text-slate-400 line-through"
                    }`}
                  >
                    {m.nome}
                  </p>
                  <p className="text-xs text-slate-400">
                    v{m.versao} · atualizado {new Date(m.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                {m.padrao && <Badge variant="info">Padrão</Badge>}
                <Badge variant={m.ativo ? "success" : "neutral"}>
                  {m.ativo ? "Ativo" : "Inativo"}
                </Badge>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setPreview(m);
                      setPreviewOpen(true);
                    }}
                    className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    title="Prévia"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setForm({ id: m.id, nome: m.nome, conteudo: m.conteudo, padrao: m.padrao });
                      setEditorOpen(true);
                    }}
                    className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => acao(m.id, undefined, "POST")}
                    className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    title="Duplicar"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  {!m.padrao && (
                    <button
                      onClick={() => acao(m.id, { padrao: true })}
                      className="p-1.5 rounded-md text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                      title="Definir como padrão"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => acao(m.id, { ativo: !m.ativo })}
                    className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                    title={m.ativo ? "Desativar" : "Ativar"}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(m.id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Editor */}
        <Modal
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          title={form.id ? "Editar Modelo" : "Novo Modelo"}
          size="2xl"
        >
          <ModalBody>
            <div className="space-y-4">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-48">
                  <Input
                    label="Nome do Modelo *"
                    value={form.nome}
                    onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                    placeholder="Ex: Contrato padrão de locação"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={form.padrao}
                    onChange={(e) => setForm((p) => ({ ...p, padrao: e.target.checked }))}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm text-slate-700">Modelo padrão</span>
                </label>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    Conteúdo do contrato
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={form.conteudo}
                    onChange={(e) => setForm((p) => ({ ...p, conteudo: e.target.value }))}
                    rows={16}
                    placeholder={"CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS\n\nLOCADORA: {{empresa.razao_social}}, CNPJ {{empresa.cnpj}}...\nLOCATÁRIA: {{cliente.razao_social}}, CNPJ {{cliente.cpf_cnpj}}...\n\nOBJETO: locação dos equipamentos {{evento.equipamentos}} para o evento {{evento.nome}}, de {{evento.data_inicio}} a {{evento.data_fim}}, no local {{evento.local}}.\n\nVALOR: {{orcamento.valor_total}}, pagamento via {{pagamento.forma}}."}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="lg:max-h-[420px] lg:overflow-y-auto">
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    Variáveis (clique para inserir)
                  </p>
                  <div className="space-y-3">
                    {VARIAVEIS.map((g) => (
                      <div key={g.grupo}>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          {g.grupo}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {g.itens.map((v) => (
                            <button
                              key={v.chave}
                              type="button"
                              onClick={() => inserirVariavel(v.chave)}
                              title={`{{${v.chave}}}`}
                              className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                            >
                              {v.rotulo}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {form.id ? "Salvar (nova versão)" : "Criar Modelo"}
            </Button>
          </ModalFooter>
        </Modal>

        {/* Prévia */}
        <Modal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title={preview ? `Prévia — ${preview.nome} (v${preview.versao})` : "Prévia"}
          size="2xl"
        >
          <ModalBody>
            <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans bg-slate-50 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
              {preview?.conteudo || "(vazio)"}
            </pre>
          </ModalBody>
        </Modal>

        <ConfirmDialog
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={excluir}
          loading={deleteLoading}
          message="Excluir este modelo? Contratos já gerados não serão afetados."
        />
      </main>
    </>
  );
}
