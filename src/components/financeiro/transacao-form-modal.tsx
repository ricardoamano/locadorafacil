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
interface OrcamentoOpt {
  id: string;
  numero: number;
  cliente?: { nomeFantasia: string };
}

interface TransacaoFormData {
  id?: string;
  nome: string;
  dataRecebimento: string;
  tipo: string;
  categoriaId: string;
  orcamentoId: string;
  valor: string;
  observacao: string;
  notaFiscal: boolean;
  status: string;
}

const tipoOptions = [
  { value: "RECEITA", label: "Receita" },
  { value: "DESPESA", label: "Despesa" },
];

const statusOptions = [
  { value: "PAGO", label: "Pago" },
  { value: "PENDENTE", label: "Pendente" },
  { value: "ATRASADO", label: "Atrasado" },
];

function emptyForm(): TransacaoFormData {
  return {
    nome: "",
    dataRecebimento: "",
    tipo: "RECEITA",
    categoriaId: "",
    orcamentoId: "",
    valor: "",
    observacao: "",
    notaFiscal: false,
    status: "PENDENTE",
  };
}

interface TransacaoFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial?: any;
}

export function TransacaoFormModal({
  open,
  onClose,
  onSuccess,
  initial,
}: TransacaoFormModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<TransacaoFormData>(emptyForm());
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof TransacaoFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setErrors({});
      if (initial) {
        setForm({
          ...emptyForm(),
          ...initial,
          dataRecebimento: initial.dataRecebimento
            ? initial.dataRecebimento.slice(0, 10)
            : "",
          valor: initial.valor != null ? String(initial.valor) : "",
          categoriaId: initial.categoriaId || "",
          orcamentoId: initial.orcamentoId || "",
          observacao: initial.observacao || "",
        });
      } else {
        setForm(emptyForm());
      }
      fetch("/api/categorias?tipo=FINANCEIRO")
        .then((r) => r.json())
        .then((d) => setCategorias(d.categorias || []))
        .catch(() => setCategorias([]));
      fetch("/api/orcamentos?limit=100")
        .then((r) => r.json())
        .then((d) => setOrcamentos(d.orcamentos || []))
        .catch(() => setOrcamentos([]));
    }
  }, [open, initial]);

  function setField<K extends keyof TransacaoFormData>(key: K, value: TransacaoFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.nome.trim()) errs.nome = "Campo obrigatório";
    if (!form.dataRecebimento) errs.dataRecebimento = "Campo obrigatório";
    if (!form.valor || parseFloat(form.valor) <= 0) errs.valor = "Informe o valor";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const url = form.id ? `/api/transacoes/${form.id}` : "/api/transacoes";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          valor: parseFloat(form.valor) || 0,
          categoriaId: form.categoriaId || null,
          orcamentoId: form.orcamentoId || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast(
        form.id
          ? "Transação atualizada com sucesso!"
          : "Transação criada com sucesso!",
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
  const orcamentoOptions = orcamentos.map((o) => ({
    value: o.id,
    label: `#${o.numero}${o.cliente ? ` — ${o.cliente.nomeFantasia}` : ""}`,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? "Editar Transação" : "Nova Transação"}
      size="xl"
    >
      <ModalBody>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input
                label="Nome da Transação *"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                error={errors.nome}
                placeholder="Ex: Pagamento evento XYZ"
              />
            </div>
            <Select
              label="Tipo"
              value={form.tipo}
              onChange={(e) => setField("tipo", e.target.value)}
              options={tipoOptions}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Data *"
              type="date"
              value={form.dataRecebimento}
              onChange={(e) => setField("dataRecebimento", e.target.value)}
              error={errors.dataRecebimento}
            />
            <Input
              label="Valor (R$) *"
              type="number"
              step="0.01"
              value={form.valor}
              onChange={(e) => setField("valor", e.target.value)}
              error={errors.valor}
              placeholder="0,00"
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
              options={statusOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Categoria"
              value={form.categoriaId}
              onChange={(e) => setField("categoriaId", e.target.value)}
              options={categoriaOptions}
              placeholder="Selecione (opcional)"
            />
            <Select
              label="Orçamento Vinculado"
              value={form.orcamentoId}
              onChange={(e) => setField("orcamentoId", e.target.value)}
              options={orcamentoOptions}
              placeholder="Selecione (opcional)"
            />
          </div>

          <Textarea
            label="Observação"
            value={form.observacao}
            onChange={(e) => setField("observacao", e.target.value)}
            placeholder="Detalhes adicionais..."
            rows={2}
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.notaFiscal}
              onChange={(e) => setField("notaFiscal", e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm text-slate-700">Precisa de nota fiscal?</span>
          </label>
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
