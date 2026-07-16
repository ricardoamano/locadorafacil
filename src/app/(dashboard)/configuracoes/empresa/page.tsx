"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { fetchAddressByCEP, formatCEP, formatDoc, formatPhone, slugify } from "@/lib/utils";
import { ContasBancarias } from "@/components/configuracoes/contas-bancarias";
import { Loader2, Building2, ReceiptText, Hash, Paperclip, Trash2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const estadoOptions = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
].map((e) => ({ value: e, label: e }));

const campos = [
  "name","razaoSocial","cnpj","inscricaoEstadual","inscricaoMunicipal",
  "cep","rua","numero","bairro","complemento","cidade","estado",
  "telefone","email","site","logoUrl",
  "logoUrlClara","logoUrlIcone","corPrimaria","corSecundaria",
  "responsavel","naturezaOperacao","observacaoFatura",
  "orcamentoNumeroInicial","faturaNumeroInicial",
  "catalogoWhatsappTexto","catalogoWhatsappMensagem",
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
  const [catalogoWppAtivo, setCatalogoWppAtivo] = useState(true);
  // Documentos e links da empresa
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [linkTitulo, setLinkTitulo] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [enviandoArq, setEnviandoArq] = useState(false);

  function carregarArquivos() {
    fetch("/api/empresa/arquivos")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setArquivos(d.arquivos || []))
      .catch(() => {});
  }

  useEffect(() => {
    carregarArquivos();
    fetch("/api/empresa")
      .then((r) => r.json())
      .then((d: any) => {
        const f = emptyForm();
        for (const c of campos) f[c] = d[c] ?? "";
        setForm(f);
        setCatalogoWppAtivo(d.catalogoWhatsappAtivo ?? true);
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

  async function uploadArquivoEmpresa(file: File) {
    setEnviandoArq(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/empresa/arquivos", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setArquivos((p) => [d, ...p]);
      toast("Documento anexado!", "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao enviar.", "error");
    } finally {
      setEnviandoArq(false);
    }
  }

  async function adicionarLink() {
    if (!linkUrl.trim()) return;
    setEnviandoArq(true);
    try {
      const res = await fetch("/api/empresa/arquivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl.trim(), titulo: linkTitulo.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setArquivos((p) => [d, ...p]);
      setLinkTitulo("");
      setLinkUrl("");
      toast("Link adicionado!", "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao adicionar.", "error");
    } finally {
      setEnviandoArq(false);
    }
  }

  async function removerArquivoEmpresa(id: string) {
    try {
      const res = await fetch(`/api/empresa/arquivos?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setArquivos((p) => p.filter((a) => a.id !== id));
    } catch {
      toast("Erro ao remover.", "error");
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
        body: JSON.stringify({ ...form, catalogoWhatsappAtivo: catalogoWppAtivo }),
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
                  <Input label="CNPJ ou CPF" value={form.cnpj} onChange={(e) => set("cnpj", formatDoc(e.target.value))} placeholder="00.000.000/0000-00" />
                  <Input label="Insc. Estadual" value={form.inscricaoEstadual} onChange={(e) => set("inscricaoEstadual", e.target.value)} />
                  <Input label="Insc. Municipal" value={form.inscricaoMunicipal} onChange={(e) => set("inscricaoMunicipal", e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input label="Telefone" value={form.telefone} onChange={(e) => set("telefone", formatPhone(e.target.value))} placeholder="(11) 99999.9999" />
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
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    Endereço do catálogo público
                  </label>
                  <p className="h-9 inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 max-w-full overflow-x-auto">
                    locadorafacil.app/catalogo/
                    <span className="font-medium text-slate-700">
                      {slugify(form.name || "") || "nome-da-empresa"}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Gerado automaticamente a partir do Nome da Empresa ao salvar. Se
                    renomear a empresa, os links antigos do catálogo mudam.
                  </p>
                </div>
              </div>
            </section>

            {/* Identidade visual — cores e versões do logo */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Identidade Visual</h2>
              <p className="text-xs text-slate-400 mb-4">
                Cores da marca e versões do logo — usadas no template Moderno do orçamento e nos
                documentos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {(
                  [
                    { campo: "corPrimaria" as const, rotulo: "Cor primária", padrao: "#4b2a66" },
                    { campo: "corSecundaria" as const, rotulo: "Cor secundária", padrao: "#7c5a99" },
                  ]
                ).map((c) => (
                  <div key={c.campo}>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      {c.rotulo}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form[c.campo] || c.padrao}
                        onChange={(e) => set(c.campo, e.target.value)}
                        className="h-9 w-12 rounded-lg border border-slate-200 cursor-pointer"
                      />
                      <Input
                        value={form[c.campo]}
                        onChange={(e) => set(c.campo, e.target.value)}
                        placeholder={c.padrao}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ImageUpload
                  label="Logo — versão clara/branca"
                  value={form.logoUrlClara}
                  onChange={(url) => set("logoUrlClara", url)}
                  hint="Para fundos coloridos (ex.: faixa do template Moderno). PNG com fundo transparente."
                />
                <ImageUpload
                  label="Logo — símbolo / ícone"
                  value={form.logoUrlIcone}
                  onChange={(url) => set("logoUrlIcone", url)}
                  hint="Versão quadrada/reduzida da marca (opcional)."
                />
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
            <ContasBancarias />

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

            {/* Numeração de documentos (onboarding / migração) */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <Hash className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Numeração de documentos
                </h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Se você já emitia orçamentos e faturas em outro sistema, informe o
                próximo número para a sequência continuar de onde parou. Deixe em branco
                para começar do 1. Só afeta documentos novos — os já emitidos não mudam.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Próximo nº de orçamento"
                  type="number"
                  min={1}
                  value={form.orcamentoNumeroInicial}
                  onChange={(e) => set("orcamentoNumeroInicial", e.target.value)}
                  placeholder="Ex.: 1000"
                />
                <Input
                  label="Próximo nº de fatura"
                  type="number"
                  min={1}
                  value={form.faturaNumeroInicial}
                  onChange={(e) => set("faturaNumeroInicial", e.target.value)}
                  placeholder="Ex.: 500"
                />
              </div>
            </section>

            {/* Documentos e links da empresa */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <Paperclip className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Documentos e links da empresa
                </h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Cartão CNPJ, contrato social, documentos fiscais, certidões... Anexe
                arquivos (até 4 MB) ou cole links de pastas compartilhadas (Google Drive,
                Dropbox). Ficam acessíveis à sua equipe.
              </p>

              {arquivos.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  {arquivos.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 text-sm rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <span className="text-slate-400 text-xs shrink-0">
                        {a.tipo === "LINK" ? "🔗" : "📄"}
                      </span>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate"
                      >
                        {a.titulo}
                      </a>
                      {a.criadoPor && (
                        <span className="text-xs text-slate-300 ml-1 shrink-0 hidden sm:inline">
                          · {a.criadoPor}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removerArquivoEmpresa(a.id)}
                        className="ml-auto text-slate-300 hover:text-red-500 shrink-0"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <label className="inline-flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:border-blue-300 cursor-pointer">
                  {enviandoArq ? "Enviando..." : "📤 Enviar documento"}
                  <input
                    type="file"
                    className="hidden"
                    disabled={enviandoArq}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadArquivoEmpresa(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-end">
                  <Input
                    label="Nome do link (opcional)"
                    value={linkTitulo}
                    onChange={(e) => setLinkTitulo(e.target.value)}
                    placeholder="Ex.: Pasta fiscal"
                  />
                  <Input
                    label="Link (Google Drive, Dropbox...)"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarLink();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={adicionarLink}
                    loading={enviandoArq}
                  >
                    Adicionar link
                  </Button>
                </div>
              </div>
            </section>

            {/* Catálogo público — botão de WhatsApp */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">
                Catálogo público — botão de WhatsApp
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Texto do botão e mensagem que o cliente envia ao clicar na página pública do
                item. Variáveis:{" "}
                <code className="bg-slate-100 px-1 rounded">{"{item}"}</code>,{" "}
                <code className="bg-slate-100 px-1 rounded">{"{marca}"}</code>,{" "}
                <code className="bg-slate-100 px-1 rounded">{"{modelo}"}</code> — são
                substituídas automaticamente (se o item não tiver marca/modelo, ficam vazias).
              </p>
              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={catalogoWppAtivo}
                  onChange={(e) => setCatalogoWppAtivo(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm text-slate-700">
                  Mostrar o botão de WhatsApp no catálogo
                </span>
              </label>
              {catalogoWppAtivo && (
                <div className="space-y-3">
                  <Input
                    label="Texto do botão"
                    value={form.catalogoWhatsappTexto}
                    onChange={(e) => set("catalogoWhatsappTexto", e.target.value)}
                    placeholder="Solicitar orçamento pelo WhatsApp"
                  />
                  <Textarea
                    label="Mensagem enviada pelo cliente"
                    value={form.catalogoWhatsappMensagem}
                    onChange={(e) => set("catalogoWhatsappMensagem", e.target.value)}
                    placeholder="Olá! Gostaria de um orçamento para: {item}"
                    rows={2}
                  />
                  {!form.telefone && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1.5">
                      ⚠️ Preencha o <strong>Telefone</strong> da empresa acima — o WhatsApp usa
                      esse número.
                    </p>
                  )}
                </div>
              )}
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
