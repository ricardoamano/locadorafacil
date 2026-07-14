"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ExportarCsv } from "@/components/ui/exportar-csv";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatPhone, formatRG, formatCPF } from "@/lib/utils";
import { Plus, Pencil, Trash2, UserCheck, Copy, Star, X } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const tipoLabels: Record<string, string> = {
  FUNCIONARIO: "Funcionário",
  FREELANCER: "Freelancer",
  TECNICO: "Técnico",
};

interface Membro {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  rg: string | null;
  cpf: string | null;
  tipo: string;
  pix: string | null;
  cache: number | null;
  user: { id: string; name: string | null; email: string } | null;
  especialidades: { especialidade: { id: string; nome: string } }[];
  avaliacaoMedia: number | null;
  avaliacoesTotal: number;
}

interface FormData {
  id?: string;
  nome: string;
  telefone: string;
  email: string;
  rg: string;
  cpf: string;
  tipo: string;
  pix: string;
  cache: string;
  userId: string;
  especialidades: string[];
}

const empty = (): FormData => ({
  nome: "", telefone: "", email: "", rg: "", cpf: "", tipo: "FREELANCER", pix: "", cache: "",
  userId: "", especialidades: [],
});

// ── Estrelas ──────────────────────────────────────────────────────────────────

function Estrelas({
  valor,
  onChange,
  tamanho = "h-5 w-5",
}: {
  valor: number;
  onChange?: (v: number) => void;
  tamanho?: string;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <Star
            className={`${tamanho} ${
              n <= valor ? "fill-amber-400 text-amber-400" : "text-slate-200"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

const CRITERIOS: { key: "postura" | "tecnica" | "pontualidade" | "proatividade"; label: string }[] = [
  { key: "postura", label: "Postura / comportamento" },
  { key: "tecnica", label: "Conhecimento técnico" },
  { key: "pontualidade", label: "Pontualidade" },
  { key: "proatividade", label: "Proatividade" },
];

export default function MembrosPage() {
  const { toast } = useToast();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [especialidades, setEspecialidades] = useState<{ id: string; nome: string }[]>([]);
  const [novaEsp, setNovaEsp] = useState("");
  const [criandoEsp, setCriandoEsp] = useState(false);
  const [filtroEsp, setFiltroEsp] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormData>(empty());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Avaliações
  const [avaliando, setAvaliando] = useState<Membro | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [avForm, setAvForm] = useState({
    nota: 0, postura: 0, tecnica: 0, pontualidade: 0, proatividade: 0,
    comentario: "", evento: "",
  });
  const [avSalvando, setAvSalvando] = useState(false);
  const [eventos, setEventos] = useState<{ id: string; label: string }[]>([]);

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }
  function toggleTodos() {
    setSelecionados((prev) =>
      prev.size === membros.length ? new Set() : new Set(membros.map((m) => m.id))
    );
  }
  async function copiarSelecionados() {
    const lista = membros.filter((m) => selecionados.has(m.id));
    if (lista.length === 0) {
      toast("Selecione ao menos um membro.", "error");
      return;
    }
    const texto = lista
      .map((m) =>
        [m.nome, m.rg ? `RG: ${m.rg}` : null, m.cpf ? `CPF: ${m.cpf}` : null]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(texto);
      toast(`Dados de ${lista.length} membro(s) copiados!`, "success");
    } catch {
      toast("Não foi possível copiar.", "error");
    }
  }

  const fetchMembros = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/membros");
      const data = await res.json();
      setMembros(data.membros || []);
    } catch {
      toast("Erro ao carregar membros.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchEspecialidades = useCallback(() => {
    fetch("/api/especialidades")
      .then((r) => r.json())
      .then((d) => setEspecialidades(d.especialidades || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMembros();
    fetchEspecialidades();
    fetch("/api/usuarios/lista")
      .then((r) => r.json())
      .then((d) => setUsuarios(d.usuarios || []))
      .catch(() => {});
    // Eventos realizados (orçamentos aprovados) para vincular avaliações
    fetch("/api/orcamentos?status=APROVADO&limit=200")
      .then((r) => r.json())
      .then((d) =>
        setEventos(
          (d.orcamentos || []).map((o: any) => ({
            id: o.id,
            label: `${o.eventoNome || `Orçamento #${o.numero}`} — ${o.cliente?.nomeFantasia || "?"}${
              o.dataInicio ? ` (${new Date(o.dataInicio).toLocaleDateString("pt-BR")})` : ""
            }`,
          }))
        )
      )
      .catch(() => {});
  }, [fetchMembros, fetchEspecialidades]);

  function openCreate() {
    setForm(empty());
    setModalOpen(true);
  }
  function openEdit(m: Membro) {
    setForm({
      id: m.id,
      nome: m.nome,
      telefone: m.telefone || "",
      email: m.email || "",
      rg: m.rg || "",
      cpf: m.cpf || "",
      tipo: m.tipo,
      pix: m.pix || "",
      cache: m.cache != null ? String(m.cache) : "",
      userId: m.user?.id || "",
      especialidades: (m.especialidades || []).map((e) => e.especialidade.id),
    });
    setModalOpen(true);
  }

  function toggleEspecialidade(id: string) {
    setForm((p) => ({
      ...p,
      especialidades: p.especialidades.includes(id)
        ? p.especialidades.filter((x) => x !== id)
        : [...p.especialidades, id],
    }));
  }

  async function criarEspecialidade() {
    const nome = novaEsp.trim();
    if (!nome) return;
    setCriandoEsp(true);
    try {
      const res = await fetch("/api/especialidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setNovaEsp("");
      fetchEspecialidades();
      setForm((p) =>
        p.especialidades.includes(d.id)
          ? p
          : { ...p, especialidades: [...p.especialidades, d.id] }
      );
      toast(`Especialidade "${d.nome}" criada e selecionada.`, "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao criar.", "error");
    } finally {
      setCriandoEsp(false);
    }
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast("Informe o nome.", "error");
      return;
    }
    setSaving(true);
    try {
      const url = form.id ? `/api/membros/${form.id}` : "/api/membros";
      const res = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      toast(form.id ? "Membro atualizado!" : "Membro criado!", "success");
      setModalOpen(false);
      fetchMembros();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/membros/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Membro excluído.", "success");
      setDeleteId(null);
      fetchMembros();
    } catch {
      toast("Erro ao excluir. Verifique se não está escalado em uma OS.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Avaliações ──────────────────────────────────────────────────────────────

  async function abrirAvaliacao(m: Membro) {
    setAvaliando(m);
    setAvForm({ nota: 0, postura: 0, tecnica: 0, pontualidade: 0, proatividade: 0, comentario: "", evento: "" });
    try {
      const res = await fetch(`/api/membros/${m.id}/avaliacoes`);
      const d = await res.json();
      setAvaliacoes(d.avaliacoes || []);
    } catch {
      setAvaliacoes([]);
    }
  }

  async function salvarAvaliacao() {
    if (!avaliando) return;
    if (!avForm.nota) {
      toast("Dê a nota geral (estrelas).", "error");
      return;
    }
    setAvSalvando(true);
    try {
      const res = await fetch(`/api/membros/${avaliando.id}/avaliacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...avForm,
          postura: avForm.postura || undefined,
          tecnica: avForm.tecnica || undefined,
          pontualidade: avForm.pontualidade || undefined,
          proatividade: avForm.proatividade || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast("Avaliação registrada! ⭐", "success");
      setAvForm({ nota: 0, postura: 0, tecnica: 0, pontualidade: 0, proatividade: 0, comentario: "", evento: "" });
      const at = await fetch(`/api/membros/${avaliando.id}/avaliacoes`).then((r) => r.json());
      setAvaliacoes(at.avaliacoes || []);
      fetchMembros();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao salvar.", "error");
    } finally {
      setAvSalvando(false);
    }
  }

  async function excluirAvaliacao(avaliacaoId: string) {
    if (!avaliando) return;
    try {
      const res = await fetch(
        `/api/membros/${avaliando.id}/avaliacoes?avaliacaoId=${avaliacaoId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      setAvaliacoes((p) => p.filter((a) => a.id !== avaliacaoId));
      fetchMembros();
    } catch {
      toast("Erro ao excluir avaliação.", "error");
    }
  }

  const membrosFiltrados = filtroEsp
    ? membros.filter((m) =>
        (m.especialidades || []).some((e) => e.especialidade.id === filtroEsp)
      )
    : membros;

  return (
    <>
      <Header breadcrumbs={[{ label: "Equipe" }, { label: "Membros" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Membros da Equipe</h1>
            <p className="text-sm text-slate-500 mt-1">
              Funcionários, freelancers e técnicos para escalar nos eventos
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filtroEsp}
              onChange={(e) => setFiltroEsp(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Filtrar por especialidade"
            >
              <option value="">Todas as especialidades</option>
              {especialidades.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            {selecionados.size > 0 && (
              <Button variant="outline" onClick={copiarSelecionados}>
                <Copy className="h-4 w-4" />
                Copiar dados ({selecionados.size})
              </Button>
            )}
            <ExportarCsv tipo="membros" />
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Novo Membro
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : membrosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <UserCheck className="h-8 w-8" />
              <p className="text-sm">Nenhum membro cadastrado ainda</p>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Adicionar Membro
              </Button>
            </div>
          ) : (
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={membrosFiltrados.length > 0 && selecionados.size === membrosFiltrados.length}
                      onChange={toggleTodos}
                      title="Selecionar todos os listados"
                      className="h-4 w-4 rounded cursor-pointer"
                    />
                  </th>
                  {["Nome", "Tipo", "Especialidades", "Avaliação", "Telefone", "Cachê", "Ações"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                        i >= 5 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {membrosFiltrados.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selecionados.has(m.id)}
                        onChange={() => toggleSelecionado(m.id)}
                        className="h-4 w-4 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-blue-700 text-sm font-bold">
                          {m.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{m.nome}</p>
                          {m.user && (
                            <p className="text-[11px] text-emerald-600">
                              usuário: {m.user.name || m.user.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{tipoLabels[m.tipo] || m.tipo}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-52">
                        {(m.especialidades || []).slice(0, 3).map((e) => (
                          <span
                            key={e.especialidade.id}
                            className="inline-flex rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[11px] text-blue-700"
                          >
                            {e.especialidade.nome}
                          </span>
                        ))}
                        {(m.especialidades || []).length > 3 && (
                          <span className="text-[11px] text-slate-400">
                            +{m.especialidades.length - 3}
                          </span>
                        )}
                        {(m.especialidades || []).length === 0 && (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {m.avaliacaoMedia != null ? (
                        <button
                          onClick={() => abrirAvaliacao(m)}
                          className="flex items-center gap-1 text-sm text-slate-700 hover:text-amber-600"
                          title={`${m.avaliacoesTotal} avaliação(ões)`}
                        >
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          {m.avaliacaoMedia.toFixed(1)}
                          <span className="text-xs text-slate-400">({m.avaliacoesTotal})</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => abrirAvaliacao(m)}
                          className="text-xs text-slate-400 hover:text-amber-600"
                        >
                          Avaliar
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{m.telefone || "—"}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                      {m.cache != null ? formatCurrency(m.cache) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => abrirAvaliacao(m)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                          title="Avaliar / feedback"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(m)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(m.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal de cadastro/edição */}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={form.id ? "Editar Membro" : "Novo Membro"}
          size="xl"
        >
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Input
                    label="Nome *"
                    value={form.nome}
                    onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>
                <Select
                  label="Tipo"
                  value={form.tipo}
                  onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                  options={Object.entries(tipoLabels).map(([value, label]) => ({ value, label }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Telefone"
                  value={form.telefone}
                  onChange={(e) => setForm((p) => ({ ...p, telefone: formatPhone(e.target.value) }))}
                  placeholder="(11) 99999-9999"
                />
                <Input
                  label="RG"
                  value={form.rg}
                  onChange={(e) => setForm((p) => ({ ...p, rg: formatRG(e.target.value) }))}
                />
                <Input
                  label="CPF"
                  value={form.cpf}
                  onChange={(e) => setForm((p) => ({ ...p, cpf: formatCPF(e.target.value) }))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="E-mail"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="tecnico@email.com"
                />
                <Input
                  label="Chave PIX"
                  value={form.pix}
                  onChange={(e) => setForm((p) => ({ ...p, pix: e.target.value }))}
                  placeholder="CPF, email, telefone ou aleatória"
                />
                <Input
                  label="Cachê padrão (R$)"
                  type="number"
                  step="0.01"
                  value={form.cache}
                  onChange={(e) => setForm((p) => ({ ...p, cache: e.target.value }))}
                  placeholder="0,00"
                />
                <Select
                  label="Usuário do sistema (vínculo)"
                  value={form.userId}
                  onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
                  options={usuarios.map((u) => ({
                    value: u.id,
                    label: u.name || u.email,
                  }))}
                  placeholder="Sem vínculo"
                  clearable
                />
              </div>

              {/* Especialidades */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Especialidades
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {especialidades.map((e) => {
                    const on = form.especialidades.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => toggleEspecialidade(e.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          on
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        {e.nome}
                      </button>
                    );
                  })}
                  {especialidades.length === 0 && (
                    <span className="text-xs text-slate-400">
                      Nenhuma especialidade ainda — crie a primeira abaixo.
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={novaEsp}
                    onChange={(e) => setNovaEsp(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        criarEspecialidade();
                      }
                    }}
                    placeholder='Nova especialidade (ex.: "Técnico de som básico")'
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={criarEspecialidade}
                    loading={criandoEsp}
                  >
                    <Plus className="h-4 w-4" />
                    Criar
                  </Button>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {form.id ? "Salvar" : "Criar"}
            </Button>
          </ModalFooter>
        </Modal>

        {/* Modal de avaliação / feedback */}
        <Modal
          open={!!avaliando}
          onClose={() => setAvaliando(null)}
          title={avaliando ? `⭐ Avaliar ${avaliando.nome}` : ""}
          size="lg"
        >
          <ModalBody>
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">Nota geral *</span>
                  <Estrelas valor={avForm.nota} onChange={(v) => setAvForm((p) => ({ ...p, nota: v }))} />
                </div>
                {CRITERIOS.map((c) => (
                  <div key={c.key} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{c.label}</span>
                    <Estrelas
                      valor={avForm[c.key]}
                      onChange={(v) => setAvForm((p) => ({ ...p, [c.key]: v }))}
                      tamanho="h-4 w-4"
                    />
                  </div>
                ))}
                <Select
                  label="Evento realizado (opcional)"
                  value={avForm.evento}
                  onChange={(e) => setAvForm((p) => ({ ...p, evento: e.target.value }))}
                  options={eventos.map((ev) => ({ value: ev.label, label: ev.label }))}
                  placeholder="Busque o evento realizado..."
                  searchable
                  clearable
                />
                <Textarea
                  label="Comentários"
                  value={avForm.comentario}
                  onChange={(e) => setAvForm((p) => ({ ...p, comentario: e.target.value }))}
                  placeholder="Postura, comportamento com o cliente, pontos fortes e a melhorar..."
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={salvarAvaliacao} loading={avSalvando}>
                    Salvar avaliação
                  </Button>
                </div>
              </div>

              {/* Histórico */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">
                  Histórico ({avaliacoes.length})
                </h4>
                {avaliacoes.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhuma avaliação ainda.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {avaliacoes.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-lg border border-slate-100 p-3 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Estrelas valor={a.nota} tamanho="h-3.5 w-3.5" />
                            <span className="text-xs text-slate-400">
                              {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                              {a.autor ? ` · ${a.autor}` : ""}
                            </span>
                          </div>
                          <button
                            onClick={() => excluirAvaliacao(a.id)}
                            className="text-slate-300 hover:text-red-500"
                            title="Excluir"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {a.evento && (
                          <p className="text-xs text-slate-500 mt-1">Evento: {a.evento}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                          {a.postura && <span>Postura: {a.postura}/5</span>}
                          {a.tecnica && <span>Técnica: {a.tecnica}/5</span>}
                          {a.pontualidade && <span>Pontualidade: {a.pontualidade}/5</span>}
                          {a.proatividade && <span>Proatividade: {a.proatividade}/5</span>}
                        </div>
                        {a.comentario && (
                          <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap">
                            {a.comentario}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setAvaliando(null)}>
              Fechar
            </Button>
          </ModalFooter>
        </Modal>

        <ConfirmDialog
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
          message="Deseja realmente excluir este membro?"
        />
      </main>
    </>
  );
}
