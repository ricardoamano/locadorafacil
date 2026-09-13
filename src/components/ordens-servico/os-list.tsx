"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Users,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

// Colunas ordenáveis (clique no título alterna ▲/▼). Padrão: data do evento.
type Coluna = "numero" | "cliente" | "data" | "equipe" | "status";
const COLUNAS: { key: Coluna; label: string; align: "left" | "center" }[] = [
  { key: "numero", label: "OS / Orçamento", align: "left" },
  { key: "cliente", label: "Cliente / Evento", align: "left" },
  { key: "data", label: "Data", align: "left" },
  { key: "equipe", label: "Equipe", align: "center" },
  { key: "status", label: "Status", align: "left" },
];

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  ABERTA: { label: "Aberta", variant: "info" },
  EM_ANDAMENTO: { label: "Em andamento", variant: "warning" },
  CONCLUIDA: { label: "Concluída", variant: "success" },
  CANCELADA: { label: "Cancelada", variant: "neutral" },
};

interface OS {
  id: string;
  status: string;
  createdAt: string;
  orcamento: {
    id: string;
    numero: number;
    eventoNome: string | null;
    dataInicio: string | null;
    total: number;
    cliente: { nomeFantasia: string };
    local: { nome: string } | null;
  };
  _count: { escala: number };
}

interface OrcamentoOpt {
  id: string;
  numero: number;
  cliente?: { nomeFantasia: string };
}

export function OsList() {
  const { toast } = useToast();
  const [ordens, setOrdens] = useState<OS[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<Coluna>("data");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);

  function ordenarPor(col: Coluna) {
    if (col === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDir("asc");
    }
    setPage(1);
  }
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Modal nova OS
  const [novaOpen, setNovaOpen] = useState(false);
  const [orcamentos, setOrcamentos] = useState<OrcamentoOpt[]>([]);
  const [orcSelecionado, setOrcSelecionado] = useState("");
  const [criando, setCriando] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchOrdens = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status: statusFilter,
        sort,
        dir,
      });
      const res = await fetch(`/api/ordens-servico?${params}`);
      const data = await res.json();
      setOrdens(data.ordens || []);
      setTotal(data.total || 0);
    } catch {
      toast("Erro ao carregar ordens de serviço.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, sort, dir, toast]);

  useEffect(() => {
    fetchOrdens();
  }, [fetchOrdens]);

  function abrirNova() {
    setOrcSelecionado("");
    setNovaOpen(true);
    fetch("/api/orcamentos?status=APROVADO&limit=100")
      .then((r) => r.json())
      .then((d) => setOrcamentos(d.orcamentos || []))
      .catch(() => setOrcamentos([]));
  }

  async function criarOS() {
    if (!orcSelecionado) {
      toast("Selecione um orçamento aprovado.", "error");
      return;
    }
    setCriando(true);
    try {
      const res = await fetch("/api/ordens-servico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orcamentoId: orcSelecionado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      toast("OS criada com sucesso!", "success");
      setNovaOpen(false);
      fetchOrdens();
    } catch (e) {
      toast(e instanceof Error && e.message !== "Erro" ? e.message : "Erro ao criar OS.", "error");
    } finally {
      setCriando(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/ordens-servico/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("OS excluída com sucesso.", "success");
      setDeleteId(null);
      fetchOrdens();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os status</option>
          {Object.entries(statusConfig).map(([value, cfg]) => (
            <option key={value} value={value}>
              {cfg.label}
            </option>
          ))}
        </select>

        <Button onClick={abrirNova}>
          <Plus className="h-4 w-4" />
          Nova OS
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : ordens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
            <ClipboardList className="h-8 w-8" />
            <p className="text-sm">
              {statusFilter
                ? "Nenhuma OS encontrada"
                : "Nenhuma ordem de serviço criada ainda"}
            </p>
            {!statusFilter && (
              <Button size="sm" onClick={abrirNova}>
                <Plus className="h-4 w-4" />
                Criar OS
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {COLUNAS.map((c) => {
                  const ativa = sort === c.key;
                  const Icone = !ativa ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={c.key}
                      aria-sort={ativa ? (dir === "asc" ? "ascending" : "descending") : "none"}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${
                        c.align === "center" ? "text-center" : "text-left"
                      } ${ativa ? "text-slate-900" : "text-slate-500"}`}
                    >
                      <button
                        type="button"
                        onClick={() => ordenarPor(c.key)}
                        className="inline-flex items-center gap-1 hover:text-slate-900 min-h-8"
                        title={`Ordenar por ${c.label.toLowerCase()}`}
                      >
                        {c.label}
                        <Icone className={`h-3 w-3 ${ativa ? "" : "opacity-40"}`} />
                      </button>
                    </th>
                  );
                })}
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ordens.map((os) => {
                const cfg = statusConfig[os.status] || statusConfig.ABERTA;
                return (
                  <tr key={os.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-medium text-slate-700">
                        OS #{os.orcamento.numero}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">
                        {os.orcamento.cliente?.nomeFantasia}
                      </p>
                      <p className="text-xs text-slate-400">
                        {os.orcamento.eventoNome || "—"}
                        {os.orcamento.local ? ` · ${os.orcamento.local.nome}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {os.orcamento.dataInicio
                        ? new Date(os.orcamento.dataInicio).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {os._count.escala}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/ordens-servico/${os.id}`}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Abrir"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteId(os.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">{total} ordens no total</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal Nova OS */}
      <Modal open={novaOpen} onClose={() => setNovaOpen(false)} title="Nova Ordem de Serviço" size="md">
        <ModalBody>
          <p className="text-sm text-slate-500 mb-3">
            Selecione um orçamento <strong>aprovado</strong> para gerar a OS. Cliente,
            evento e equipamentos serão herdados automaticamente.
          </p>
          <Select
            label="Orçamento Aprovado"
            value={orcSelecionado}
            onChange={(e) => setOrcSelecionado(e.target.value)}
            options={orcamentos.map((o) => ({
              value: o.id,
              label: `#${o.numero}${o.cliente ? ` — ${o.cliente.nomeFantasia}` : ""}`,
            }))}
            placeholder="Selecione"
          />
          {orcamentos.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">
              Nenhum orçamento aprovado disponível. Aprove um orçamento primeiro.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setNovaOpen(false)} disabled={criando}>
            Cancelar
          </Button>
          <Button onClick={criarOS} loading={criando}>
            Criar OS
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        message="Deseja realmente excluir esta OS? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
