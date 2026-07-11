"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { fetchAddressByCEP, formatCEP } from "@/lib/utils";
import { Loader2, Building2, Landmark, ReceiptText } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const estadoOptions = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
].map((e) => ({ value: e, label: e }));

const campos = [
  "name","razaoSocial","cnpj","inscricaoEstadual","inscricaoMunicipal",
  "cep","rua","numero","bairro","complemento","cidade","estado",
  "telefone","email","site","logoUrl","banco","agencia","conta","pix",
  "responsavel","naturezaOperacao","observacaoFatura",
] as const;

type Form = Record<(typeof campos)[number], string>;

function emptyForm(): Form {
  return Object.fromEntries(campos.map((c) => [c, ""])) as Form;
}

export default function EmpresaConfigPage() {
  const { toast } = useToast();
  const [form, setForm] = useState<Form>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => r.json())
      .then((d: any) => {
        const f = emptyForm();
        for (const c of campos) f[c] = d[c] ?? "";
        setForm(f);
      })
      .catch(() => toast("Erro ao carregar dados da empresa.", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(key: keyof Form, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function handleCEP(value: string) {
    const formatted = formatCEP(value);
    set("cep", formatted);
    const digits = value.replace(/\D/g, "");
    if (digits.length === 8) {
      setCepLoading(true);
      const addr = await fetchAddressByCEP(digits);
      setCepLoading(false);
      if (addr) {
        setForm((p) => ({
          ...p,
          rua: addr.rua || p.rua,
          bairro: addr.bairro || p.bairro,
          cidade: addr.cidade || p.cidade,
          estado: addr.estado || p.estado,
        }));
      }
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast("Informe o nome fantasia.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/empresa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.status === 403) {
        toast("Apenas administradores podem alterar os dados da empresa.", "error");
        return;
      }
      if (!res.ok) throw new Error();
      toast("Dados da empresa salvos com sucesso!", "success");
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header
        breadcrumbs={[{ label: "Configurações" }, { label: "Dados da Empresa" }]}
      />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Dados da Empresa</h1>
          <p className="text-sm text-slate-500 mt-1">
            Informações usadas nas faturas, contratos e documentos emitidos
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="max-w-3xl space-y-4">
            {/* Identificação */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">Identificação</h2>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Nome Fantasia *" value={form.name} onChange={(e) => set("name", e.target.value)} />
                  <Input label="Razão Social" value={form.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input label="CNPJ ou CPF" value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
                  <Input label="Insc. Estadual" value={form.inscricaoEstadual} onChange={(e) => set("inscricaoEstadual", e.target.value)} />
                  <Input label="Insc. Municipal" value={form.inscricaoMunicipal} onChange={(e) => set("inscricaoMunicipal", e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input label="Telefone" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 99999-9999" />
                  <Input label="E-mail" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@empresa.com" />
                  <Input label="Site" value={form.site} onChange={(e) => set("site", e.target.value)} placeholder="https://..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Responsável pela Empresa" value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} />
                  <ImageUpload
                    label="Logotipo da Empresa"
                    value={form.logoUrl}
                    onChange={(url) => set("logoUrl", url)}
                    hint="Aparece no menu, nas faturas e no catálogo. JPG, PNG, WEBP ou SVG — até 3 MB."
                  />
                </div>
              </div>
            </section>

            {/* Endereço */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Endereço</h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="relative">
                    <Input label="CEP" value={form.cep} onChange={(e) => handleCEP(e.target.value)} placeholder="00000-000" maxLength={9} />
                    {cepLoading && (
                      <Loader2 className="absolute right-3 top-8 h-4 w-4 animate-spin text-blue-500" />
                    )}
                  </div>
                  <div className="col-span-3">
                    <Input label="Rua" value={form.rua} onChange={(e) => set("rua", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Input label="Número" value={form.numero} onChange={(e) => set("numero", e.target.value)} />
                  <Input label="Bairro" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
                  <Input label="Complemento" value={form.complemento} onChange={(e) => set("complemento", e.target.value)} />
                  <Input label="Cidade" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
                </div>
                <div className="w-32">
                  <Select label="Estado" value={form.estado} onChange={(e) => set("estado", e.target.value)} options={estadoOptions} placeholder="UF" />
                </div>
              </div>
            </section>

            {/* Dados bancários */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Landmark className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Dados Bancários e PIX
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input label="Banco" value={form.banco} onChange={(e) => set("banco", e.target.value)} placeholder="Ex: Nubank (260)" />
                <Input label="Agência" value={form.agencia} onChange={(e) => set("agencia", e.target.value)} placeholder="0001" />
                <Input label="Conta Corrente" value={form.conta} onChange={(e) => set("conta", e.target.value)} placeholder="00000000-0" />
              </div>
              <div className="mt-3">
                <Input label="Chave PIX" value={form.pix} onChange={(e) => set("pix", e.target.value)} placeholder="E-mail, CNPJ, telefone ou chave aleatória" />
              </div>
            </section>

            {/* Documentos / Fatura */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <ReceiptText className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Textos dos Documentos (Fatura)
                </h2>
              </div>
              <div className="space-y-3">
                <Input
                  label="Natureza da Operação"
                  value={form.naturezaOperacao}
                  onChange={(e) => set("naturezaOperacao", e.target.value)}
                  placeholder="LOCAÇÃO DE BENS MÓVEIS"
                />
                <Textarea
                  label="Observação padrão da fatura"
                  value={form.observacaoFatura}
                  onChange={(e) => set("observacaoFatura", e.target.value)}
                  placeholder="Ex: Desobrigado a emissão de NOTA FISCAL, em decorrência de..."
                  rows={3}
                />
              </div>
            </section>

            <div className="flex justify-end">
              <Button onClick={handleSave} loading={saving}>
                Salvar Dados da Empresa
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
