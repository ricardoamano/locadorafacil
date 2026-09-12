"use client";

import React, { useState, useEffect } from "react";
import { PreencherIa } from "@/components/ui/preencher-ia";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FotosUpload } from "@/components/ui/fotos-upload";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { calcularPrecos, POLITICA_PADRAO, type PoliticaPrecos } from "@/lib/precos";
import { formatCurrency } from "@/lib/utils";

interface Categoria {
  id: string;
  nome: string;
  subCategorias?: { id: string; nome: string }[];
}

interface ItemFormData {
  id?: string;
  natureza: string;
  cobranca: string;
  codigo: string;
  nome: string;
  marcaId: string;
  modelo: string;
  apelidos: string;
  watts: string;
  valorReposicao: string;
  valorAluguel: string;
  tipo: string;
  categoriaId: string;
  subCategoriaId: string;
  quantidade: string;
  especificacoes: string;
  observacaoInterna: string;
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
    marcaId: "",
    modelo: "",
    apelidos: "",
    watts: "",
    valorReposicao: "",
    valorAluguel: "",
    tipo: "PROPRIO",
    categoriaId: "",
    subCategoriaId: "",
    quantidade: "",
    especificacoes: "",
    observacaoInterna: "",
    emCatalogo: true,
    publicado: true,
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
  const [marcas, setMarcas] = useState<Categoria[]>([]);
  const [confirmarQtd, setConfirmarQtd] = useState(false);
  // Renomeou o item? Pergunta se o novo nome vale para "todos" (itens iguais,
  // faturas não emitidas e orçamentos pendentes que copiaram o nome)
  const [renomearInfo, setRenomearInfo] = useState<{
    de: string;
    para: string;
    itens: number;
    faturas: number;
    orcamentos: number;
  } | null>(null);
  const [fotos, setFotos] = useState<string[]>([]);
  // Acessórios avulsos: checklist de separação (sem código/QR)
  const [avulsos, setAvulsos] = useState<{ nome: string; quantidade: number }[]>([]);
  const [novoAvulso, setNovoAvulso] = useState("");
  const [novoAvulsoQtd, setNovoAvulsoQtd] = useState("1");
  // Arquivos do item (manuais, apresentações, vídeos...)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [linkArquivo, setLinkArquivo] = useState("");
  const [nomeAnexo, setNomeAnexo] = useState("");
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [precosMercado, setPrecosMercado] = useState<any | null>(null);
  const [pesquisandoPrecos, setPesquisandoPrecos] = useState(false);
  const [politica, setPolitica] = useState<PoliticaPrecos>(POLITICA_PADRAO);
  const [permitirManual, setPermitirManual] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ItemFormData, string>>>({});
  // Criação rápida de categoria/subcategoria dentro do próprio cadastro do item
  const [criarCatOpen, setCriarCatOpen] = useState(false);
  const [novaCatNome, setNovaCatNome] = useState("");
  const [criarSubOpen, setCriarSubOpen] = useState(false);
  const [novaSubNome, setNovaSubNome] = useState("");
  const [criandoCatSub, setCriandoCatSub] = useState(false);

  async function carregarCategorias(): Promise<Categoria[]> {
    try {
      const r = await fetch("/api/categorias");
      const d = await r.json();
      const lista: Categoria[] = d.categorias || [];
      setCategorias(lista);
      return lista;
    } catch {
      setCategorias([]);
      return [];
    }
  }

