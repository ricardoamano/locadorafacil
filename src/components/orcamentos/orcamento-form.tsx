"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
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
  apelidos?: string | null;
  descricaoComercial?: string | null;
  codigo: string;
  valorAluguel: number;
}

interface SalaItemForm {
  itemId: string;
  quantidade: number;
  valorUnitario: number;
  descricaoComercial: string;
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
  dataMontagem: string;
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

const pagamentoFallback = [
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
    dataMontagem: "",
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
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
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
  const [pagamentoOptions, setPagamentoOptions] = useState(pagamentoFallback);
  const [tiposEvento, setTiposEvento] = useState<string[]>([]);
  const [novoLocalOpen, setNovoLocalOpen] = useState(false);
  const [novoLocal, setNovoLocal] = useState({ nome: "", rua: "", cidade: "", observacoes: "" });
  const [salvandoLocal, setSalvandoLocal] = useState(false);
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [novoCliente, setNovoCliente] = useState({
    razaoSocial: "", cnpj: "", email: "", telefone: "", rua: "", cidade: "",
  });
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [novoItemAlvo, setNovoItemAlvo] = useState<{ si: number; ii: number } | null>(null);
  const [novoItem, setNovoItem] = useState({
    codigo: "", nome: "", descricaoComercial: "", categoriaId: "", valor: "", especificacoes: "",
  });
  const [salvandoItem, setSalvandoItem] = useState(false);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
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
    fetch("/api/metodos-pagamento?ativos=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.metodos?.length) {
          setPagamentoOptions(
            d.metodos.map((m: { nome: string }) => ({ value: m.nome, label: m.nome }))
          );
        }
      })
      .catch(() => {});
    fetch("/api/tipos-evento")
      .then((r) => r.json())
      .then((d) => setTiposEvento(d.tipos || []))
      .catch(() => {});
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias || d || []))
      .catch(() => {});
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
        dataMontagem: initial.dataMontagem ? initial.dataMontagem.slice(0, 10) : "",
        dataInicio: initial.dataInicio ? initial.dataInicio.slice(0, 10) : "",
        dataFim: initial.dataFim ? initial.dataFim.slice(0, 10) : "",
        observacoes: initial.observacoes || "",
        obsInternas: initial.obsInternas || "",
        formaPagamento: initial.formaPagamento || "",
        condicoes: initial.condicoes || "",
        desconto: initial.desconto != null ? String(initial.desconto) : "",
        descontoTipo: initial.descontoTipo || "valor",
        salas: (initial.salas || []).map(
          (s: { nome: string; itens: { itemId: string; quantidade: number; valorUnitario: number; descricaoComercial?: string | null }[] }) => ({
            nome: s.nome,
            itens: (s.itens || []).map((i) => ({
              itemId: i.itemId,
              quantidade: i.quantidade,
              valorUnitario: i.valorUnitario,
              descricaoComercial: i.descricaoComercial || "",
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
      itens: [...salas[si].itens, { itemId: "", quantidade: 1, valorUnitario: 0, descricaoComercial: "" }],
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

  async function salvarNovoLocal() {
    if (!novoLocal.nome.trim()) {
      toast("Informe o nome do local.", "error");
      return;
    }
    setSalvandoLocal(true);
    try {
      const res = await fetch("/api/locais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novoLocal),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Erro ao criar local.", "error");
        return;
      }
      setLocais((prev) => [...prev, { id: data.id, nome: data.nome }]);
      set("localId", data.id);
      setNovoLocalOpen(false);
      setNovoLocal({ nome: "", rua: "", cidade: "", observacoes: "" });
      toast("Local criado e selecionado no orçamento!", "success");
    } catch {
      toast("Erro ao criar local.", "error");
    } finally {
      setSalvandoLocal(false);
    }
  }

  async function salvarNovoCliente() {
    if (!novoCliente.razaoSocial.trim()) {
      toast("Informe a razão social ou nome do cliente.", "error");
      return;
    }
    if (novoCliente.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoCliente.email.trim())) {
      toast("E-mail inválido.", "error");
      return;
    }
    setSalvandoCliente(true);
    try {
      const temContato = novoCliente.email.trim() || novoCliente.telefone.trim();
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CLIENTE",
          razaoSocial: novoCliente.razaoSocial.trim(),
          nomeFantasia: novoCliente.razaoSocial.trim(),
          cnpj: novoCliente.cnpj.trim() || null,
          rua: novoCliente.rua.trim() || null,
          cidade: novoCliente.cidade.trim() || null,
          subContacts: temContato
            ? [
                {
                  nome: novoCliente.razaoSocial.trim(),
                  email: novoCliente.email.trim() || null,
                  telefone: novoCliente.telefone.trim() || null,
                },
              ]
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Erro ao criar cliente.", "error");
        return;
      }
      setClientes((prev) => [...prev, { id: data.id, nomeFantasia: data.nomeFantasia }]);
      set("clienteId", data.id);
      setNovoClienteOpen(false);
      setNovoCliente({ razaoSocial: "", cnpj: "", email: "", telefone: "", rua: "", cidade: "" });
      toast("Cliente criado e selecionado no orçamento!", "success");
    } catch {
      toast("Erro ao criar cliente.", "error");
    } finally {
      setSalvandoCliente(false);
    }
  }

  async function salvarNovoItem() {
    if (!novoItem.codigo.trim() || !novoItem.nome.trim() || !novoItem.categoriaId || !novoItem.valor.trim()) {
      toast("Preencha código, nome, categoria e valor padrão.", "error");
      return;
    }
    // Aceita vírgula ou ponto como separador decimal (ex.: 350,00 / 350.00 / 1.234,56)
    const valorTxt = novoItem.valor.trim();
    const valor = valorTxt.includes(",")
      ? parseFloat(valorTxt.replace(/\./g, "").replace(",", "."))
      : parseFloat(valorTxt);
    if (!valor || valor <= 0) {
      toast("Valor padrão inválido.", "error");
      return;
    }
    setSalvandoItem(true);
    try {
      const res = await fetch("/api/itens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: novoItem.codigo.trim(),
          nome: novoItem.nome.trim(),
          descricaoComercial: novoItem.descricaoComercial.trim() || null,
          categoriaId: novoItem.categoriaId,
          valorAluguel: valor,
          especificacoes: novoItem.especificacoes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Erro ao criar item.", "error");
        return;
      }
      setItens((prev) => [...prev, data]);
      if (novoItemAlvo) {
        setSalaItem(novoItemAlvo.si, novoItemAlvo.ii, {
          itemId: data.id,
          valorUnitario: data.valorAluguel || valor,
          descricaoComercial: data.descricaoComercial || "",
        });
      }
      setNovoItemAlvo(null);
      setNovoItem({ codigo: "", nome: "", descricaoComercial: "", categoriaId: "", valor: "", especificacoes: "" });
      toast("Item criado e selecionado no orçamento!", "success");
    } catch {
      toast("Erro ao criar item.", "error");
    } finally {
      setSalvandoItem(false);
    }
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
      const data = await res.json();
      if (data.vinculos?.criouOs || data.vinculos?.criouReceita) {
        toast(
          "Orçamento aprovado! Ordem de Serviço e receita no Financeiro geradas automaticamente.",
          "success"
        );
      } else {
        toast(
          form.id ? "Orçamento atualizado com sucesso!" : "Orçamento criado com sucesso!",
          "success"
        );
      }
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
    keywords: i.apelidos || "",
  }));
  // Inclui o valor atual mesmo que o tipo tenha sido removido das configurações
  const tipoEventoOptions = (
    form.tipoEvento && !tiposEvento.includes(form.tipoEvento)
      ? [form.tipoEvento, ...tiposEvento]
      : tiposEvento
  ).map((t) => ({ value: t, label: t }));

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
        <div className="flex items-end gap-2">
          <Select
            label="Cliente *"
            searchable
            value={form.clienteId}
            onChange={(e) => set("clienteId", e.target.value)}
            options={clienteOptions}
            placeholder="Digite para buscar o cliente"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0"
            onClick={() => setNovoClienteOpen(true)}
            title="Cadastrar novo cliente"
          >
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nome do Evento"
              value={form.eventoNome}
              onChange={(e) => set("eventoNome", e.target.value)}
              placeholder="Ex: Convenção de Vendas 2026"
            />
            <Select
              label="Tipo de Evento"
              value={form.tipoEvento}
              onChange={(e) => set("tipoEvento", e.target.value)}
              options={tipoEventoOptions}
              placeholder="Selecione o tipo"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Input
              label="Data de Montagem"
              type="date"
              value={form.dataMontagem}
              onChange={(e) => set("dataMontagem", e.target.value)}
            />
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
            <div className="flex items-end gap-2">
              <Select
                label="Local"
                searchable
                value={form.localId}
                onChange={(e) => set("localId", e.target.value)}
                options={localOptions}
                placeholder="Digite para buscar o local"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                onClick={() => setNovoLocalOpen(true)}
                title="Cadastrar novo local"
              >
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            </div>
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
                      <div className="flex items-end gap-1.5">
                        <Select
                          label={ii === 0 ? "Item" : undefined}
                          searchable
                          value={it.itemId}
                          onChange={(e) => {
                            const sel = itens.find((x) => x.id === e.target.value);
                            setSalaItem(si, ii, {
                              itemId: e.target.value,
                              valorUnitario: sel ? sel.valorAluguel : it.valorUnitario,
                              descricaoComercial:
                                it.descricaoComercial || sel?.descricaoComercial || "",
                            });
                          }}
                          options={itemOptions}
                          placeholder="Digite para buscar o item"
                        />
                        <button
                          type="button"
                          onClick={() => setNovoItemAlvo({ si, ii })}
                          className="h-9 w-9 shrink-0 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
                          title="Cadastrar novo item"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        value={it.descricaoComercial}
                        onChange={(e) =>
                          setSalaItem(si, ii, { descricaoComercial: e.target.value.slice(0, 100) })
                        }
                        placeholder="Descrição comercial (visível ao cliente e à equipe)..."
                        className="mt-1 h-7 w-full rounded-md border border-dashed border-slate-200 bg-transparent px-2 text-xs italic text-slate-600 placeholder:not-italic placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
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

      {/* Modal de cadastro rápido de local */}
      <Modal
        open={novoLocalOpen}
        onClose={() => setNovoLocalOpen(false)}
        title="Novo Local"
      >
        <ModalBody>
          <div className="space-y-3">
            <Input
              label="Nome do Local *"
              value={novoLocal.nome}
              onChange={(e) => setNovoLocal((p) => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Centro de Convenções Rebouças"
            />
            <Input
              label="Endereço"
              value={novoLocal.rua}
              onChange={(e) => setNovoLocal((p) => ({ ...p, rua: e.target.value }))}
              placeholder="Rua, número"
            />
            <Input
              label="Cidade"
              value={novoLocal.cidade}
              onChange={(e) => setNovoLocal((p) => ({ ...p, cidade: e.target.value }))}
            />
            <Textarea
              label="Observações"
              value={novoLocal.observacoes}
              onChange={(e) => setNovoLocal((p) => ({ ...p, observacoes: e.target.value }))}
              rows={2}
            />
            <p className="text-xs text-slate-400">
              O local será criado e selecionado automaticamente neste orçamento. Você pode
              completar os demais dados depois em Cadastros → Locais.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setNovoLocalOpen(false)} disabled={salvandoLocal}>
            Cancelar
          </Button>
          <Button onClick={salvarNovoLocal} loading={salvandoLocal}>
            Criar e selecionar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal de cadastro rápido de cliente */}
      <Modal
        open={novoClienteOpen}
        onClose={() => setNovoClienteOpen(false)}
        title="Novo Cliente"
      >
        <ModalBody>
          <div className="space-y-3">
            <Input
              label="Razão Social / Nome *"
              value={novoCliente.razaoSocial}
              onChange={(e) => setNovoCliente((p) => ({ ...p, razaoSocial: e.target.value }))}
              placeholder="Ex: Eventos Brasil Ltda"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="CNPJ / CPF"
                value={novoCliente.cnpj}
                onChange={(e) => setNovoCliente((p) => ({ ...p, cnpj: e.target.value }))}
              />
              <Input
                label="Telefone"
                value={novoCliente.telefone}
                onChange={(e) => setNovoCliente((p) => ({ ...p, telefone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <Input
              label="E-mail"
              type="email"
              value={novoCliente.email}
              onChange={(e) => setNovoCliente((p) => ({ ...p, email: e.target.value }))}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Endereço"
                value={novoCliente.rua}
                onChange={(e) => setNovoCliente((p) => ({ ...p, rua: e.target.value }))}
                placeholder="Rua, número"
              />
              <Input
                label="Cidade"
                value={novoCliente.cidade}
                onChange={(e) => setNovoCliente((p) => ({ ...p, cidade: e.target.value }))}
              />
            </div>
            <p className="text-xs text-slate-400">
              O cliente será criado e selecionado automaticamente neste orçamento. Complete os
              demais dados depois em Cadastros → Clientes.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setNovoClienteOpen(false)} disabled={salvandoCliente}>
            Cancelar
          </Button>
          <Button onClick={salvarNovoCliente} loading={salvandoCliente}>
            Criar e selecionar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal de cadastro rápido de item */}
      <Modal
        open={novoItemAlvo !== null}
        onClose={() => setNovoItemAlvo(null)}
        title="Novo Item"
      >
        <ModalBody>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Código / SKU *"
                value={novoItem.codigo}
                onChange={(e) => setNovoItem((p) => ({ ...p, codigo: e.target.value }))}
                placeholder="Ex: #336-1"
              />
              <div className="sm:col-span-2">
                <Input
                  label="Nome do Item *"
                  value={novoItem.nome}
                  onChange={(e) => setNovoItem((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Caixa de Som Line Array"
                />
              </div>
            </div>
            <Input
              label="Descrição Comercial"
              value={novoItem.descricaoComercial}
              onChange={(e) =>
                setNovoItem((p) => ({ ...p, descricaoComercial: e.target.value.slice(0, 100) }))
              }
              placeholder="Ex: Caixa de som para retorno de palco"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Categoria *"
                value={novoItem.categoriaId}
                onChange={(e) => setNovoItem((p) => ({ ...p, categoriaId: e.target.value }))}
                options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
                placeholder="Selecione"
              />
              <Input
                label="Valor Padrão (diária) *"
                value={novoItem.valor}
                onChange={(e) => setNovoItem((p) => ({ ...p, valor: e.target.value }))}
                placeholder="Ex: 350,00"
              />
            </div>
            <Textarea
              label="Observações"
              value={novoItem.especificacoes}
              onChange={(e) => setNovoItem((p) => ({ ...p, especificacoes: e.target.value }))}
              rows={2}
            />
            <p className="text-xs text-slate-400">
              O item será criado e selecionado automaticamente na linha do orçamento. O código não
              pode repetir um item já cadastrado.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setNovoItemAlvo(null)} disabled={salvandoItem}>
            Cancelar
          </Button>
          <Button onClick={salvarNovoItem} loading={salvandoItem}>
            Criar e selecionar
          </Button>
        </ModalFooter>
      </Modal>

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
