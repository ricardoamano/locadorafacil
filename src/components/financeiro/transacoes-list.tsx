"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TransacaoFormModal } from "./transacao-form-modal";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Landmark,
  Clock,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  PAGO: { label: "Pago", variant: "success" },
  PENDENTE: { label: "Pendente", variant: "warning" },
  ATRASADO: { label: "Atrasado", variant: "danger" },
};

interface Transacao {
  id: string;
  nome: string;
  dataRecebimento: string;
  tipo: string;
  valor: number;
  status: string;
  notaFiscal: boolean;
  categoria: { id: string; nome: string } | null;
  orcamento: { id: string; numero: number } | null;
  banco?: { id: string; nome: string } | null;
}

interface Saldo {
  entradas: number;
  saidas: number;
  total: number;
}

interface Resumo {
  saldoCaixa: number;
  aReceber: { valor: number; qtd: number };
  aPagar: { valor: number; qtd: number };
  atrasadas: { valor: number; qtd: number };
  porBanco: { id: string; nome: string; saldo: number }[];
  fluxoMensal: { mes: string; entradas: number; saidas: number }[];
  porCategoria: { categoria: string; tipo: string; valor: number }[];
}

function atrasada(t: Transacao) {
  if (t.status === "PAGO") return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return t.status === "ATRASADO" || new Date(t.dataRecebimento) < hoje;
}

