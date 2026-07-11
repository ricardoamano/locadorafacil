"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  User,
  CalendarDays,
  LayoutGrid,
  MessageSquare,
  CreditCard,
  Percent,
  Lock,
} from "lucide-react";

interface Cliente {
  id: string;
  nomeFantasia: string;
}
interface LocalOpt {
  id: string;
  nome: string;
}
interface ItemOpt {
  id: string;
  nome: string;
  codigo: string;
  valorAluguel: number;
}

interface SalaItemForm {
  itemId: string;
  quantidade: number;
  valorUnitario: number;
}
interface SalaForm {
  nome: string;
  itens: SalaItemForm[];
}

export interface OrcamentoFormValue {
  id?: string;
  numero?: number;
  clienteId: string;
  status: string;
  eventoNome: string;
  tipoEvento: string;
  localId: string;
  dataInicio: string;
  dataFim: string;
  observacoes: string;
  obsInternas: string;
  formaPagamento: string;
  condicoes: string;
  desconto: string;
  descontoTipo: string;
  salas: SalaForm[];
}

const statusOptions = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "AGUARDANDO", label: "Aguardando" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "REPROVADO", label: "Reprovado" },
  { value: "CANCELADO", label: "Cancelado" },
];

const pagamentoOptions = [
  { value: "PIX", label: "PIX" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CARTAO", label: "Cartão" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "PARCELADO", label: "Parcelado" },
];

function emptyValue(): OrcamentoFormValue {
  return {
    clienteId: "",
    status: "PENDENTE",
    eventoNome: "",
    tipoEvento: "",
    localId: "",
    dataInicio: "",
    dataFim: "",
    observacoes: "",
    obsInternas: "",
    formaPagamento: "",
    condicoes: "",
    desconto: "",
    descontoTipo: "valor",
    salas: [],
  };
}

function Section({
  icon: Icon,
  title,
  filled,
  open,
  onToggle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  filled: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-blue-600" />
        </div>
        <span className="flex-1 text-left text-sm font-semibold text-slate-900">
          {title}
        </span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            filled
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {filled ? "Preenchido" : "Pendente"}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-slate-50">{children}</div>}
    </div>
  );
}

export function OrcamentoForm({
  initial,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial?: any;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<OrcamentoFormValue>(emptyValue());
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [locais, setLocais] = useState<LocalOpt[]>([]);
  const [itens, setItens] = useState<ItemOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    cliente: true,
    evento: false,
    salas: false,
    obs: false,
    pagamento: false,
    desconto: false,
    interno: false,
  });

  useEffect(() => {
    fetch("/api/contacts?type=CLIENTE&limit=200")
      .then((r) => r.json())
      .then((d) => setClientes(d.contacts || []));
    fetch("/api/locais?limit=200")
      .then((r) => r.json())
      .then((d) => setLocais(d.locais || []));
    fetch("/api/itens?limit=200")
      .then((r) => r.json())
      .then((d) => setItens(d.itens || []));
  }, []);

  useEffect(() => {
    if (initial) {
      setForm({
        id: initial.id,
        numero: initial.numero,
        clienteId: initial.clienteId || "",
        status: initial.status || "PENDENTE",
        eventoNome: initial.eventoNome || "",
        tipoEvento: initial.tipoEvento || "",
        localId: initial.localId || "",
        dataInicio: initial.dataInicio ? initial.dataInicio.slice(0, 10) : "",
        dataFim: initial.dataFim ? initial.dataFim.slice(0, 10) : "",
        observacoes: initial.observacoes || "",
        obsInternas: initial.obsInternas || "",
        formaPagamento: initial.formaPagamento || "",
        condicoes: initial.condicoes || "",
        desconto: initial.desconto != null ? String(initial.desconto) : "",
        descontoTipo: initial.descontoTipo || "valor",
        salas: (initial.salas || []).map(
          (s: { nome: string; itens: { itemId: string; quantidade: number; valorUnitario: number }[] }) => ({
            nome: s.nome,
            itens: (s.itens || []).map((i) => ({
              itemId: i.itemId,
              quantidade: i.quantidade,
              valorUnitario: i.valorUnitario,
            })),
          })
        ),
      });
    }
  }, [initial]);

  function set<K extends keyof OrcamentoFormValue>(key: K, value: OrcamentoFormValue[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function toggle(key: string) {
    setOpen((p) => ({ ...p, [key]: !p[key] }));
  }

  // Salas
  function addSala() {
    set("salas", [...form.salas, { nome: `Sala ${form.salas.length + 1}`, itens: [] }]);
  }
  function removeSala(si: number) {
    set("salas", form.salas.filter((_, i) => i !== si));
  }
  function setSalaNome(si: number, nome: string) {
    const salas = [...form.salas];
    salas[si] = { ...salas[si], nome };
    set("salas", salas);
  }
  function addSalaItem(si: number) {
    const salas = [...form.salas];
    salas[si] = {
      ...salas[si],
      itens: [...salas[si].itens, { itemId: "", quantidade: 1, valorUnitario: 0 }],
    };
    set("salas", salas);
  }
  function removeSalaItem(si: number, ii: number) {
    const salas = [...form.salas];
    salas[si] = { ...salas[si], itens: salas[si].itens.filter((_, i) => i !== ii) };
    set("salas", salas);
  }
  function setSalaItem(si: number, ii: number, patch: Partial<SalaItemForm>) {
    const salas = [...form.salas];
    const itensArr = [...salas[si].itens];
    itensArr[ii] = { ...itensArr[ii], ...patch };
    salas[si] = { ...salas[si], itens: itensArr };
    set("salas", salas);
  }

  const bruto = useMemo(
    () =>
      form.salas.reduce(
        (acc, s) =>
          acc + s.itens.reduce((a, i) => a + (i.quantidade || 0) * (i.valorUnitario || 0), 0),
        0
      ),
    [form.salas]
  );
  const descontoNum = parseFloat(form.desconto) || 0;
  const descontoValor =
    form.descontoTipo === "percentual" ? (bruto * descontoNum) / 100 : descontoNum;
  const total = Math.max(0, bruto - descontoValor);

  async function handleSubmit() {
    if (!form.clienteId) {
      toast("Selecione o cliente.", "error");
      setOpen((p) => ({ ...p, cliente: true }));
      return;
    }
    setLoading(true);
    try {
      const url = form.id ? `/api/orcamentos/${form.id}` : "/api/orcamentos";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast(
        form.id ? "Orçamento atualizado com sucesso!" : "Orçamento criado com sucesso!",
        "success"
      );
      router.push("/orcamentos");
    } catch {
      toast("Erro ao salvar. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  }

  const clienteOptions = clientes.map((c) => ({ value: c.id, label: c.nomeFantasia }));
  const localOptions = locais.map((l) => ({ value: l.id, label: l.nome }));
  const itemOptions = itens.map((i) => ({
    value: i.id,
    label: `${i.codigo ? i.codigo + " — " : ""}${i.nome}`,
  }));

  return (
    <div className="max-w-4xl space-y-3">
      {/* Status + número */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {form.numero ? `Orçamento #${form.numero}` : "Novo Orçamento"}
          </p>
          <p className="text-xs text-slate-400">
            Total calculado: <span className="font-semibold text-slate-700">{formatCurrency(total)}</span>
          </p>
        </div>
        <div className="w-44">
          <Select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            options={statusOptions}
          />
        </div>
      </div>

      {/* 1. Cliente */}
      <Section
        icon={User}
        title="1. Cliente"
        filled={!!form.clienteId}
        open={open.cliente}
        onToggle={() => toggle("cliente")}
      >
        <Select
          label="Cliente *"
          value={form.clienteId}
          onChange={(e) => set("clienteId", e.target.value)}
          options={clienteOptions}
          placeholder="Selecione o cliente"
        />
      </Section>

      {/* 2. Evento */}
      <Section
        icon={CalendarDays}
        title="2. Evento"
        filled={!!form.eventoNome || !!form.dataInicio}
        open={open.evento}
        onToggle={() => toggle("evento")}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nome do Evento"
              value={form.eventoNome}
              onChange={(e) => set("eventoNome", e.target.value)}
              placeholder="Ex: Convenção de Vendas 2026"
            />
            <Input
              label="Tipo de Evento"
              value={form.tipoEvento}
              onChange={(e) => set("tipoEvento", e.target.value)}
              placeholder="Ex: Corporativo, Show, Feira..."
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Data de Início"
              type="date"
              value={form.dataInicio}
              onChange={(e) => set("dataInicio", e.target.value)}
            />
            <Input
              label="Data de Fim"
              type="date"
              value={form.dataFim}
              onChange={(e) => set("dataFim", e.target.value)}
            />
            <Select
              label="Local"
              value={form.localId}
              onChange={(e) => set("localId", e.target.value)}
              options={localOptions}
              placeholder="Selecione o local"
            />
          </div>
        </div>
      </Section>

      {/* 3. Salas / Equipamentos */}
      <Section
        icon={LayoutGrid}
        title="3. Salas e Equipamentos"
        filled={form.salas.length > 0}
        open={open.salas}
        onToggle={() => toggle("salas")}
      >
        <div className="space-y-4">
          {form.salas.map((sala, si) => {
            const subtotalSala = sala.itens.reduce(
              (a, i) => a + (i.quantidade || 0) * (i.valorUnitario || 0),
              0
            );
            return (
              <div key={si} className="border border-slate-100 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Input
                      value={sala.nome}
                      onChange={(e) => setSalaNome(si, e.target.value)}
                      placeholder="Nome da sala/ambiente"
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                    {formatCurrency(subtotalSala)}
                  </span>
                  <button
                    onClick={() => removeSala(si)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    title="Remover sala"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {sala.itens.map((it, ii) => (
                  <div key={ii} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6">
                      <Select
                        label={ii === 0 ? "Item" : undefined}
                        value={it.itemId}
                        onChange={(e) => {
                          const sel = itens.find((x) => x.id === e.target.value);
                          setSalaItem(si, ii, {
                            itemId: e.target.value,
                            valorUnitario: sel ? sel.valorAluguel : it.valorUnitario,
                          });
                        }}
                        options={itemOptions}
                        placeholder="Selecione o item"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        label={ii === 0 ? "Qtd" : undefined}
                        type="number"
                        min={1}
                        value={String(it.quantidade)}
                        onChange={(e) =>
                          setSalaItem(si, ii, { quantidade: parseInt(e.target.value) || 1 })
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        label={ii === 0 ? "Valor Unit." : undefined}
                        type="number"
                        step="0.01"
                        value={String(it.valorUnitario)}
                        onChange={(e) =>
                          setSalaItem(si, ii, { valorUnitario: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="col-span-1 pb-2 text-right text-xs text-slate-500">
                      {formatCurrency((it.quantidade || 0) * (it.valorUnitario || 0))}
                    </div>
                    <div className="col-span-1 pb-1.5 text-right">
                      <button
                        onClick={() => removeSalaItem(si, ii)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={() => addSalaItem(si)}>
                  <Plus className="h-4 w-4" />
                  Adicionar Item
                </Button>
              </div>
            );
          })}

          <Button variant="outline" onClick={addSala} className="w-full">
            <Plus className="h-4 w-4" />
            Adicionar Sala/Ambiente
          </Button>
        </div>
      </Section>

      {/* 4. Observações */}
      <Section
        icon={MessageSquare}
        title="4. Observações"
        filled={!!form.observacoes}
        open={open.obs}
        onToggle={() => toggle("obs")}
      >
        <Textarea
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          placeholder="Observações visíveis ao cliente..."
          rows={3}
        />
      </Section>

      {/* 5. Pagamento */}
      <Section
        icon={CreditCard}
        title="5. Forma de Pagamento"
        filled={!!form.formaPagamento}
        open={open.pagamento}
        onToggle={() => toggle("pagamento")}
      >
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Forma de Pagamento"
            value={form.formaPagamento}
            onChange={(e) => set("formaPagamento", e.target.value)}
            options={pagamentoOptions}
            placeholder="Selecione"
          />
          <Input
            label="Condições"
            value={form.condicoes}
            onChange={(e) => set("condicoes", e.target.value)}
            placeholder="Ex: 50% na assinatura, 50% na entrega"
          />
        </div>
      </Section>

      {/* 6. Desconto */}
      <Section
        icon={Percent}
        title="6. Desconto"
        filled={!!form.desconto}
        open={open.desconto}
        onToggle={() => toggle("desconto")}
      >
        <div className="grid grid-cols-3 gap-3 items-end">
          <Input
            label="Desconto"
            type="number"
            step="0.01"
            value={form.desconto}
            onChange={(e) => set("desconto", e.target.value)}
            placeholder="0,00"
          />
          <Select
            label="Tipo"
            value={form.descontoTipo}
            onChange={(e) => set("descontoTipo", e.target.value)}
            options={[
              { value: "valor", label: "Valor (R$)" },
              { value: "percentual", label: "Percentual (%)" },
            ]}
          />
          <div className="pb-2">
            <p className="text-xs text-slate-400">Subtotal: {formatCurrency(bruto)}</p>
            <p className="text-sm font-bold text-slate-900">
              Total final: {formatCurrency(total)}
            </p>
          </div>
        </div>
      </Section>

      {/* 7. Observações internas */}
      <Section
        icon={Lock}
        title="7. Observações Internas"
        filled={!!form.obsInternas}
        open={open.interno}
        onToggle={() => toggle("interno")}
      >
        <Textarea
          value={form.obsInternas}
          onChange={(e) => set("obsInternas", e.target.value)}
          placeholder="Anotações internas (não exibidas ao cliente)..."
          rows={3}
        />
      </Section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => router.push("/orcamentos")} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          {form.id ? "Salvar Alterações" : "Criar Orçamento"}
        </Button>
      </div>
    </div>
  );
}
