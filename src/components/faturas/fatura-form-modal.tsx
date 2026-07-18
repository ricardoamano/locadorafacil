"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface OrcamentoOpt {
  id: string;
  numero: number;
  total: number;
  clienteId?: string;
  cliente?: { id: string; nomeFantasia: string };
  cliente2?: { id: string; nomeFantasia: string } | null;
}

interface PostoOpt {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string | null;
}

interface ItemOpt {
  id: string;
  nome: string;
  codigo: string;
  valorAluguel: number;
  valorSemana: number | null;
  valorQuinzena: number | null;
  valorMes: number | null;
}

interface LinhaItem {
  itemId: string;
  descricao: string;
  periodo: string;
  quantidade: number;
  valorUnitario: number;
}

interface FaturaFormData {
  id?: string;
  numero?: number;
  tipoDestinatario: string;
  emissoraId: string;
  orcamentoId: string;
  clienteId: string;
  clienteNome: string;
  mesRef: string;
  dataEmissao: string;
  dataVencimento: string;
  valor: string;
  descritivo: string;
  justificativa: string;
  itens: LinhaItem[];
}

const periodoOptions = [
  { value: "DIARIA", label: "Diária" },
  { value: "SEMANA", label: "Semana" },
  { value: "QUINZENA", label: "Quinzena" },
  { value: "MES", label: "Mês" },
];

function precoDoPeriodo(item: ItemOpt | undefined, periodo: string): number {
  if (!item) return 0;
  switch (periodo) {
    case "SEMANA":
      return item.valorSemana ?? item.valorAluguel;
    case "QUINZENA":
      return item.valorQuinzena ?? item.valorAluguel;
    case "MES":
      return item.valorMes ?? item.valorAluguel;
    default:
      return item.valorAluguel;
  }
}

function emptyForm(): FaturaFormData {
  return {
    tipoDestinatario: "CLIENTE",
    emissoraId: "",
    orcamentoId: "",
    clienteId: "",
    clienteNome: "",
    mesRef: "",
    dataEmissao: "",
    dataVencimento: "",
    valor: "",
    descritivo: "",
    justificativa: "",
    itens: [],
  };
}

