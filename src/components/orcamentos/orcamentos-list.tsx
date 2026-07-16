"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Copy,
  Printer,
  Share2,
  Kanban,
  Zap,
} from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  PENDENTE: { label: "Pendente", variant: "warning" },
  AGUARDANDO: { label: "Aguardando", variant: "info" },
  APROVADO: { label: "Aprovado", variant: "success" },
  REPROVADO: { label: "Reprovado", variant: "danger" },
  CANCELADO: { label: "Cancelado", variant: "neutral" },
};

interface Orcamento {
  id: string;
  numero: number;
  status: string;
  eventoNome: string | null;
  dataInicio: string | null;
  total: number;
  cliente: { id: string; nomeFantasia: string };
  local: { id: string; nome: string } | null;
  _count: { salas: number };
  projetoEspecial?: boolean;
}

export function OrcamentosList() {
  const { toast } = useToast();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const statusInicial =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("status") || ""
      : "";
  const [statusFilter, setStatusFilter] = useState(statusInicial);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const [statusAlvo, setStatusAlvo] = useState<Orcamento | null>(null);
  const [mudandoStatus, setMudandoStatus] = useState(false);

  async function mudarStatus(novo: string) {
    if (!statusAlvo) return;
    setMudandoStatus(true);
    try {
      const res = await fetch(`/api/orcamentos/${statusAlvo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.vinculos?.criouOs) {
        toast(
          `Orçamento #${statusAlvo.numero} aprovado! OS e receita geradas automaticamente. 🎉`,
          "success"
        );
      } else {
        toast(`Status do orçamento #${statusAlvo.numero} atualizado!`, "success");
      }
      setStatusAlvo(null);
      fetchOrcamentos();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao mudar status.", "error");
    } finally {
      setMudandoStatus(false);
    }
  }

  const fetchOrcamentos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        status: statusFilter,
      });
      const res = await fetch(`/api/orcamentos?${params}`);
      const data = await res.json();
      setOrcamentos(data.orcamentos || []);
      setTotal(data.total || 0);
    } catch {
      toast("Erro ao carregar orçamentos.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, toast]);

  useEffect(() => {
    fetchOrcamentos();
  }, [fetchOrcamentos]);


  // Busca em tempo real (debounce) — o botão Buscar continua funcionando
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`/api/orcamentos/${id}`);
      if (!res.ok) throw new Error();
      const orc = await res.json();
      const copia = {
        clienteId: orc.clienteId,
        status: "PENDENTE",
        eventoNome: orc.eventoNome ? `${orc.eventoNome} (cópia)` : null,
        tipoEvento: orc.tipoEvento,
        localId: orc.localId,
        dataInicio: orc.dataInicio,
        dataFim: orc.dataFim,
        observacoes: orc.observacoes,
        obsInternas: orc.obsInternas,
        formaPagamento: orc.formaPagamento,
        condicoes: orc.condicoes,
        desconto: orc.desconto,
        descontoTipo: orc.descontoTipo,
        salas: (orc.salas || []).map(
          (s: { nome: string; itens: { itemId: string; quantidade: number; valorUnitario: number }[] }) => ({
            nome: s.nome,
            itens: (s.itens || []).map((i) => ({
              itemId: i.itemId,
              quantidade: i.quantidade,
              valorUnitario: i.valorUnitario,
            })),
          })
        ),
      };
      const createRes = await fetch("/api/orcamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copia),
      });
      if (!createRes.ok) throw new Error();
      toast("Orçamento duplicado com sucesso!", "success");
      fetchOrcamentos();
    } catch {
      toast("Erro ao duplicar orçamento.", "error");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/orcamentos/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Orçamento excluído com sucesso.", "success");
      setDeleteId(null);
      fetchOrcamentos();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por evento ou cliente..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Buscar
          </Button>
        </form>

        <div className="flex items-center gap-2">
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

          <Link href="/orcamentos/rapido">
            <Button variant="outline">
              <Zap className="h-4 w-4" />
              Rápido
            </Button>
          </Link>
          <Link href="/orcamentos/funil">
            <Button variant="outline">
              <Kanban className="h-4 w-4" />
              Funil
            </Button>
          </Link>
          <Link href="/orcamentos/novo-projeto">
            <Button variant="outline">
              <Plus className="h-4 w-4" />
              Novo Projeto
            </Button>
          </Link>
          <Link href="/orcamentos/novo">
            <Button>
              <Plus className="h-4 w-4" />
              Novo Orçamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : orcamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
            <FileText className="h-8 w-8" />
            <p className="text-sm">
              {search || statusFilter
                ? "Nenhum orçamento encontrado"
                : "Nenhum orçamento criado ainda"}
            </p>
            {!search && !statusFilter && (
              <Link href="/orcamentos/novo">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Criar Orçamento
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Nº
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Cliente / Evento
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orcamentos.map((orc) => {
                const cfg = statusConfig[orc.status] || statusConfig.PENDENTE;
                return (
                  <tr key={orc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-medium text-slate-700">
                        #{orc.numero}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">
                        {orc.cliente?.nomeFantasia}
                        {orc.projetoEspecial && (
                          <span className="ml-2 rounded-full bg-purple-100 text-purple-700 text-[10px] font-semibold px-2 py-0.5 align-middle">
                            PROJETO
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {orc.eventoNome || "—"}
                        {orc.local ? ` · ${orc.local.nome}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {orc.dataInicio
                        ? new Date(orc.dataInicio).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setStatusAlvo(orc)}
                        title="Clique para mudar o status"
                        className="cursor-pointer hover:opacity-75 transition-opacity"
                      >
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                      {formatCurrency(orc.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(
                                `/api/orcamentos/${orc.id}/link-aprovacao`,
                                { method: "POST" }
                              );
                              const d = await res.json();
                              if (!res.ok) throw new Error();
                              const url = `${window.location.origin}${d.url}`;
                              await navigator.clipboard.writeText(url);
                              toast(
                                "Link de aprovação copiado! Envie ao cliente para ele aprovar online.",
                                "success"
                              );
                            } catch {
                              toast("Erro ao gerar link.", "error");
                            }
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                          title="Copiar link de aprovação online"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                        <Link
                          href={
                            orc.projetoEspecial
                              ? `/orcamentos/${orc.id}/imprimir-projeto`
                              : `/orcamentos/${orc.id}/imprimir`
                          }
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Imprimir / PDF"
                        >
                          <Printer className="h-4 w-4" />
                        </Link>
                        <Link
                          href={
                            orc.projetoEspecial
                              ? `/orcamentos/projeto/${orc.id}`
                              : `/orcamentos/${orc.id}`
                          }
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDuplicate(orc.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Duplicar"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(orc.id)}
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
          <p className="text-sm text-slate-500">{total} orçamentos no total</p>
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

      <Modal
        open={Boolean(statusAlvo)}
        onClose={() => setStatusAlvo(null)}
        title={statusAlvo ? `Mudar status — Orçamento #${statusAlvo.numero}` : ""}
      >
        <ModalBody>
          <p className="text-sm text-slate-500 mb-3">
            {statusAlvo?.cliente?.nomeFantasia}
            {statusAlvo?.eventoNome ? ` · ${statusAlvo.eventoNome}` : ""}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(statusConfig).map(([value, cfg2]) => {
              const atual = statusAlvo?.status === value;
              return (
                <button
                  key={value}
                  disabled={atual || mudandoStatus}
                  onClick={() => mudarStatus(value)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    atual
                      ? "border-slate-200 bg-slate-50 text-slate-400 cursor-default"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Badge variant={cfg2.variant}>{cfg2.label}</Badge>
                    {value === "APROVADO" && !atual && (
                      <span className="text-xs text-emerald-600">gera OS + receita</span>
                    )}
                  </span>
                  {atual && <span className="text-xs">status atual</span>}
                </button>
              );
            })}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setStatusAlvo(null)} disabled={mudandoStatus}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        message="Deseja realmente excluir este orçamento? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
