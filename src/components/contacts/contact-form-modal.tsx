"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { fetchAddressByCEP, formatCEP } from "@/lib/utils";
import { Plus, Trash2, Loader2, MapPin } from "lucide-react";

interface SubContact {
  id?: string;
  nome: string;
  telefone: string;
  email: string;
  cargo: string;
}

interface ContactFormData {
  id?: string;
  type: "CLIENTE" | "FORNECEDOR";
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  cep: string;
  rua: string;
  numero: string;
  semNumero: boolean;
  bairro: string;
  complemento: string;
  cidade: string;
  estado: string;
  perfil: string;
  isPostoServico: boolean;
  subContacts: SubContact[];
}

const perfilOptions = [
  { value: "AGENCIA", label: "Agência" },
  { value: "ESPACO_EVENTO", label: "Espaço de Evento" },
  { value: "CLIENTE_FINAL_PJ", label: "Cliente Final PJ" },
  { value: "CLIENTE_FINAL_PF", label: "Cliente Final PF" },
];

const estadoOptions = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
].map((e) => ({ value: e, label: e }));

function emptyForm(type: "CLIENTE" | "FORNECEDOR"): ContactFormData {
  return {
    type,
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    inscricaoEstadual: "",
    inscricaoMunicipal: "",
    cep: "",
    rua: "",
    numero: "",
    semNumero: false,
    bairro: "",
    complemento: "",
    cidade: "",
    estado: "",
    perfil: "",
    isPostoServico: false,
    subContacts: [],
  };
}

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (created?: any) => void;
  type: "CLIENTE" | "FORNECEDOR";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial?: any;
}