export function TransacoesList() {
  const { toast } = useToast();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [saldo, setSaldo] = useState<Saldo>({ entradas: 0, saidas: 0, total: 0 });
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [showSaldo, setShowSaldo] = useState(true);
  const [bancoFilter, setBancoFilter] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [sortField, setSortField] = useState("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [bancosOpts, setBancosOpts] = useState<{ id: string; nome: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Transacao | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchTransacoes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        tipo: tipoFilter,
        status: statusFilter,
        bancoId: bancoFilter,
        mes: mesFilter,
        sort: sortField,
        dir: sortDir,
      });
      const res = await fetch(`/api/transacoes?${params}`);
      const data = await res.json();
      setTransacoes(data.transacoes || []);
      setTotal(data.total || 0);
      if (data.saldo) setSaldo(data.saldo);
      if (data.resumo) setResumo(data.resumo);
    } catch {
      toast("Erro ao carregar transações.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, tipoFilter, statusFilter, bancoFilter, mesFilter, sortField, sortDir, toast]);

  useEffect(() => {
    fetchTransacoes();
  }, [fetchTransacoes]);

  useEffect(() => {
    fetch("/api/bancos")
      .then((r) => r.json())
      .then((d) => setBancosOpts(d.bancos || []))
      .catch(() => {});
  }, []);

  async function marcarPago(t: Transacao) {
    try {
      const res = await fetch(`/api/transacoes/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAGO" }),
      });
      if (!res.ok) throw new Error();
      toast(`"${t.nome}" marcada como paga!`, "success");
      fetchTransacoes();
    } catch {
      toast("Erro ao atualizar.", "error");
    }
  }

  async function exportarCsv() {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "1000",
        search,
        tipo: tipoFilter,
        status: statusFilter,
        bancoId: bancoFilter,
        mes: mesFilter,
      });
      const res = await fetch(`/api/transacoes?${params}`);
      const data = await res.json();
      const linhas = (data.transacoes || []) as Transacao[];
      const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [
        ["Data", "Nome", "Tipo", "Categoria", "Banco", "Orcamento", "Status", "Valor"].join(";"),
        ...linhas.map((t) =>
          [
            new Date(t.dataRecebimento).toLocaleDateString("pt-BR"),
            esc(t.nome),
            t.tipo,
            esc(t.categoria?.nome || ""),
            esc(t.banco?.nome || ""),
            t.orcamento ? `#${t.orcamento.numero}` : "",
            atrasada(t) ? "ATRASADO" : t.status,
            String(t.valor).replace(".", ","),
          ].join(";")
        ),
      ].join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast(`${linhas.length} transações exportadas.`, "success");
    } catch {
      toast("Erro ao exportar.", "error");
    }
  }


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

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/transacoes/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Transação excluída com sucesso.", "success");
      setDeleteId(null);
      fetchTransacoes();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  function ordenar(campo: string) {
    if (sortField === campo) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(campo);
      // Data e valor começam do maior/mais recente; textos começam A-Z
      setSortDir(campo === "data" || campo === "valor" ? "desc" : "asc");
    }
    setPage(1);
  }

  function Th({
    campo,
    align = "left",
    children,
  }: {
    campo?: string;
    align?: "left" | "right";
    children: React.ReactNode;
  }) {
    const ativo = campo && sortField === campo;
    return (
      <th
        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider select-none ${
          align === "right" ? "text-right" : "text-left"
        } ${campo ? "cursor-pointer hover:text-slate-800" : ""} ${
          ativo ? "text-blue-700" : "text-slate-500"
        }`}
        onClick={campo ? () => ordenar(campo) : undefined}
        title={campo ? "Clique para ordenar" : undefined}
      >
        <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
          {children}
          {ativo &&
            (sortDir === "desc" ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUp className="h-3 w-3" />
            ))}
        </span>
      </th>
    );
  }

  return (
    <div>
      {/* Painel financeiro */}
      {showSaldo && resumo && (
        <div className="space-y-4 mb-6">
          {/* Cards principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Saldo em caixa (pago)</p>
                <p className={`text-lg font-bold ${resumo.saldoCaixa >= 0 ? "text-slate-900" : "text-red-600"}`}>
                  {formatCurrency(resumo.saldoCaixa)}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">A receber ({resumo.aReceber.qtd})</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(resumo.aReceber.valor)}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">A pagar ({resumo.aPagar.qtd})</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(resumo.aPagar.valor)}</p>
              </div>
            </div>
            <div className={`rounded-xl border shadow-sm p-4 flex items-center gap-3 ${
              resumo.atrasadas.qtd > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-100"
            }`}>
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Atrasadas ({resumo.atrasadas.qtd})</p>
                <p className="text-lg font-bold text-amber-700">{formatCurrency(resumo.atrasadas.valor)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Fluxo mensal */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Fluxo de caixa — últimos 6 meses (pagas + previstas)
              </p>
              {(() => {
                const max = Math.max(1, ...resumo.fluxoMensal.flatMap((m) => [m.entradas, m.saidas]));
                return (
                  <div className="flex items-end justify-between gap-2 h-36">
                    {resumo.fluxoMensal.map((m) => (
                      <div key={m.mes} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div className="flex items-end gap-1 h-28 w-full justify-center">
                          <div
                            className="w-3 sm:w-5 rounded-t bg-green-500/80"
                            style={{ height: `${Math.round((m.entradas / max) * 100)}%` }}
                            title={`Entradas: ${formatCurrency(m.entradas)}`}
                          />
                          <div
                            className="w-3 sm:w-5 rounded-t bg-red-400/80"
                            style={{ height: `${Math.round((m.saidas / max) * 100)}%` }}
                            title={`Saídas: ${formatCurrency(m.saidas)}`}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 truncate">{m.mes}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Saldo por banco */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5" /> Saldo por banco (pagas)
              </p>
              {resumo.porBanco.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Nenhuma transação paga com banco informado — cadastre bancos em
                  Configurações e informe nas transações.
                </p>
              ) : (
                <ul className="space-y-2">
                  {resumo.porBanco.map((b) => (
                    <li key={b.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{b.nome}</span>
                      <span className={`font-semibold ${b.saldo >= 0 ? "text-slate-900" : "text-red-600"}`}>
                        {formatCurrency(b.saldo)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Por categoria (período) */}
          {resumo.porCategoria.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Por categoria {mesFilter ? `— ${mesFilter.split("-").reverse().join("/")}` : "— geral"}
              </p>
              {(() => {
                const max = Math.max(1, ...resumo.porCategoria.map((c) => c.valor));
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
                    {resumo.porCategoria.slice(0, 10).map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-36 truncate text-slate-600">{c.categoria}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${c.tipo === "RECEITA" ? "bg-green-500/70" : "bg-red-400/70"}`}
                            style={{ width: `${Math.round((c.valor / max) * 100)}%` }}
                          />
                        </div>
                        <span className="w-24 text-right font-medium text-slate-700">
                          {formatCurrency(c.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar transações..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Buscar
          </Button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={tipoFilter}
            onChange={(e) => {
              setTipoFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Receitas e Despesas</option>
            <option value="RECEITA">Receitas</option>
            <option value="DESPESA">Despesas</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os status</option>
            <option value="PAGO">Pago</option>
            <option value="PENDENTE">Pendente</option>
            <option value="ATRASADO">Atrasado</option>
          </select>

          <input
            type="month"
            value={mesFilter}
            onChange={(e) => {
              setMesFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Filtrar por mês"
          />
          <select
            value={bancoFilter}
            onChange={(e) => {
              setBancoFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os bancos</option>
            {bancosOpts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>

          <Button variant="outline" onClick={exportarCsv} title="Exportar CSV com os filtros atuais">
            <Download className="h-4 w-4" />
            CSV
          </Button>

          <Link href="/financeiro/conciliacao">
            <Button variant="outline" title="Importar extrato do banco (OFX) e conciliar">
              <Landmark className="h-4 w-4" />
              Conciliação
            </Button>
          </Link>

          <Button variant="outline" onClick={() => setShowSaldo((s) => !s)}>
            <Wallet className="h-4 w-4" />
            {showSaldo ? "Ocultar painel" : "Ver painel"}
          </Button>

          <Button
            onClick={() => {
              setEditItem(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nova Transação
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : transacoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
            <DollarSign className="h-8 w-8" />
            <p className="text-sm">
              {search || tipoFilter || statusFilter
                ? "Nenhuma transação encontrada"
                : "Nenhuma transação registrada ainda"}
            </p>
            {!search && !tipoFilter && !statusFilter && (
              <Button
                size="sm"
                onClick={() => {
                  setEditItem(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Adicionar Transação
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <Th campo="nome">Transação</Th>
                <Th campo="data">Data</Th>
                <Th campo="orcamento">Orçamento</Th>
                <Th campo="status">Status</Th>
                <Th campo="valor" align="right">Valor</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transacoes.map((t) => {
                const cfg = atrasada(t)
                  ? statusConfig.ATRASADO
                  : statusConfig[t.status] || statusConfig.PENDENTE;
                const isReceita = t.tipo === "RECEITA";
                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isReceita ? "bg-green-50" : "bg-red-50"
                          }`}
                        >
                          {isReceita ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{t.nome}</p>
                          <p className="text-xs text-slate-400">
                            {t.categoria?.nome || (isReceita ? "Receita" : "Despesa")}
                            {t.banco?.nome ? ` · ${t.banco.nome}` : ""}
                            {t.notaFiscal ? " · NF" : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(t.dataRecebimento).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {t.orcamento ? `#${t.orcamento.numero}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-semibold ${
                        isReceita ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isReceita ? "+" : "-"} {formatCurrency(t.valor)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {t.status !== "PAGO" && (
                          <button
                            onClick={() => marcarPago(t)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            title="Marcar como pago"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditItem(t);
                            setModalOpen(true);
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(t.id)}
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
          <p className="text-sm text-slate-500">{total} transações no total</p>
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

      <TransacaoFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchTransacoes}
        initial={editItem || undefined}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        message="Deseja realmente excluir esta transação? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
