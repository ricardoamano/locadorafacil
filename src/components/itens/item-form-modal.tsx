"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

interface Categoria {
  id: string;
  nome: string;
}

interface ItemFormData {
  id?: string;
  codigo: string;
  nome: string;
  valorAluguel: string;
  tipo: string;
  categoriaId: string;
  quantidade: string;
  especificacoes: string;
  emCatalogo: boolean;
}

const tipoOptions = [
  { value: "PROPRIO", label: "Próprio" },
  { value: "ALUGADO", label: "Alugado" },
  { value: "TERCEIRO", label: "Terceiro" },
];

function emptyForm(): ItemFormData {
  return {
    codigo: "",
    nome: "",
    valorAluguel: "",
    tipo: "PROPRIO",
    categoriaId: "",
    quantidade: "",
    especificacoes: "",
    emCatalogo: true,
  };
}

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial?: any;
}

export function ItemFormModal({
  open,
  onClose,
  onSuccess,
  initial,
}: ItemFormModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<ItemFormData>(emptyForm());
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ItemFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setErrors({});
      if (initial) {
        setForm({
          ...emptyForm(),
          ...initial,
          valorAluguel: initial.valorAluguel != null ? String(initial.valorAluguel) : "",
          quantidade: initial.quantidade != null ? String(initial.quantidade) : "",
          categoriaId: initial.categoriaId || "",
          especificacoes: initial.especificacoes || "",
        });
      } else {
        setForm(emptyForm());
      }
      fetch("/api/categorias")
        .then((r) => r.json())
        .then((d) => setCategorias(d.categorias || []))
        .catch(() => setCategorias([]));
    }
  }, [open, initial]);

  function setField<K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.nome.trim()) errs.nome = "Campo obrigatório";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const url = form.id ? `/api/itens/${form.id}` : "/api/itens";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          valorAluguel: parseFloat(form.valorAluguel) || 0,
          quantidade: parseInt(form.quantidade) || 0,
          categoriaId: form.categoriaId || null,
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      toast(
        form.id ? "Item atualizado com sucesso!" : "Item criado com sucesso!",
        "success"
      );
      onSuccess();
      onClose();
    } catch {
      toast("Erro ao salvar. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  }

  const categoriaOptions = categorias.map((c) => ({ value: c.id, label: c.nome }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? "Editar Item" : "Novo Item"}
      size="2xl"
    >
      <ModalBody>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input
                label="Nome do Item *"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                error={errors.nome}
                placeholder="Ex: Caixa de Som Line Array"
              />
            </div>
            <Input
              label="Código"
              value={form.codigo}
              onChange={(e) => setField("codigo", e.target.value)}
              placeholder="Ex: #336-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Valor de Aluguel (R$)"
              type="number"
              value={form.valorAluguel}
              onChange={(e) => setField("valorAluguel", e.target.value)}
              placeholder="0,00"
            />
            <Input
              label="Quantidade em Estoque"
              type="number"
              value={form.quantidade}
              onChange={(e) => setField("quantidade", e.target.value)}
              placeholder="0"
            />
            <Select
              label="Tipo"
              value={form.tipo}
              onChange={(e) => setField("tipo", e.target.value)}
              options={tipoOptions}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Categoria"
              value={form.categoriaId}
              onChange={(e) => setField("categoriaId", e.target.value)}
              options={categoriaOptions}
              placeholder="Selecione a categoria"
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                Exibir no catálogo?
              </label>
              <div className="flex items-center gap-4 h-9">
                {[
                  { value: true, label: "Sim" },
                  { value: false, label: "Não" },
                ].map((opt) => (
                  <label
                    key={opt.label}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      checked={form.emCatalogo === opt.value}
                      onChange={() => setField("emCatalogo", opt.value)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Textarea
            label="Especificações / Descrição"
            value={form.especificacoes}
            onChange={(e) => setField("especificacoes", e.target.value)}
            placeholder="Detalhes técnicos, potência, dimensões..."
            rows={3}
          />
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          {form.id ? "Salvar Alterações" : "Criar"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
