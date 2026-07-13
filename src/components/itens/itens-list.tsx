"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ExportarCsv } from "@/components/ui/exportar-csv";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ItemFormModal } from "./item-form-modal";
import { EtiquetaQrModal } from "./etiqueta-qr-modal";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
  Globe,
  QrCode,
} from "lucide-react";

const tipoLabels: Record<string, string> = {
  PROPRIO: "Próprio",
  ALUGADO: "Alugado",
  TERCEIRO: "Terceiro",
};

interface Item {
  id: string;
  codigo: string;
  nome: string;
  apelidos?: string | null;
  natureza?: string;
  valorAluguel: number;
  tipo: string;
  quantidade: number;
  unidades?: { status: string }[];
  emCatalogo: boolean;
  publicado?: boolean;
  slug?: string | null;
  categoria: { id: string; nome: string } | null;
}

export function ItensList() {
  const [empresaSlug, setEmpresaSlug] = React.useState<string>("");
  const { toast } = useToast();
  const [itens, setItens] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // Se veio de um QR code escaneado (?search=CODIGO), já abre filtrado no item
  const buscaInicial =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("search") || ""
      : "";
  const [search, setSearch] = useState(buscaInicial);
  const [searchInput, setSearchInput] = useState(buscaInicial);
  const [etiquetaItem, setEtiquetaItem] = useState<Item | null>(null);
  const [view, setView] = useState<"todos" | "catalogo">("todos");
  const [naturezaFilter, setNaturezaFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchItens = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        natureza: naturezaFilter,
      });
      const res = await fetch(`/api/itens?${params}`);
      const data = await res.json();
      setItens(data.itens || []);
      setTotal(data.total || 0);
    } catch {
      toast("Erro ao carregar itens.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, naturezaFilter, toast]);

  useEffect(() => {
    fetchItens();
    fetch("/api/empresa")
      .then((r) => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((d: any) => setEmpresaSlug(d.slug || ""))
      .catch(() => {});
  }, [fetchItens]);


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
      const res = await fetch(`/api/itens/${deleteId}`, { method: "DELETE" });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      toast("Item excluído com sucesso.", "success");
      setDeleteId(null);
      fetchItens();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  function openEdit(item: Item) {
    setEditItem(item);
    setModalOpen(true);
  }

  function openCreate() {
    setEditItem(null);
    setModalOpen(true);
  }

  const visibleItens =
    view === "catalogo" ? itens.filter((i) => i.emCatalogo) : itens;

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-slate-100 mb-4">
        {(["todos", "catalogo"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              view === v
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {v === "todos" ? "Itens em Estoque" : "Itens no Catálogo"}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar itens..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Buscar
          </Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setPage(1);
              }}
            >
              Limpar
            </Button>
          )}
        </form>

        <div className="flex items-center gap-2">
          <select
            value={naturezaFilter}
            onChange={(e) => {
              setNaturezaFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Equipamentos e Serviços</option>
            <option value="EQUIPAMENTO">Só Equipamentos</option>
            <option value="SERVICO">Só Serviços</option>
          </select>
          <ExportarCsv tipo="itens" />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Novo Item
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : visibleItens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
            <Package className="h-8 w-8" />
            <p className="text-sm">
              {search
                ? `Nenhum item encontrado para "${search}"`
                : "Nenhum item cadastrado ainda"}
            </p>
            {!search && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Adicionar Item
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Estoque
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Disponível agora
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Valor Aluguel
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleItens.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-slate-500">
                      {item.codigo || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {item.nome}
                          {item.natureza === "SERVICO" && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full align-middle">
                              serviço
                            </span>
                          )}
                        </p>
                        {item.apelidos && (
                          <p className="text-xs text-slate-400 italic">
                            {item.apelidos}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {item.categoria?.nome || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="neutral">
                      {tipoLabels[item.tipo] || item.tipo}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-bold px-2">
                      {item.quantidade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(() => {
                      const us = item.unidades || [];
                      const total = us.filter((u) => u.status !== "BAIXADA").length;
                      const disp = us.filter((u) => u.status === "EM_ESTOQUE").length;
                      const evento = us.filter((u) => u.status === "NO_EVENTO").length;
                      const manut = us.filter((u) => u.status === "MANUTENCAO").length;
                      if (total === 0)
                        return <span className="text-xs text-slate-300">—</span>;
                      const cor =
                        disp === 0
                          ? "bg-red-50 text-red-600"
                          : disp < total
                          ? "bg-amber-50 text-amber-700"
                          : "bg-green-50 text-green-700";
                      const detalhe = [
                        evento > 0 ? `${evento} em evento` : null,
                        manut > 0 ? `${manut} em manutenção` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <span
                          className={`inline-flex h-6 items-center justify-center rounded-full text-xs font-bold px-2 ${cor}`}
                          title={detalhe || "Todas as unidades em estoque"}
                        >
                          {disp}/{total}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                    {formatCurrency(item.valorAluguel)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {item.publicado && item.slug && empresaSlug && (
                        <button
                          onClick={async () => {
                            const url = `${window.location.origin}/catalogo/${empresaSlug}/${item.slug}`;
                            try {
                              await navigator.clipboard.writeText(url);
                              toast("Link da página comercial copiado!", "success");
                            } catch {
                              window.open(url, "_blank");
                            }
                          }}
                          onDoubleClick={() =>
                            window.open(
                              `${window.location.origin}/catalogo/${empresaSlug}/${item.slug}`,
                              "_blank"
                            )
                          }
                          className="p-1.5 rounded-md text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                          title="Página comercial — clique: copiar link · duplo clique: abrir"
                        >
                          <Globe className="h-4 w-4" />
                        </button>
                      )}
                      {item.natureza !== "SERVICO" && (
                        <button
                          onClick={() => setEtiquetaItem(item)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Etiqueta QR code"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Excluir"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">{total} itens no total</p>
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

      <ItemFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchItens}
        initial={editItem || undefined}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        message="Deseja realmente excluir este item? Esta ação não pode ser desfeita."
      />

      <EtiquetaQrModal
        open={!!etiquetaItem}
        onClose={() => setEtiquetaItem(null)}
        item={etiquetaItem}
      />
    </div>
  );
}
