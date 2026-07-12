"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { LocalFormModal } from "@/components/locais/local-form-modal";
import { ContactFormModal } from "@/components/contacts/contact-form-modal";
import { ItemFormModal } from "@/components/itens/item-form-modal";
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

interface SubContato {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cargo?: string | null;
}
interface Cliente {
  id: string;
  nomeFantasia: string;
  subContacts?: SubContato[];
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
  natureza?: string;
  codigo: string;
  quantidade?: number;
  valorAluguel: number;
}

interface SalaItemForm {
  itemId: string;
  quantidade: number;
  diarias: number;
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
  contatoId: string;
  cliente2Id: string;
  contato2Id: string;
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
    contatoId: "",
    cliente2Id: "",
    contato2Id: "",
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
  const [kits, setKits] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [kitAlvo, setKitAlvo] = useState<number | null>(null); // sala destino
  const [kitSel, setKitSel] = useState("");
  const [novoLocalOpen, setNovoLocalOpen] = useState(false);
  const [novoClienteAlvo, setNovoClienteAlvo] = useState<"clienteId" | "cliente2Id" | null>(null);
  const [novoContatoAlvo, setNovoContatoAlvo] = useState<"clienteId" | "cliente2Id" | null>(null);
  const [novoContato, setNovoContato] = useState({ nome: "", cargo: "", telefone: "", email: "" });
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [novoItemAlvo, setNovoItemAlvo] = useState<{ si: number; ii: number } | null>(null);
  const [comprometidos, setComprometidos] = useState<
    Record<string, { quantidade: number; eventos: { numero: number; evento: string | null }[] }>
  >({});
  const [reservados, setReservados] = useState<
    Record<string, { quantidade: number; eventos: { numero: number; evento: string | null }[] }>
  >({});
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
    fetch("/api/kits")
      .then((r) => r.json())
      .then((d) => setKits(d.kits || []))
      .catch(() => {});
  }, []);

  // Checagem de disponibilidade nas datas do evento (conflito de agenda)
  useEffect(() => {
    if (!form.dataInicio) {
      setComprometidos({});
      return;
    }
    const t = setTimeout(() => {
      fetch("/api/itens/disponibilidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inicio: form.dataInicio,
          fim: form.dataFim || form.dataInicio,
          excluirOrcamentoId: form.id || null,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          setComprometidos(d.comprometidos || {});
          setReservados(d.reservados || {});
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [form.dataInicio, form.dataFim, form.id]);

  useEffect(() => {
    if (initial) {
      setForm({
        id: initial.id,
        numero: initial.numero,
        clienteId: initial.clienteId || "",
        contatoId: initial.contatoId || "",
        cliente2Id: initial.cliente2Id || "",
        contato2Id: initial.contato2Id || "",
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
          (s: { nome: string; itens: { itemId: string; quantidade: number; diarias?: number | null; valorUnitario: number; descricaoComercial?: string | null }[] }) => ({
            nome: s.nome,
            itens: (s.itens || []).map((i) => ({
              itemId: i.itemId,
              quantidade: i.quantidade,
              diarias: i.diarias || 1,
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
      itens: [...salas[si].itens, { itemId: "", quantidade: 1, diarias: 1, valorUnitario: 0, descricaoComercial: "" }],
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

  // Handlers dos cadastros rápidos (formulários completos dos módulos)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onLocalCriado(l?: any) {
    if (!l?.id) return;
    setLocais((prev) => [...prev, { id: l.id, nome: l.nome }]);
    set("localId", l.id);
    toast("Local selecionado no orçamento.", "success");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onClienteCriado(c?: any) {
    if (!c?.id) return;
    setClientes((prev) => [...prev, { id: c.id, nomeFantasia: c.nomeFantasia || c.razaoSocial }]);
    set(novoClienteAlvo || "clienteId", c.id);
    toast("Cliente selecionado no orçamento.", "success");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onItemCriado(i?: any) {
    if (!i?.id) return;
    setItens((prev) => [...prev, i]);
    if (novoItemAlvo) {
      setSalaItem(novoItemAlvo.si, novoItemAlvo.ii, {
        itemId: i.id,
        valorUnitario: i.valorAluguel || 0,
        descricaoComercial: i.descricaoComercial || "",
      });
      toast("Item selecionado na linha do orçamento.", "success");
    }
  }

  async function salvarNovoContato() {
    if (!novoContatoAlvo) return;
    const clienteAlvoId = form[novoContatoAlvo];
    if (!clienteAlvoId || !novoContato.nome.trim()) {
      toast("Informe o nome do contato.", "error");
      return;
    }
    setSalvandoContato(true);
    try {
      const res = await fetch(`/api/contacts/${clienteAlvoId}/sub-contatos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novoContato),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Erro ao criar contato.", "error");
        return;
      }
      setClientes((prev) =>
        prev.map((c) =>
          c.id === clienteAlvoId
            ? { ...c, subContacts: [...(c.subContacts || []), data] }
            : c
        )
      );
      set(novoContatoAlvo === "clienteId" ? "contatoId" : "contato2Id", data.id);
      setNovoContatoAlvo(null);
      setNovoContato({ nome: "", cargo: "", telefone: "", email: "" });
      toast("Contato criado e selecionado!", "success");
    } catch {
      toast("Erro ao criar contato.", "error");
    } finally {
      setSalvandoContato(false);
    }
  }

  function aplicarKit() {
    if (kitAlvo === null || !kitSel) return;
    const kit = kits.find((k) => k.id === kitSel);
    if (!kit) return;
    const salas = [...form.salas];
    const novas = (kit.itens || []).map(
      (ki: { itemId: string; quantidade: number; item?: { valorAluguel?: number; descricaoComercial?: string | null; natureza?: string } }) => ({
        itemId: ki.itemId,
        quantidade: ki.quantidade,
        diarias: 1,
        valorUnitario: ki.item?.valorAluguel || 0,
        descricaoComercial: ki.item?.descricaoComercial || "",
      })
    );
    salas[kitAlvo] = { ...salas[kitAlvo], itens: [...salas[kitAlvo].itens, ...novas] };
    set("salas", salas);
    setKitAlvo(null);
    setKitSel("");
    toast(`Kit "${kit.nome}" adicionado (${novas.length} itens).`, "success");
  }

  const bruto = useMemo(
    () =>
      form.salas.reduce(
        (acc, s) =>
          acc + s.itens.reduce((a, i) => a + (i.quantidade || 0) * (i.diarias || 1) * (i.valorUnitario || 0), 0),
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
    const c1 = clientes.find((c) => c.id === form.clienteId);
    if ((c1?.subContacts?.length || 0) > 0 && !form.contatoId) {
      toast("Escolha o contato do cliente 1.", "error");
      setOpen((p) => ({ ...p, cliente: true }));
      return;
    }
    if (form.cliente2Id) {
      const c2 = clientes.find((c) => c.id === form.cliente2Id);
      if ((c2?.subContacts?.length || 0) > 0 && !form.contato2Id) {
        toast("Escolha o contato do cliente 2.", "error");
        setOpen((p) => ({ ...p, cliente: true }));
        return;
      }
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
    label: `${i.codigo ? i.codigo + " — " : ""}${i.nome}${
      i.natureza === "SERVICO" ? " 🛠 (serviço)" : ""
    }`,
    keywords: [i.apelidos, i.natureza === "SERVICO" ? "servico serviço" : ""]
      .filter(Boolean)
      .join(" "),
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
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <Select
              label="Cliente 1 *"
              searchable
              value={form.clienteId}
              onChange={(e) => {
                setForm((p) => ({ ...p, clienteId: e.target.value, contatoId: "" }));
              }}
              options={clienteOptions}
              placeholder="Digite para buscar o cliente"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => setNovoClienteAlvo("clienteId")}
              title="Cadastrar novo cliente"
            >
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          </div>
          {(() => {
            const c = clientes.find((x) => x.id === form.clienteId);
            if (!form.clienteId) return null;
            const contatos = c?.subContacts || [];
            if (contatos.length === 0)
              return (
                <div className="flex items-center gap-3">
                  <p className="text-xs text-amber-600">
                    Este cliente não tem contatos cadastrados.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNovoContatoAlvo("clienteId")}
                  >
                    <Plus className="h-4 w-4" />
                    Novo contato
                  </Button>
                </div>
              );
            return (
              <div className="flex items-end gap-2">
                <Select
                  label="Contato do cliente 1 *"
                  searchable
                  value={form.contatoId}
                  onChange={(e) => set("contatoId", e.target.value)}
                  options={contatos.map((ct) => ({
                    value: ct.id,
                    label: `${ct.nome}${ct.cargo ? ` (${ct.cargo})` : ""}${ct.telefone ? ` — ${ct.telefone}` : ""}`,
                  }))}
                  placeholder="Escolha o contato deste orçamento"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() => setNovoContatoAlvo("clienteId")}
                  title="Cadastrar novo contato neste cliente"
                >
                  <Plus className="h-4 w-4" />
                  Novo
                </Button>
              </div>
            );
          })()}

          <div>
            <div className="flex items-end gap-2">
              <Select
                label="Cliente 2 (opcional)"
                searchable
                clearable
                value={form.cliente2Id}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cliente2Id: e.target.value, contato2Id: "" }))
                }
                options={clienteOptions.filter((c) => c.value !== form.clienteId)}
                placeholder="Ex: cliente final, quando o Cliente 1 for a agência"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                onClick={() => setNovoClienteAlvo("cliente2Id")}
                title="Cadastrar novo cliente/agência"
              >
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Com dois clientes (ex.: agência no Cliente 1 e cliente final no
              Cliente 2), o PDF sai "Cliente 1, Cliente 2" e na fatura você escolhe
              contra quem emitir.
            </p>
            {(() => {
              if (!form.cliente2Id) return null;
              const c = clientes.find((x) => x.id === form.cliente2Id);
              const contatos = c?.subContacts || [];
              if (contatos.length === 0)
                return (
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-amber-600">
                      Este cliente não tem contatos cadastrados.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNovoContatoAlvo("cliente2Id")}
                    >
                      <Plus className="h-4 w-4" />
                      Novo contato
                    </Button>
                  </div>
                );
              return (
                <div className="mt-2 flex items-end gap-2">
                  <Select
                    label="Contato do cliente 2 *"
                    searchable
                    value={form.contato2Id}
                    onChange={(e) => set("contato2Id", e.target.value)}
                    options={contatos.map((ct) => ({
                      value: ct.id,
                      label: `${ct.nome}${ct.cargo ? ` (${ct.cargo})` : ""}${ct.telefone ? ` — ${ct.telefone}` : ""}`,
                    }))}
                    placeholder="Escolha o contato deste orçamento"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => setNovoContatoAlvo("cliente2Id")}
                    title="Cadastrar novo contato neste cliente"
                  >
                    <Plus className="h-4 w-4" />
                    Novo
                  </Button>
                </div>
              );
            })()}
          </div>
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
              (a, i) => a + (i.quantidade || 0) * (i.diarias || 1) * (i.valorUnitario || 0),
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
                              // Serviço não usa diárias
                              diarias: sel?.natureza === "SERVICO" ? 1 : it.diarias,
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
                      {(() => {
                        const sel = itens.find((x) => x.id === it.itemId);
                        if (!sel || sel.natureza === "SERVICO" || !form.dataInicio) return null;
                        const total = sel.quantidade || 0;
                        const comp = comprometidos[sel.id];
                        const res = reservados[sel.id];
                        const usado = comp?.quantidade || 0;
                        const emHold = res?.quantidade || 0;
                        const disponivelFirme = Math.max(0, total - usado);
                        const qtd = it.quantidade || 0;
                        const fmtEventos = (
                          lista?: { numero: number; evento: string | null }[]
                        ) =>
                          (lista || [])
                            .slice(0, 3)
                            .map((e) => `#${e.numero}${e.evento ? ` (${e.evento})` : ""}`)
                            .join(", ");
                        if (qtd > disponivelFirme)
                          return (
                            <p className="mt-1 text-[11px] font-medium text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">
                              ⚠ Conflito de agenda: só {disponivelFirme} de {total}{" "}
                              disponíveis nestas datas
                              {usado > 0 ? ` — ${usado} em ${fmtEventos(comp?.eventos)}` : ""}.
                            </p>
                          );
                        if (qtd > Math.max(0, disponivelFirme - emHold) && emHold > 0)
                          return (
                            <p className="mt-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                              ⏳ Atenção: {emHold} unidade(s) reservada(s) em orçamentos
                              pendentes nas mesmas datas ({fmtEventos(res?.eventos)}) —
                              quem aprovar primeiro leva.
                            </p>
                          );
                        return null;
                      })()}
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
                    <div className="col-span-1">
                      {itens.find((x) => x.id === it.itemId)?.natureza === "SERVICO" ? (
                        <div>
                          {ii === 0 && (
                            <label className="text-sm font-medium text-slate-700 block mb-1">
                              Diárias
                            </label>
                          )}
                          <p
                            className="h-9 flex items-center justify-center rounded-md border border-dashed border-slate-200 text-sm text-slate-300"
                            title="Serviço não usa diárias"
                          >
                            —
                          </p>
                        </div>
                      ) : (
                        <Input
                          label={ii === 0 ? "Diárias" : undefined}
                          type="number"
                          min={1}
                          value={String(it.diarias)}
                          onChange={(e) =>
                            setSalaItem(si, ii, { diarias: parseInt(e.target.value) || 1 })
                          }
                        />
                      )}
                    </div>
                    <div className="col-span-1">
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
                      {formatCurrency((it.quantidade || 0) * (it.diarias || 1) * (it.valorUnitario || 0))}
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

                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => addSalaItem(si)}>
                    <Plus className="h-4 w-4" />
                    Adicionar Item
                  </Button>
                  {kits.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setKitAlvo(si);
                        setKitSel("");
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar Kit
                    </Button>
                  )}
                </div>
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

      {/* Cadastros rápidos — mesmos formulários dos módulos */}
      <LocalFormModal
        open={novoLocalOpen}
        onClose={() => setNovoLocalOpen(false)}
        onSuccess={onLocalCriado}
      />
      <ContactFormModal
        open={novoClienteAlvo !== null}
        onClose={() => setNovoClienteAlvo(null)}
        onSuccess={onClienteCriado}
        type="CLIENTE"
      />
      <ItemFormModal
        open={novoItemAlvo !== null}
        onClose={() => setNovoItemAlvo(null)}
        onSuccess={onItemCriado}
      />

      {/* Modal de novo contato do cliente */}
      <Modal
        open={novoContatoAlvo !== null}
        onClose={() => setNovoContatoAlvo(null)}
        title={`Novo Contato — ${
          clientes.find((c) => c.id === (novoContatoAlvo ? form[novoContatoAlvo] : ""))
            ?.nomeFantasia || "cliente"
        }`}
      >
        <ModalBody>
          <div className="space-y-3">
            <Input
              label="Nome do Contato *"
              value={novoContato.nome}
              onChange={(e) => setNovoContato((p) => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Juliana Mucciolo"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Cargo"
                value={novoContato.cargo}
                onChange={(e) => setNovoContato((p) => ({ ...p, cargo: e.target.value }))}
                placeholder="Ex: Produtora"
              />
              <Input
                label="Telefone"
                value={novoContato.telefone}
                onChange={(e) => setNovoContato((p) => ({ ...p, telefone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <Input
              label="E-mail"
              type="email"
              value={novoContato.email}
              onChange={(e) => setNovoContato((p) => ({ ...p, email: e.target.value }))}
            />
            <p className="text-xs text-slate-400">
              O contato será criado no cadastro do cliente e selecionado neste orçamento.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setNovoContatoAlvo(null)} disabled={salvandoContato}>
            Cancelar
          </Button>
          <Button onClick={salvarNovoContato} loading={salvandoContato}>
            Criar e selecionar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal de kit */}
      <Modal open={kitAlvo !== null} onClose={() => setKitAlvo(null)} title="Adicionar Kit">
        <ModalBody>
          <div className="space-y-3">
            <Select
              label="Kit / Pacote"
              searchable
              value={kitSel}
              onChange={(e) => setKitSel(e.target.value)}
              options={kits.map((k) => ({
                value: k.id,
                label: `${k.nome} (${(k.itens || []).length} itens)`,
              }))}
              placeholder="Escolha o kit"
            />
            {kitSel && (
              <ul className="text-xs text-slate-600 space-y-0.5 border border-slate-100 rounded-lg p-3">
                {(kits.find((k) => k.id === kitSel)?.itens || []).map(
                  (ki: { id: string; quantidade: number; item?: { nome?: string } }) => (
                    <li key={ki.id}>
                      {ki.quantidade}x {ki.item?.nome}
                    </li>
                  )
                )}
              </ul>
            )}
            <p className="text-xs text-slate-400">
              Os itens entram como linhas normais na sala — você pode ajustar
              quantidades, diárias e valores depois.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setKitAlvo(null)}>
            Cancelar
          </Button>
          <Button onClick={aplicarKit} disabled={!kitSel}>
            Adicionar itens do kit
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
