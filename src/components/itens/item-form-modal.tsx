"use client";

import React, { useState, useEffect } from "react";
import { PreencherIa } from "@/components/ui/preencher-ia";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/components/ui/toast";
import { calcularPrecos, POLITICA_PADRAO, type PoliticaPrecos } from "@/lib/precos";
import { formatCurrency } from "@/lib/utils";

interface Categoria {
  id: string;
  nome: string;
}

interface ItemFormData {
  id?: string;
  natureza: string;
  cobranca: string;
  codigo: string;
  nome: string;
  apelidos: string;
  watts: string;
  valorReposicao: string;
  valorAluguel: string;
  tipo: string;
  categoriaId: string;
  quantidade: string;
  especificacoes: string;
  emCatalogo: boolean;
  publicado: boolean;
  slug: string;
  descricaoComercial: string;
  especificacoesPublicas: string;
  fotoCapaUrl: string;
  videoUrl: string;
  mostrarCodigo: boolean;
  precoManual: boolean;
  valorSemana: string;
  valorQuinzena: string;
  valorMes: string;
}

const tipoOptions = [
  { value: "PROPRIO", label: "Próprio" },
  { value: "ALUGADO", label: "Alugado" },
  { value: "TERCEIRO", label: "Terceiro" },
];

function emptyForm(): ItemFormData {
  return {
    natureza: "EQUIPAMENTO",
    cobranca: "FIXO",
    codigo: "",
    nome: "",
    apelidos: "",
    watts: "",
    valorReposicao: "",
    valorAluguel: "",
    tipo: "PROPRIO",
    categoriaId: "",
    quantidade: "",
    especificacoes: "",
    emCatalogo: true,
    publicado: false,
    slug: "",
    descricaoComercial: "",
    especificacoesPublicas: "",
    fotoCapaUrl: "",
    videoUrl: "",
    mostrarCodigo: false,
    precoManual: false,
    valorSemana: "",
    valorQuinzena: "",
    valorMes: "",
  };
}

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (created?: any) => void;
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
  const [politica, setPolitica] = useState<PoliticaPrecos>(POLITICA_PADRAO);
  const [permitirManual, setPermitirManual] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ItemFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setErrors({});
      if (initial) {
        setForm({
          ...emptyForm(),
          ...initial,
          natureza: initial.natureza || "EQUIPAMENTO",
          cobranca: initial.cobranca || "FIXO",
          apelidos: initial.apelidos || "",
          watts: initial.watts != null ? String(initial.watts) : "",
          valorReposicao: initial.valorReposicao != null ? String(initial.valorReposicao) : "",
          valorAluguel: initial.valorAluguel != null ? String(initial.valorAluguel) : "",
          publicado: !!initial.publicado,
          slug: initial.slug || "",
          descricaoComercial: initial.descricaoComercial || "",
          especificacoesPublicas: initial.especificacoesPublicas || "",
          fotoCapaUrl: initial.fotoCapaUrl || "",
          videoUrl: initial.videoUrl || "",
          mostrarCodigo: !!initial.mostrarCodigo,
          precoManual: !!initial.precoManual,
          valorSemana: initial.valorSemana != null ? String(initial.valorSemana) : "",
          valorQuinzena: initial.valorQuinzena != null ? String(initial.valorQuinzena) : "",
          valorMes: initial.valorMes != null ? String(initial.valorMes) : "",
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
      fetch("/api/empresa")
        .then((r) => r.json())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((d: any) => {
          setPolitica({
            diasSemana: d.diasSemana ?? 7,
            diasQuinzena: d.diasQuinzena ?? 15,
            diasMes: d.diasMes ?? 30,
            descontoSemana: d.descontoSemana ?? 0,
            descontoQuinzena: d.descontoQuinzena ?? 0,
            descontoMes: d.descontoMes ?? 0,
          });
          setPermitirManual(d.permitirPrecoManual ?? true);
        })
        .catch(() => {});
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
          precoManual: form.precoManual,
          valorSemana: form.precoManual ? parseFloat(form.valorSemana) || 0 : undefined,
          valorQuinzena: form.precoManual ? parseFloat(form.valorQuinzena) || 0 : undefined,
          valorMes: form.precoManual ? parseFloat(form.valorMes) || 0 : undefined,
          quantidade: parseInt(form.quantidade) || 0,
          categoriaId: form.categoriaId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Erro ao salvar. Tente novamente.", "error");
        return;
      }
      toast(
        form.id ? "Item atualizado com sucesso!" : "Item criado com sucesso!",
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
          {/* Natureza: locação de equipamento ou prestação de serviço */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setField("natureza", "EQUIPAMENTO")}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                form.natureza !== "SERVICO"
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              📦 Equipamento (locação, com estoque)
            </button>
            <button
              type="button"
              onClick={() => setField("natureza", "SERVICO")}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                form.natureza === "SERVICO"
                  ? "border-purple-300 bg-purple-50 text-purple-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              🛠 Serviço (prestação, sem estoque)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input
                label="Nome do Item *"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                error={errors.nome}
                placeholder="Ex: Caixa de Som Line Array"
              />
              <div className="mt-2">
                <PreencherIa
                  tipo="item"
                  texto={form.nome}
                  onDados={(d) => {
                    setForm((p) => ({
                      ...p,
                      especificacoes: p.especificacoes || d.especificacoes || "",
                      descricaoComercial: p.descricaoComercial || d.descricaoComercial || "",
                      especificacoesPublicas:
                        p.especificacoesPublicas || d.especificacoesPublicas || "",
                      watts: p.watts || (d.watts != null ? String(d.watts) : ""),
                      apelidos: p.apelidos || d.apelidos || "",
                    }));
                  }}
                />
              </div>
            </div>
            <Input
              label="Código"
              value={form.codigo}
              onChange={(e) => setField("codigo", e.target.value)}
              placeholder="Ex: #336-1"
            />
          </div>
          <div>
            <Input
              label="Apelidos"
              value={form.apelidos}
              onChange={(e) => setField("apelidos", e.target.value)}
              placeholder='Ex: "Microfone vermelho que comprei no Paraguai"'
            />
            <p className="text-xs text-slate-400 mt-1">
              Identificação interna/informal — aparece na busca de itens, mas não em documentos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={
                form.natureza === "SERVICO"
                  ? "Valor do Serviço (R$) *"
                  : "Valor da Diária (R$) *"
              }
              type="number"
              step="0.01"
              value={form.valorAluguel}
              onChange={(e) => setField("valorAluguel", e.target.value)}
              placeholder="0,00"
            />
            {form.natureza === "SERVICO" ? (
              <Select
                label="Forma de cobrança"
                value={form.cobranca}
                onChange={(e) => setField("cobranca", e.target.value)}
                options={[
                  { value: "FIXO", label: "Valor fixo (pacote)" },
                  { value: "HORA", label: "Por hora" },
                  { value: "DIARIA", label: "Por diária" },
                ]}
              />
            ) : (
              <>
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
              </>
            )}
          </div>
          {form.natureza === "SERVICO" && (
            <p className="text-xs text-slate-400 -mt-2">
              Serviços não geram estoque, unidades nem etiquetas QR — entram no
              orçamento normalmente, sozinhos ou junto com equipamentos.
            </p>
          )}

          {/* Consumo elétrico (só equipamentos) */}
          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 items-end ${form.natureza === "SERVICO" ? "hidden" : ""}`}>
            <Input
              label="Consumo (Watts)"
              type="number"
              step="1"
              value={form.watts}
              onChange={(e) => setField("watts", e.target.value)}
              placeholder="Ex: 800"
            />
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                kVA (automático)
              </label>
              <p className="h-9 flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
                {parseFloat(form.watts) > 0
                  ? `${(parseFloat(form.watts) / 800).toLocaleString("pt-BR", {
                      maximumFractionDigits: 3,
                    })} kVA`
                  : "—"}
              </p>
            </div>
            <p className="text-xs text-slate-400 pb-2">
              kVA = Watts ÷ (1.000 × FP 0,8). Usado na soma de carga elétrica do
              orçamento.
            </p>
          </div>

          {form.natureza !== "SERVICO" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Valor de Reposição (R$)"
                type="number"
                step="0.01"
                value={form.valorReposicao}
                onChange={(e) => setField("valorReposicao", e.target.value)}
                placeholder="Custo em caso de perda/dano"
              />
              <p className="text-xs text-slate-400 sm:col-span-2 self-end pb-2">
                Impresso no romaneio de carga da OS como termo de responsabilidade.
              </p>
            </div>
          )}

          {/* Preços por período (política de preços — só equipamentos) */}
          {form.natureza !== "SERVICO" && (() => {
            const diaria = parseFloat(form.valorAluguel) || 0;
            const calc = calcularPrecos(diaria, politica);
            const periodos = [
              { key: "valorSemana" as const, titulo: "Semana", auto: calc.valorSemana, memoria: calc.memoria.semana },
              { key: "valorQuinzena" as const, titulo: "Quinzena", auto: calc.valorQuinzena, memoria: calc.memoria.quinzena },
              { key: "valorMes" as const, titulo: "Mês", auto: calc.valorMes, memoria: calc.memoria.mes },
            ];
            return (
              <div className="border border-slate-100 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Preços por período
                  </p>
                  {permitirManual && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.precoManual}
                        onChange={(e) => setField("precoManual", e.target.checked)}
                        className="h-4 w-4 rounded"
                      />
                      <span className="text-xs text-slate-600">
                        Definir preços manualmente
                      </span>
                    </label>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {periodos.map((per) => (
                    <div key={per.key}>
                      {form.precoManual ? (
                        <Input
                          label={`${per.titulo} (R$)`}
                          type="number"
                          step="0.01"
                          value={form[per.key]}
                          onChange={(e) => setField(per.key, e.target.value)}
                          placeholder={String(per.auto)}
                        />
                      ) : (
                        <div className="border border-slate-100 bg-slate-50 rounded-lg p-2.5">
                          <p className="text-xs text-slate-400">{per.titulo} (automático)</p>
                          <p className="text-sm font-bold text-slate-900">
                            {formatCurrency(per.auto)}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{per.memoria}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Apresentação pública (catálogo) */}
          <div className="border border-slate-100 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Página Comercial Pública
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.publicado}
                  onChange={(e) => setField("publicado", e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-xs text-slate-600 font-medium">
                  {form.publicado ? "Publicado" : "Publicar"}
                </span>
              </label>
            </div>
            {form.publicado && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Slug amigável (URL)"
                    value={form.slug}
                    onChange={(e) => setField("slug", e.target.value)}
                    placeholder="gerado do nome se vazio"
                  />
                  <ImageUpload
                    label="Foto de capa"
                    value={form.fotoCapaUrl}
                    onChange={(url) => setField("fotoCapaUrl", url)}
                  />
                </div>
                <Textarea
                  label="Descrição comercial"
                  value={form.descricaoComercial}
                  onChange={(e) => setField("descricaoComercial", e.target.value)}
                  placeholder="Texto de apresentação para clientes..."
                  rows={3}
                />
                <Textarea
                  label="Especificações técnicas públicas"
                  value={form.especificacoesPublicas}
                  onChange={(e) => setField("especificacoesPublicas", e.target.value)}
                  placeholder="Potência, dimensões, alcance..."
                  rows={3}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <Input
                    label="Vídeo demonstrativo (URL)"
                    value={form.videoUrl}
                    onChange={(e) => setField("videoUrl", e.target.value)}
                    placeholder="https://youtube.com/..."
                  />
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={form.mostrarCodigo}
                      onChange={(e) => setField("mostrarCodigo", e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    <span className="text-sm text-slate-700">
                      Exibir código comercial na página
                    </span>
                  </label>
                </div>
                <p className="text-xs text-slate-400">
                  A página pública nunca exibe preços, estoque ou informações internas.
                </p>
              </div>
            )}
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