interface FaturaFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
  const [postos, setPostos] = useState<PostoOpt[]>([]);
  const [itensCatalogo, setItensCatalogo] = useState<ItemOpt[]>([]);
  const [emissoras, setEmissoras] = useState<{ id: string; nome: string; cnpj: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          ...emptyForm(),
          ...initial,
          tipoDestinatario: initial.tipoDestinatario || "CLIENTE",
          emissoraId: initial.emissoraId || "",
          orcamentoId: initial.orcamentoId || "",
          clienteId: initial.clienteId || "",
          mesRef: initial.mesRef || "",
          dataEmissao: initial.dataEmissao ? initial.dataEmissao.slice(0, 10) : "",
          dataVencimento: initial.dataVencimento
            ? initial.dataVencimento.slice(0, 10)
            : "",
          valor: initial.valor != null ? String(initial.valor) : "",
          descritivo: initial.descritivo || "",
          justificativa: initial.justificativa || "",
          itens: (initial.itens || []).map((i: any) => ({
            itemId: i.itemId || "",
            descricao: i.descricao,
            periodo: i.periodo || "DIARIA",
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
          })),
        });
      } else {
        setForm(emptyForm());
      }
      fetch("/api/orcamentos?status=APROVADO&limit=100")
        .then((r) => r.json())
        .then((d) => setOrcamentos(d.orcamentos || []))
        .catch(() => setOrcamentos([]));
      fetch("/api/contacts?type=CLIENTE&postos=1&limit=200")
        .then((r) => r.json())
        .then((d) => setPostos(d.contacts || []))
        .catch(() => setPostos([]));
      fetch("/api/itens?limit=200")
        .then((r) => r.json())
        .then((d) => setItensCatalogo(d.itens || []))
        .catch(() => setItensCatalogo([]));
      fetch("/api/empresa/emissoras")
        .then((r) => (r.ok ? r.json() : { emissoras: [] }))
        .then((d) =>
          setEmissoras(
            (d.emissoras || []).filter((e: { ativo?: boolean }) => e.ativo !== false)
          )
        )
        .catch(() => setEmissoras([]));
    }
  }, [open, initial]);

  function setField<K extends keyof FaturaFormData>(key: K, value: FaturaFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const emitida = !!initial?.snapshot;

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

  function handlePosto(postoId: string) {
    const p = postos.find((x) => x.id === postoId);
    setForm((prev) => ({
      ...prev,
      clienteId: postoId,
      clienteNome: p?.nomeFantasia || p?.razaoSocial || "",
    }));
  }

  // Itens
  function addLinha() {
    setField("itens", [
      ...form.itens,
      { itemId: "", descricao: "", periodo: "DIARIA", quantidade: 1, valorUnitario: 0 },
    ]);
  }
  function removeLinha(i: number) {
    setField("itens", form.itens.filter((_, idx) => idx !== i));
  }
  function setLinha(i: number, patch: Partial<LinhaItem>) {
    const arr = [...form.itens];
    arr[i] = { ...arr[i], ...patch };
    setField("itens", arr);
  }

  const totalItens = form.itens.reduce(
    (acc, l) => acc + (l.quantidade || 0) * (l.valorUnitario || 0),
    0
  );
  const totalFinal = form.itens.length > 0 ? totalItens : parseFloat(form.valor) || 0;
  const isDireta = !form.orcamentoId;

  async function handleSubmit() {
    if (!form.clienteNome.trim()) {
      toast("Informe o destinatário.", "error");
      return;
    }
    if (!form.dataEmissao || !form.dataVencimento) {
      toast("Informe as datas de emissão e vencimento.", "error");
      return;
    }
    if (totalFinal <= 0) {
      toast("Informe o valor ou adicione itens.", "error");
      return;
    }
    setLoading(true);
    try {
      const url = form.id ? `/api/faturas/${form.id}` : "/api/faturas";
      const res = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          valor: totalFinal,
          orcamentoId: form.orcamentoId || null,
          clienteId: form.clienteId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Erro ao salvar.", "error");
        return;
      }
      toast(
        form.id
          ? "Fatura atualizada com sucesso!"
          : isDireta
          ? "Fatura criada! Receita gerada automaticamente no Financeiro."
          : "Fatura criada com sucesso!",
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? `Editar Fatura #${initial.numero}` : "Nova Fatura"}
      size="2xl"
    >
      <ModalBody>
        {emitida && (
          <p className="mb-4 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Esta fatura já foi emitida e não pode mais ser alterada.
          </p>
        )}
        <div className={`space-y-4 ${emitida ? "opacity-60 pointer-events-none" : ""}`}>
          {/* Empresa emissora — faturar por outro CNPJ do grupo */}
          {emissoras.length > 0 && (
            <div>
              <Select
                label="Emitir por"
                value={form.emissoraId}
                onChange={(e) => setField("emissoraId", e.target.value)}
                options={[
                  { value: "", label: "Empresa principal (padrão)" },
                  ...emissoras.map((em) => ({
                    value: em.id,
                    label: `${em.nome}${em.cnpj ? ` — ${em.cnpj}` : ""}`,
                  })),
                ]}
              />
              {form.emissoraId && (
                <p className="text-xs text-violet-600 mt-1">
                  O recibo sai com os dados/logo dessa empresa e o recebimento entra na conta dela
                  no fluxo de caixa.
                </p>
              )}
            </div>
          )}

          {/* Destinatário */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Tipo de Destinatário"
              value={form.tipoDestinatario}
              onChange={(e) => {
                setField("tipoDestinatario", e.target.value);
                setField("clienteId", "");
                setField("clienteNome", "");
              }}
              options={[
                { value: "CLIENTE", label: "Cliente" },
                { value: "POSTO", label: "Posto de Serviço" },
              ]}
            />
            {form.tipoDestinatario === "POSTO" ? (
              <div className="sm:col-span-2">
                <Select
                  label="Posto de Serviço *"
                  searchable
                  value={form.clienteId}
                  onChange={(e) => handlePosto(e.target.value)}
                  options={postos.map((p) => ({
                    value: p.id,
                    label: `${p.nomeFantasia}${p.cnpj ? ` — ${p.cnpj}` : ""}`,
                  }))}
                  placeholder="Pesquise por nome, razão social ou CNPJ"
                />
                {postos.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Nenhum cliente marcado como Posto de Serviço Oficial.
                  </p>
                )}
              </div>
            ) : (
              <>
                <Select
                  label="Orçamento Aprovado"
                  value={form.orcamentoId}
                  onChange={(e) => handleOrcamento(e.target.value)}
                  options={orcamentos.map((o) => ({
                    value: o.id,
                    label: `#${o.numero}${o.cliente ? ` — ${o.cliente.nomeFantasia}` : ""}${o.cliente2 ? ` / ${o.cliente2.nomeFantasia}` : ""}`,
                  }))}
                  placeholder="Opcional (emissão direta sem orçamento)"
                />
                {(() => {
                  const orcSel = orcamentos.find((o) => o.id === form.orcamentoId);
                  if (!orcSel?.cliente2) return null;
                  return (
                    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                      <Select
                        label="Emitir fatura contra"
                        value={form.clienteId}
                        onChange={(e) => {
                          const escolhido =
                            e.target.value === orcSel.cliente2!.id
                              ? orcSel.cliente2!
                              : orcSel.cliente!;
                          setForm((prev) => ({
                            ...prev,
                            clienteId: escolhido.id,
                            clienteNome: escolhido.nomeFantasia,
                          }));
                        }}
                        options={[
                          {
                            value: orcSel.cliente!.id,
                            label: `${orcSel.cliente!.nomeFantasia} (cliente 1)`,
                          },
                          {
                            value: orcSel.cliente2.id,
                            label: `${orcSel.cliente2.nomeFantasia} (cliente 2)`,
                          },
                        ]}
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Este orçamento tem dois clientes — escolha contra quem a fatura
                        será emitida.
                      </p>
                    </div>
                  );
                })()}
                <Input
                  label="Nome do Cliente *"
                  value={form.clienteNome}
                  onChange={(e) => setField("clienteNome", e.target.value)}
                  placeholder="Preenchido ao selecionar orçamento"
                />
              </>
            )}
          </div>

          {isDireta && (
            <Input
              label="Justificativa da emissão direta"
              value={form.justificativa}
              onChange={(e) => setField("justificativa", e.target.value)}
              placeholder="Ex: Locação mensal recorrente do posto"
            />
          )}

          {/* Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            />
            <Input
              label="Data de Vencimento *"
              type="date"
              value={form.dataVencimento}
              onChange={(e) => setField("dataVencimento", e.target.value)}
            />
          </div>

          {/* Itens */}
          <div className="border border-slate-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Produtos e Serviços (opcional)
              </p>
              <span className="text-sm font-bold text-slate-900">
                {formatCurrency(totalFinal)}
              </span>
            </div>

            {form.itens.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end mb-2">
                <div className="col-span-12 sm:col-span-4">
                  <Select
                    label={i === 0 ? "Item do catálogo" : undefined}
                    value={l.itemId}
                    onChange={(e) => {
                      const it = itensCatalogo.find((x) => x.id === e.target.value);
                      setLinha(i, {
                        itemId: e.target.value,
                        descricao: it ? it.nome : l.descricao,
                        valorUnitario: precoDoPeriodo(it, l.periodo),
                      });
                    }}
                    options={itensCatalogo.map((it) => ({
                      value: it.id,
                      label: `${it.codigo ? it.codigo + " — " : ""}${it.nome}`,
                    }))}
                    placeholder="Livre / selecione"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Select
                    label={i === 0 ? "Período" : undefined}
                    value={l.periodo}
                    onChange={(e) => {
                      const it = itensCatalogo.find((x) => x.id === l.itemId);
                      setLinha(i, {
                        periodo: e.target.value,
                        valorUnitario: it
                          ? precoDoPeriodo(it, e.target.value)
                          : l.valorUnitario,
                      });
                    }}
                    options={periodoOptions}
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Input
                    label={i === 0 ? "Qtd" : undefined}
                    type="number"
                    min={1}
                    value={String(l.quantidade)}
                    onChange={(e) =>
                      setLinha(i, { quantidade: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Input
                    label={i === 0 ? "Valor Unit." : undefined}
                    type="number"
                    step="0.01"
                    value={String(l.valorUnitario)}
                    onChange={(e) =>
                      setLinha(i, { valorUnitario: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="col-span-10 sm:col-span-2">
                  <Input
                    label={i === 0 ? "Descrição" : undefined}
                    value={l.descricao}
                    onChange={(e) => setLinha(i, { descricao: e.target.value })}
                    placeholder="Descrição"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 pb-1.5 text-right">
                  <button
                    onClick={() => removeLinha(i)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={addLinha}>
                <Plus className="h-4 w-4" />
                Adicionar Item
              </Button>
              {form.itens.length === 0 && (
                <div className="w-40">
                  <Input
                    label="Ou valor total (R$)"
                    type="number"
                    step="0.01"
                    value={form.valor}
                    onChange={(e) => setField("valor", e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              )}
            </div>
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
          {emitida ? "Fechar" : "Cancelar"}
        </Button>
        {!emitida && (
          <Button onClick={handleSubmit} loading={loading}>
            {form.id ? "Salvar Alterações" : "Criar Fatura"}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