  async function criarCategoriaRapida() {
    const nome = novaCatNome.trim();
    if (!nome || criandoCatSub) return;
    setCriandoCatSub(true);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, tipo: "ITEM" }),
      });
      const nova = await res.json();
      if (!res.ok) throw new Error(nova?.error);
      await carregarCategorias();
      setField("categoriaId", nova.id);
      setField("subCategoriaId", "");
      setNovaCatNome("");
      setCriarCatOpen(false);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao criar categoria.", "error");
    } finally {
      setCriandoCatSub(false);
    }
  }

  async function criarSubRapida() {
    const nome = novaSubNome.trim();
    if (!nome || !form.categoriaId || criandoCatSub) return;
    setCriandoCatSub(true);
    try {
      const res = await fetch("/api/subcategorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, categoriaId: form.categoriaId }),
      });
      const nova = await res.json();
      if (!res.ok) throw new Error(nova?.error);
      await carregarCategorias();
      setField("subCategoriaId", nova.id);
      setNovaSubNome("");
      setCriarSubOpen(false);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao criar subcategoria.", "error");
    } finally {
      setCriandoCatSub(false);
    }
  }

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
          subCategoriaId: initial.subCategoriaId || "",
          especificacoes: initial.especificacoes || "",
          observacaoInterna: initial.observacaoInterna || "",
          marcaId: initial.marcaId || "",
          modelo: initial.modelo || "",
        });
        try {
          setFotos(initial.fotos ? JSON.parse(initial.fotos) : []);
        } catch {
          setFotos([]);
        }
        setPrecosMercado(null);
        setAvulsos(
          Array.isArray(initial.acessoriosAvulsos)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? initial.acessoriosAvulsos.map((a: any) => ({
                nome: a.nome,
                quantidade: a.quantidade || 1,
              }))
            : []
        );
        setArquivos([]);
        setLinkArquivo("");
        if (initial.id) {
          fetch(`/api/itens/${initial.id}/arquivos`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d && setArquivos(d.arquivos || []))
            .catch(() => {});
        }
      } else {
        setForm(emptyForm());
        setFotos([]);
        setPrecosMercado(null);
        setAvulsos([]);
        setArquivos([]);
        setLinkArquivo("");
      }
      fetch("/api/marcas")
        .then((r) => r.json())
        .then((d) => setMarcas(d.marcas || []))
        .catch(() => setMarcas([]));
      carregarCategorias();
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
    if (!form.categoriaId) errs.categoriaId = "Escolha ou crie uma categoria";
    if (!form.subCategoriaId) errs.subCategoriaId = "Escolha ou crie uma subcategoria";
    setErrors(errs);
    if (errs.categoriaId || errs.subCategoriaId)
      toast("Categoria e subcategoria são obrigatórias.", "error");
    return Object.keys(errs).length === 0;
  }

  // Antes de finalizar, confirma quantidade e valor (evita cadastrar com 0 sem
  // querer). Serviço confirma só o valor (não tem estoque).
  function handleSubmit() {
    if (!validate()) return;
    setConfirmarQtd(true);
  }

  // Ao editar com o nome mudado, verifica onde mais o nome antigo aparece e
  // pergunta se a alteração vale para todos; senão salva direto.
  async function salvar() {
    setConfirmarQtd(false);
    const nomeAntigo = String(initial?.nome || "").trim();
    const nomeNovo = form.nome.trim();
    if (form.id && nomeAntigo && nomeNovo && nomeAntigo.toLowerCase() !== nomeNovo.toLowerCase()) {
      try {
        const q = new URLSearchParams({ nome: nomeAntigo, id: form.id });
        const imp = await fetch(`/api/itens/impacto-nome?${q}`).then((r) => r.json());
        const total = (imp.itens || 0) + (imp.faturas || 0) + (imp.orcamentos || 0);
        if (total > 0) {
          setRenomearInfo({
            de: nomeAntigo,
            para: nomeNovo,
            itens: imp.itens || 0,
            faturas: imp.faturas || 0,
            orcamentos: imp.orcamentos || 0,
          });
          return;
        }
      } catch {
        // sem verificação, segue salvando só este item
      }
    }
    await executarSalvar(false);
  }

  async function executarSalvar(renomearTodos: boolean) {
    setRenomearInfo(null);
    setLoading(true);
    try {
      const url = form.id ? `/api/itens/${form.id}` : "/api/itens";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          renomearTodos,
          valorAluguel: parseFloat(form.valorAluguel) || 0,
          precoManual: form.precoManual,
          valorSemana: form.precoManual ? parseFloat(form.valorSemana) || 0 : undefined,
          valorQuinzena: form.precoManual ? parseFloat(form.valorQuinzena) || 0 : undefined,
          valorMes: form.precoManual ? parseFloat(form.valorMes) || 0 : undefined,
          quantidade: parseInt(form.quantidade) || 0,
          categoriaId: form.categoriaId || null,
          marcaId: form.marcaId || null,
          fotos,
          acessoriosAvulsos: avulsos,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Erro ao salvar. Tente novamente.", "error");
        return;
      }
      const r = data.renomeados;
      const extra = r
        ? ` Nome alterado também em ${r.itens} item(ns), ${r.orcamentos} linha(s) de orçamento e ${r.faturas} de fatura.`
        : "";
      toast(
        form.id ? `Item atualizado com sucesso!${extra}` : "Item criado com sucesso!",
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
  const subCategoriaOptions = (
    categorias.find((c) => c.id === form.categoriaId)?.subCategorias || []
  ).map((sc) => ({ value: sc.id, label: sc.nome }));

  function addAvulso() {
    const nome = novoAvulso.trim();
    if (!nome) return;
    setAvulsos((p) => [...p, { nome, quantidade: Math.max(1, Number(novoAvulsoQtd) || 1) }]);
    setNovoAvulso("");
    setNovoAvulsoQtd("1");
  }

  async function uploadArquivoItem(file: File) {
    if (!form.id) return;
    setEnviandoArquivo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (nomeAnexo.trim()) fd.append("titulo", nomeAnexo.trim());
      const res = await fetch(`/api/itens/${form.id}/arquivos`, { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setArquivos((p) => [d, ...p]);
      setNomeAnexo("");
      toast("Arquivo anexado ao item!", "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao enviar.", "error");
    } finally {
      setEnviandoArquivo(false);
    }
  }

  async function addLinkArquivo() {
    if (!form.id || !linkArquivo.trim()) return;
    setEnviandoArquivo(true);
    try {
      const res = await fetch(`/api/itens/${form.id}/arquivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkArquivo.trim(), titulo: nomeAnexo.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setArquivos((p) => [d, ...p]);
      setLinkArquivo("");
      setNomeAnexo("");
      toast("Link anexado ao item!", "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao anexar.", "error");
    } finally {
      setEnviandoArquivo(false);
    }
  }

  async function removerArquivoItem(arquivoId: string) {
    if (!form.id) return;
    try {
      const res = await fetch(`/api/itens/${form.id}/arquivos?arquivoId=${arquivoId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setArquivos((p) => p.filter((a) => a.id !== arquivoId));
    } catch {
      toast("Erro ao remover arquivo.", "error");
    }
  }

  return (
    <>
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
            </div>
            <Input
              label="Código"
              value={form.codigo}
              onChange={(e) => setField("codigo", e.target.value)}
              placeholder="Ex: #336-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  label="Marca / Fabricante"
                  value={form.marcaId}
                  onChange={(e) => setField("marcaId", e.target.value)}
                  options={marcas.map((m) => ({ value: m.id, label: m.nome }))}
                  placeholder="Selecione ou crie"
                  searchable
                  clearable
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  const nome = window.prompt("Nome da nova marca:");
                  if (!nome?.trim()) return;
                  try {
                    const res = await fetch("/api/marcas", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ nome: nome.trim() }),
                    });
                    const nova = await res.json();
                    if (!res.ok) throw new Error(nova.error);
                    setMarcas((p) => [...p, nova]);
                    setField("marcaId", nova.id);
                    toast(`Marca "${nova.nome}" criada!`, "success");
                  } catch (e) {
                    toast(e instanceof Error && e.message ? e.message : "Erro ao criar marca.", "error");
                  }
                }}
                className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors shrink-0"
              >
                + Nova
              </button>
            </div>
            <Input
              label="Modelo"
              value={form.modelo}
              onChange={(e) => setField("modelo", e.target.value)}
              placeholder="Ex: MAC Aura XB, SM58, X32"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
                <PreencherIa
                  tipo="item"
                  texto={form.nome}
                  extra={{
                    marca: marcas.find((m) => m.id === form.marcaId)?.nome || "",
                    modelo: form.modelo,
                  }}
                  onDados={async (d) => {
                    // Marca: seleciona existente ou cria automaticamente
                    let marcaId = form.marcaId;
                    if (!marcaId && d.marca) {
                      const existente = marcas.find(
                        (m) => m.nome.toLowerCase() === String(d.marca).toLowerCase()
                      );
                      if (existente) marcaId = existente.id;
                      else {
                        try {
                          const res = await fetch("/api/marcas", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ nome: d.marca }),
                          });
                          const nova = await res.json();
                          if (res.ok && nova?.id) {
                            setMarcas((p) => [...p, nova]);
                            marcaId = nova.id;
                          }
                        } catch {}
                      }
                    }
                    // Categoria sugerida (se bater com uma existente)
                    let categoriaId = form.categoriaId;
                    if (!categoriaId && d.categoriaSugerida) {
                      const cat = categorias.find(
                        (c) => c.nome.toLowerCase() === String(d.categoriaSugerida).toLowerCase()
                      );
                      if (cat) categoriaId = cat.id;
                    }
                    setForm((p) => ({
                      ...p,
                      marcaId,
                      categoriaId,
                      modelo: p.modelo || d.modelo || "",
                      especificacoes: p.especificacoes || d.especificacoes || "",
                      descricaoComercial: p.descricaoComercial || d.descricaoComercial || "",
                      watts: p.watts || (d.watts != null ? String(d.watts) : ""),
                      valorReposicao:
                        p.valorReposicao ||
                        (d.valorReposicao != null ? String(d.valorReposicao) : ""),
                      apelidos:
                        p.apelidos ||
                        [d.apelidoComercial, d.apelidos].filter(Boolean).join(", "),
                      videoUrl: p.videoUrl || d.videoUrl || "",
                    }));
                    if (d.videoUrl) toast("Sugestão de vídeo adicionada. 🎬", "success");
                    if (d.fotosAviso) toast(d.fotosAviso, "error");
                    // Fotos do modelo encontradas na web (já salvas no banco)
                    if (Array.isArray(d.fotos) && d.fotos.length > 0) {
                      setFotos((prev) => [
                        ...prev,
                        ...d.fotos.filter((u: string) => !prev.includes(u)),
                      ]);
                    }
                  }}
                />
            <p className="text-xs text-slate-400">
              Dica: preencha marca e modelo antes — a IA busca as especificações e fotos do
              modelo real.
            </p>
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

          {/* Sugestões de preço de mercado (pesquisa na web via IA) */}
          {form.natureza !== "SERVICO" && (
            <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    💰 Sugestões de preço de mercado
                  </p>
                  <p className="text-xs text-slate-400">
                    Pesquisa quanto concorrentes cobram pela locação deste equipamento
                    (diária e períodos) e o valor de reposição.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pesquisandoPrecos}
                  onClick={async () => {
                    if (!form.nome || form.nome.trim().length < 3) {
                      toast("Preencha o nome do item primeiro.", "error");
                      return;
                    }
                    setPesquisandoPrecos(true);
                    try {
                      const res = await fetch("/api/ia/preencher", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          tipo: "precos",
                          texto: form.nome,
                          marca: marcas.find((m) => m.id === form.marcaId)?.nome || "",
                          modelo: form.modelo,
                        }),
                      });
                      const d = await res.json();
                      if (!res.ok) throw new Error(d.error);
                      setPrecosMercado(d.dados);
                    } catch (e) {
                      toast(
                        e instanceof Error && e.message ? e.message : "Erro na pesquisa.",
                        "error"
                      );
                    } finally {
                      setPesquisandoPrecos(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-violet-200 bg-white text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-60 shrink-0"
                >
                  {pesquisandoPrecos ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                  ) : (
                    "🔎"
                  )}
                  {pesquisandoPrecos ? "Pesquisando..." : "Pesquisar mercado"}
                </button>
              </div>

              {precosMercado && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { rotulo: "Diária", valor: precosMercado.diaria, aplicar: () => setField("valorAluguel", String(precosMercado.diaria)) },
                      { rotulo: "Semana", valor: precosMercado.semana, aplicar: () => { setField("precoManual", true); setField("valorSemana", String(precosMercado.semana)); } },
                      { rotulo: "Quinzena", valor: precosMercado.quinzena, aplicar: () => { setField("precoManual", true); setField("valorQuinzena", String(precosMercado.quinzena)); } },
                      { rotulo: "Mês", valor: precosMercado.mes, aplicar: () => { setField("precoManual", true); setField("valorMes", String(precosMercado.mes)); } },
                      { rotulo: "Reposição", valor: precosMercado.reposicao, aplicar: () => setField("valorReposicao", String(precosMercado.reposicao)) },
                    ].map((c) => (
                      <div key={c.rotulo} className="rounded-lg bg-white border border-violet-100 p-2 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">{c.rotulo}</p>
                        <p className="text-sm font-bold text-slate-800">
                          {c.valor != null ? formatCurrency(Number(c.valor)) : "—"}
                        </p>
                        {c.valor != null && (
                          <button
                            type="button"
                            onClick={c.aplicar}
                            className="mt-1 text-[11px] font-medium text-violet-600 hover:underline"
                          >
                            Aplicar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {precosMercado.diariaMin != null && precosMercado.diariaMax != null && (
                    <p className="text-xs text-slate-500">
                      Faixa de diária encontrada: {formatCurrency(Number(precosMercado.diariaMin))}{" "}
                      a {formatCurrency(Number(precosMercado.diariaMax))}
                    </p>
                  )}
                  {precosMercado.aviso && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                      ⚠ {precosMercado.aviso}
                    </p>
                  )}
                  {Array.isArray(precosMercado.fontes) && precosMercado.fontes.length > 0 && (
                    <p className="text-xs text-slate-500">
                      Empresas com este equipamento: {precosMercado.fontes.join(", ")}
                    </p>
                  )}
                  {precosMercado.observacao && (
                    <p className="text-xs text-slate-400 italic">
                      {precosMercado.origem === "banco"
                        ? "📚 "
                        : precosMercado.origem === "web"
                          ? "🌐 "
                          : "🤖 "}
                      {precosMercado.observacao}
                    </p>
                  )}
                </div>
              )}
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
                <Input
                  label="Slug amigável (URL)"
                  value={form.slug}
                  onChange={(e) => setField("slug", e.target.value)}
                  placeholder="gerado do nome se vazio"
                />
                {/* Fotos do item (galeria) — a capa é escolhida aqui, pela estrela */}
                <FotosUpload
                  label="Fotos do equipamento (clique na ⭐ para definir a capa)"
                  value={fotos}
                  onChange={setFotos}
                  capa={form.fotoCapaUrl}
                  onCapa={(url) => setField("fotoCapaUrl", url)}
                  consultaBusca={[
                    marcas.find((m) => m.id === form.marcaId)?.nome,
                    form.modelo,
                    form.nome,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />

          {/* Acessórios — checklist de separação, sem código/QR */}
          <div className="rounded-lg border border-slate-100 p-3">
            <p className="text-sm font-medium text-slate-700">
              Acessórios do item (checklist de separação)
            </p>
            <p className="text-xs text-slate-400 mb-2">
              Sem código/QR — servem para conferir na hora de separar o material.
              Ex.: base do microfone, bastão, fonte, pilhas, antenas. Aparecem no
              romaneio e na conferência da OS.
            </p>
            {avulsos.length > 0 && (
              <div className="space-y-1 mb-2">
                {avulsos.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 px-1 text-xs font-semibold text-slate-600">
                      {a.quantidade}×
                    </span>
                    <span>{a.nome}</span>
                    <button
                      type="button"
                      onClick={() => setAvulsos((p) => p.filter((_, idx2) => idx2 !== i))}
                      className="ml-auto text-slate-300 hover:text-red-500 text-xs"
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div className="w-20">
                <Input
                  type="number"
                  min={1}
                  value={novoAvulsoQtd}
                  onChange={(e) => setNovoAvulsoQtd(e.target.value)}
                  placeholder="Qtd"
                />
              </div>
              <Input
                value={novoAvulso}
                onChange={(e) => setNovoAvulso(e.target.value)}
                placeholder="Ex.: cabo de energia, pedestal, cabo speakon..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAvulso();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addAvulso}>
                Adicionar
              </Button>
            </div>
          </div>

          {/* Arquivos do item — manuais, apresentações, vídeos, qualquer espécie */}
          <div className="rounded-lg border border-slate-100 p-3">
            <p className="text-sm font-medium text-slate-700">Arquivos do item</p>
            <p className="text-xs text-slate-400 mb-2">
              Manuais, apresentações, vídeo-tutoriais, documentos... qualquer espécie
              (até 4 MB por arquivo; maiores, cole o link).
            </p>
            {!form.id ? (
              <p className="text-xs text-amber-600">
                Salve o item primeiro para poder anexar arquivos.
              </p>
            ) : (
              <>
                {arquivos.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {arquivos.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
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
                        <button
                          type="button"
                          onClick={() => removerArquivoItem(a.id)}
                          className="ml-auto text-slate-300 hover:text-red-500 text-xs"
                        >
                          remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  value={nomeAnexo}
                  onChange={(e) => setNomeAnexo(e.target.value)}
                  placeholder="Nome do anexo (ex.: Manual do usuário) — vira o nome do link"
                  className="mb-2"
                />
                <div className="flex flex-wrap gap-2 items-center">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:border-blue-300 cursor-pointer">
                    {enviandoArquivo ? "Enviando..." : "📤 Enviar arquivo"}
                    <input
                      type="file"
                      className="hidden"
                      disabled={enviandoArquivo}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadArquivoItem(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="flex-1 min-w-40 flex gap-2">
                    <Input
                      value={linkArquivo}
                      onChange={(e) => setLinkArquivo(e.target.value)}
                      placeholder="ou cole um link (Drive, YouTube...)"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addLinkArquivo();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addLinkArquivo}
                      loading={enviandoArquivo}
                    >
                      Anexar link
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <Textarea
                  label="Descrição comercial"
                  value={form.descricaoComercial}
                  onChange={(e) => setField("descricaoComercial", e.target.value)}
                  placeholder="Texto de apresentação para clientes..."
                  rows={3}
                />
                <p className="text-xs text-slate-400">
                  As especificações técnicas públicas usam o campo “Especificações / Descrição”
                  abaixo — não precisa repetir aqui.
                </p>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-end gap-1">
                <div className="flex-1">
                  <Select
                    label="Categoria *"
                    value={form.categoriaId}
                    onChange={(e) => {
                      setField("categoriaId", e.target.value);
                      setField("subCategoriaId", "");
                    }}
                    options={categoriaOptions}
                    placeholder="Selecione a categoria"
                    error={errors.categoriaId}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCriarCatOpen((v) => !v);
                    setCriarSubOpen(false);
                  }}
                  title="Incluir nova categoria"
                  className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {criarCatOpen && (
                <div className="flex gap-1 mt-1.5">
                  <Input
                    value={novaCatNome}
                    onChange={(e) => setNovaCatNome(e.target.value)}
                    placeholder="Nome da categoria"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        criarCategoriaRapida();
                      }
                    }}
                  />
                  <Button type="button" size="sm" onClick={criarCategoriaRapida} loading={criandoCatSub}>
                    Criar
                  </Button>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-end gap-1">
                <div className="flex-1">
                  <Select
                    label="Subcategoria *"
                    value={form.subCategoriaId}
                    onChange={(e) => setField("subCategoriaId", e.target.value)}
                    options={subCategoriaOptions}
                    placeholder={
                      form.categoriaId
                        ? subCategoriaOptions.length
                          ? "Selecione"
                          : "Use o + para criar"
                        : "Escolha a categoria antes"
                    }
                    disabled={!form.categoriaId || subCategoriaOptions.length === 0}
                    error={errors.subCategoriaId}
                  />
                </div>
                <button
                  type="button"
                  disabled={!form.categoriaId}
                  onClick={() => {
                    setCriarSubOpen((v) => !v);
                    setCriarCatOpen(false);
                  }}
                  title="Incluir nova subcategoria"
                  className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {criarSubOpen && form.categoriaId && (
                <div className="flex gap-1 mt-1.5">
                  <Input
                    value={novaSubNome}
                    onChange={(e) => setNovaSubNome(e.target.value)}
                    placeholder="Nome da subcategoria"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        criarSubRapida();
                      }
                    }}
                  />
                  <Button type="button" size="sm" onClick={criarSubRapida} loading={criandoCatSub}>
                    Criar
                  </Button>
                </div>
              )}
            </div>
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
            label="Especificações / Descrição (também usada como specs públicas)"
            value={form.especificacoes}
            onChange={(e) => setField("especificacoes", e.target.value)}
            placeholder="Detalhes técnicos, potência, dimensões..."
            rows={3}
          />

          <Textarea
            label="Observação interna (uso interno — não aparece no catálogo)"
            value={form.observacaoInterna}
            onChange={(e) => setField("observacaoInterna", e.target.value)}
            placeholder="Ex.: 'unidade 03 com risco na tampa', 'comprado em 2023', fornecedor..."
            rows={2}
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

    {/* Confirmação de quantidade e valor — evita cadastrar com 0 sem querer */}
    <Modal
      open={confirmarQtd}
      onClose={() => setConfirmarQtd(false)}
      title="Confirmar quantidade e valor"
      size="sm"
    >
      <ModalBody>
        <p className="text-sm text-slate-600 mb-3">
          Confira antes de finalizar <strong>{form.nome || "este item"}</strong>.
        </p>
        <div className="space-y-3">
          {form.natureza !== "SERVICO" && (
            <Input
              label="Quantidade em estoque"
              type="number"
              min="0"
              autoFocus
              value={form.quantidade}
              onChange={(e) => setField("quantidade", e.target.value)}
            />
          )}
          <Input
            label={form.natureza === "SERVICO" ? "Valor do serviço (R$)" : "Valor da diária (R$)"}
            type="number"
            step="0.01"
            min="0"
            autoFocus={form.natureza === "SERVICO"}
            value={form.valorAluguel}
            onChange={(e) => setField("valorAluguel", e.target.value)}
          />
        </div>
        {form.natureza !== "SERVICO" && (parseInt(form.quantidade) || 0) === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1.5 mt-2">
            ⚠️ Quantidade <strong>0</strong>: o item ficará sem estoque e não poderá ser
            separado/alugado até você ajustar.
          </p>
        )}
        {(parseFloat(form.valorAluguel) || 0) === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1.5 mt-2">
            ⚠️ Valor <strong>R$ 0,00</strong>: o item entrará nos orçamentos sem preço. Confirme
            só se for intencional (ex.: cortesia).
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={() => setConfirmarQtd(false)} disabled={loading}>
          Voltar e ajustar
        </Button>
        <Button onClick={salvar} loading={loading}>
          Confirmar e {form.id ? "salvar" : "criar"}
        </Button>
      </ModalFooter>
    </Modal>

    {/* Nome alterado — aplicar em todos os lugares onde o nome antigo aparece? */}
    <Modal
      open={!!renomearInfo}
      onClose={() => setRenomearInfo(null)}
      title="Alterar o nome em todos?"
      size="sm"
    >
      <ModalBody>
        {renomearInfo && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Você mudou <strong>&quot;{renomearInfo.de}&quot;</strong> para{" "}
              <strong>&quot;{renomearInfo.para}&quot;</strong>. O nome antigo também aparece em:
            </p>
            <ul className="space-y-1 text-sm">
              {renomearInfo.itens > 0 && (
                <li>
                  📦 <strong>{renomearInfo.itens}</strong> outro{renomearInfo.itens > 1 ? "s" : ""} item
                  {renomearInfo.itens > 1 ? "ns" : ""} com o mesmo nome
                </li>
              )}
              {renomearInfo.orcamentos > 0 && (
                <li>
                  📄 <strong>{renomearInfo.orcamentos}</strong> linha{renomearInfo.orcamentos > 1 ? "s" : ""} de
                  orçamentos pendentes
                </li>
              )}
              {renomearInfo.faturas > 0 && (
                <li>
                  🧾 <strong>{renomearInfo.faturas}</strong> linha{renomearInfo.faturas > 1 ? "s" : ""} de
                  faturas ainda não emitidas
                </li>
              )}
            </ul>
            <p className="text-xs text-slate-400">
              Faturas já emitidas e orçamentos aprovados não mudam (são documentos fechados).
            </p>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={() => executarSalvar(false)} loading={loading}>
          Só neste item
        </Button>
        <Button onClick={() => executarSalvar(true)} loading={loading}>
          Alterar em todos
        </Button>
      </ModalFooter>
    </Modal>
    </>
  );
}