export function ContactFormModal({
  open,
  onClose,
  onSuccess,
  type,
  initial,
}: ContactFormModalProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"dados" | "contatos">("dados");
  const [form, setForm] = useState<ContactFormData>(emptyForm(type));
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setTab("dados");
      setErrors({});
      if (initial) {
        setForm({ ...emptyForm(type), ...initial, subContacts: initial.subContacts || [] });
      } else {
        setForm(emptyForm(type));
      }
    }
  }, [open, initial, type]);

  function setField<K extends keyof ContactFormData>(key: K, value: ContactFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleCEP(value: string) {
    const formatted = formatCEP(value);
    setField("cep", formatted);
    const digits = value.replace(/\D/g, "");
    if (digits.length === 8) {
      setCepLoading(true);
      const addr = await fetchAddressByCEP(digits);
      setCepLoading(false);
      if (addr) {
        setForm((prev) => ({
          ...prev,
          rua: addr.rua || prev.rua,
          bairro: addr.bairro || prev.bairro,
          cidade: addr.cidade || prev.cidade,
          estado: addr.estado || prev.estado,
        }));
      }
    }
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.razaoSocial.trim()) errs.razaoSocial = "Campo obrigatório";
    if (!form.nomeFantasia.trim()) errs.nomeFantasia = "Campo obrigatório";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) {
      setTab("dados");
      return;
    }
    setLoading(true);
    try {
      const url = form.id ? `/api/contacts/${form.id}` : "/api/contacts";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      const data = await res.json();
      toast(
        form.id
          ? `${type === "CLIENTE" ? "Cliente" : "Fornecedor"} atualizado com sucesso!`
          : `${type === "CLIENTE" ? "Cliente" : "Fornecedor"} criado com sucesso!`,
        "success"
      );
      onSuccess(data);
      onClose();
    } catch {
      toast("Erro ao salvar. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  }

  function addSubContact() {
    setField("subContacts", [
      ...form.subContacts,
      { nome: "", telefone: "", email: "", cargo: "" },
    ]);
  }

  function removeSubContact(i: number) {
    setField(
      "subContacts",
      form.subContacts.filter((_, idx) => idx !== i)
    );
  }

  function updateSubContact(i: number, key: keyof SubContact, value: string) {
    const updated = [...form.subContacts];
    updated[i] = { ...updated[i], [key]: value };
    setField("subContacts", updated);
  }

  const title = initial?.id
    ? `Editar ${type === "CLIENTE" ? "Cliente" : "Fornecedor"}`
    : `Novo ${type === "CLIENTE" ? "Cliente" : "Fornecedor"}`;

  return (
    <Modal open={open} onClose={onClose} title={title} size="2xl">
      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-6 pt-2">
        {(["dados", "contatos"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "dados" ? "Dados Gerais" : "Contatos"}
            {t === "contatos" && form.subContacts.length > 0 && (
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                {form.subContacts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <ModalBody>
        {tab === "dados" && (
          <div className="space-y-4">
            {/* Section: Dados Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Razão Social *"
                value={form.razaoSocial}
                onChange={(e) => setField("razaoSocial", e.target.value)}
                error={errors.razaoSocial}
                placeholder="Ex: Empresa XYZ Ltda"
              />
              <Input
                label="Nome Fantasia *"
                value={form.nomeFantasia}
                onChange={(e) => setField("nomeFantasia", e.target.value)}
                error={errors.nomeFantasia}
                placeholder="Ex: XYZ Eventos"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="CNPJ"
                value={form.cnpj}
                onChange={(e) => setField("cnpj", e.target.value)}
                placeholder="00.000.000/0000-00"
              />
              <Input
                label="Insc. Estadual"
                value={form.inscricaoEstadual}
                onChange={(e) => setField("inscricaoEstadual", e.target.value)}
              />
              <Input
                label="Insc. Municipal"
                value={form.inscricaoMunicipal}
                onChange={(e) =>
                  setField("inscricaoMunicipal", e.target.value)
                }
              />
            </div>

            {/* Section: Endereço */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Endereço
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-1">
                  <div className="relative">
                    <Input
                      label="CEP"
                      value={form.cep}
                      onChange={(e) => handleCEP(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    {cepLoading && (
                      <Loader2 className="absolute right-3 top-8 h-4 w-4 animate-spin text-blue-500" />
                    )}
                  </div>
                </div>
                <div className="col-span-3">
                  <Input
                    label="Rua"
                    value={form.rua}
                    onChange={(e) => setField("rua", e.target.value)}
                    placeholder="Nome da rua"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <div>
                  {form.semNumero ? (
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-slate-700">
                        Número
                      </label>
                      <div className="h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-400">
                        S/N
                      </div>
                    </div>
                  ) : (
                    <Input
                      label="Número"
                      value={form.numero}
                      onChange={(e) => setField("numero", e.target.value)}
                      placeholder="123"
                    />
                  )}
                  <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.semNumero}
                      onChange={(e) => setField("semNumero", e.target.checked)}
                      className="h-3.5 w-3.5 rounded"
                    />
                    <span className="text-xs text-slate-500">Sem número</span>
                  </label>
                </div>
                <div>
                  <Input
                    label="Bairro"
                    value={form.bairro}
                    onChange={(e) => setField("bairro", e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    label="Complemento"
                    value={form.complemento}
                    onChange={(e) => setField("complemento", e.target.value)}
                    placeholder="Apto, Sala..."
                  />
                </div>
                <div>
                  <Input
                    label="Cidade"
                    value={form.cidade}
                    onChange={(e) => setField("cidade", e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-3 w-32">
                <Select
                  label="Estado"
                  value={form.estado}
                  onChange={(e) => setField("estado", e.target.value)}
                  options={estadoOptions}
                  placeholder="UF"
                />
              </div>
            </div>

            {/* Section: Perfil (only for CLIENTE) */}
            {type === "CLIENTE" && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Classificação
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Perfil de Cliente"
                    value={form.perfil}
                    onChange={(e) => setField("perfil", e.target.value)}
                    options={perfilOptions}
                    placeholder="Selecione o perfil"
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700">
                      Posto de Serviço Oficial?
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
                            checked={form.isPostoServico === opt.value}
                            onChange={() =>
                              setField("isPostoServico", opt.value)
                            }
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="text-sm text-slate-700">
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "contatos" && (
          <div className="space-y-3">
            {form.subContacts.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">Nenhum contato adicionado</p>
              </div>
            )}

            {form.subContacts.map((contact, i) => (
              <div
                key={i}
                className="border border-slate-100 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    Contato {i + 1}
                  </span>
                  <button
                    onClick={() => removeSubContact(i)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Nome"
                    value={contact.nome}
                    onChange={(e) => updateSubContact(i, "nome", e.target.value)}
                    placeholder="Nome completo"
                  />
                  <Input
                    label="Cargo"
                    value={contact.cargo}
                    onChange={(e) => updateSubContact(i, "cargo", e.target.value)}
                    placeholder="Ex: Gerente"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Telefone"
                    value={contact.telefone}
                    onChange={(e) =>
                      updateSubContact(i, "telefone", e.target.value)
                    }
                    placeholder="(11) 99999-9999"
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={contact.email}
                    onChange={(e) =>
                      updateSubContact(i, "email", e.target.value)
                    }
                    placeholder="contato@empresa.com"
                  />
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={addSubContact}
              className="w-full"
            >
              <Plus className="h-4 w-4" />
              Adicionar Contato
            </Button>
          </div>
        )}
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
