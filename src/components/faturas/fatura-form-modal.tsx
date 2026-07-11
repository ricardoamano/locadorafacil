"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

interface OrcamentoOpt {
  id: string;
  numero: number;
  total: number;
  clienteId?: string;
  cliente?: { id: string; nomeFantasia: string };
}

interface FaturaFormData {
  id?: string;
  numero?: number;
  isPostoServico: boolean;
  orcamentoId: string;
  clienteId: string;
  clienteNome: string;
  mesRef: string;
  dataEmissao: string;
  dataVencimento: string;
  valor: string;
  descritivo: string;
}

function emptyForm(): FaturaFormData {
  return {
    isPostoServico: false,
    orcamentoId: "",
    clienteId: "",
    clienteNome: "",
    mesRef: "",
    dataEmissao: "",
    dataVencimento: "",
    valor: "",
    descritivo: "",
  };
}

interface FaturaFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial?: any;
}

export function FaturaFormModal({
  open,
  onClose,
  onSuccess,
  initial,
}: FaturaFormModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FaturaFormData>(emptyForm());
  const [orcamentos, setOrcamentos] = useState<OrcamentoOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FaturaFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setErrors({});
      if (initial) {
        setForm({
          ...emptyForm(),
          ...initial,
          orcamentoId: initial.orcamentoId || "",
          clienteId: initial.clienteId || "",
          mesRef: initial.mesRef || "",
          dataEmissao: initial.dataEmissao ? initial.dataEmissao.slice(0, 10) : "",
          dataVencimento: initial.dataVencimento
            ? initial.dataVencimento.slice(0, 10)
            : "",
          valor: initial.valor != null ? String(initial.valor) : "",
          descritivo: initial.descritivo || "",
        });
      } else {
        setForm(emptyForm());
      }
      fetch("/api/orcamentos?status=APROVADO&limit=100")
        .then((r) => r.json())
        .then((d) => setOrcamentos(d.orcamentos || []))
        .catch(() => setOrcamentos([]));
    }
  }, [open, initial]);

  function setField<K extends keyof FaturaFormData>(key: K, value: FaturaFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleOrcamento(orcId: string) {
    const orc = orcamentos.find((o) => o.id === orcId);
    setForm((prev) => ({
      ...prev,
      orcamentoId: orcId,
      clienteId: orc?.cliente?.id || prev.clienteId,
      clienteNome: orc?.cliente?.nomeFantasia || prev.clienteNome,
      valor: prev.valor || (orc ? String(orc.total) : prev.valor),
    }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.clienteNome.trim()) errs.clienteNome = "Campo obrigatório";
    if (!form.dataEmissao) errs.dataEmissao = "Campo obrigatório";
    if (!form.dataVencimento) errs.dataVencimento = "Campo obrigatório";
    if (!form.valor || parseFloat(form.valor) <= 0) errs.valor = "Informe o valor";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const url = form.id ? `/api/faturas/${form.id}` : "/api/faturas";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          valor: parseFloat(form.valor) || 0,
          orcamentoId: form.orcamentoId || null,
          clienteId: form.clienteId || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast(
        form.id ? "Fatura atualizada com sucesso!" : "Fatura criada com sucesso!",
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

  const orcamentoOptions = orcamentos.map((o) => ({
    value: o.id,
    label: `#${o.numero}${o.cliente ? ` — ${o.cliente.nomeFantasia}` : ""}`,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? `Editar Fatura #${initial.numero}` : "Nova Fatura"}
      size="xl"
    >
      <ModalBody>
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPostoServico}
              onChange={(e) => setField("isPostoServico", e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm text-slate-700">É posto de serviço?</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Orçamento Vinculado"
              value={form.orcamentoId}
              onChange={(e) => handleOrcamento(e.target.value)}
              options={orcamentoOptions}
              placeholder="Selecione um orçamento aprovado"
            />
            <Input
              label="Nome do Cliente *"
              value={form.clienteNome}
              onChange={(e) => setField("clienteNome", e.target.value)}
              error={errors.clienteNome}
              placeholder="Preenchido ao selecionar orçamento"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Mês de Referência"
              value={form.mesRef}
              onChange={(e) => setField("mesRef", e.target.value)}
              placeholder="Ex: 07/2026"
            />
            <Input
              label="Data de Emissão *"
              type="date"
              value={form.dataEmissao}
              onChange={(e) => setField("dataEmissao", e.target.value)}
              error={errors.dataEmissao}
            />
            <Input
              label="Data de Vencimento *"
              type="date"
              value={form.dataVencimento}
              onChange={(e) => setField("dataVencimento", e.target.value)}
              error={errors.dataVencimento}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Valor Total (R$) *"
              type="number"
              step="0.01"
              value={form.valor}
              onChange={(e) => setField("valor", e.target.value)}
              error={errors.valor}
              placeholder="0,00"
            />
          </div>

          <Textarea
            label="Descritivo da Nota"
            value={form.descritivo}
            onChange={(e) => setField("descritivo", e.target.value)}
            placeholder="Descrição dos serviços prestados..."
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
