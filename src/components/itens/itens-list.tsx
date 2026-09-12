"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ExportarCsv } from "@/components/ui/exportar-csv";
import { useFerramentasMigracao } from "@/lib/use-migracao";
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
  Link2,
  PackagePlus,
  AlertCircle,
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
  unidades?: { id: string; codigo: string; numero: number; status: string }[];
  emCatalogo: boolean;
  revisarCadastro?: boolean;
  publicado?: boolean;
  slug?: string | null;
  categoria: { id: string; nome: string } | null;
  subCategoria?: { id: string; nome: string } | null;
  acessoriosVinc?: { itemBase: { id: string; nome: string; codigo: string } }[];
  acessoriosBase?: { acessorioId: string }[];
}

export function ItensList() {
  const [empresaSlug, setEmpresaSlug] = React.useState<string>("");
  const { toast } = useToast();
  const migracao = useFerramentasMigracao();
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
  const [soCatalogo, setSoCatalogo] = useState(true);
  const [soRevisar, setSoRevisar] = useState(false);
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
        ...(soRevisar ? { revisar: "1" } : {}),
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
  }, [page, search, naturezaFilter, soRevisar, toast]);

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

  const filtrados = soCatalogo ? itens.filter((i) => i.emCatalogo) : itens;

  // Coloca cada acessório (item que é acessório de outro) logo abaixo do seu
  // item-base, recuado. Acessórios cujo base não está nesta página aparecem na
  // posição normal, mas ainda marcados como acessório de X.
  const visibleItens = React.useMemo(() => {
    const porId = new Map(filtrados.map((i) => [i.id, i]));
    const baseDe = (i: Item) =>
      i.acessoriosVinc && i.acessoriosVinc.length > 0 ? i.acessoriosVinc[0].itemBase : null;

    const filhosPorBase = new Map<string, Item[]>();
    for (const i of filtrados) {
      const b = baseDe(i);
      if (b && porId.has(b.id) && b.id !== i.id) {
        const arr = filhosPorBase.get(b.id) || [];
        arr.push(i);
        filhosPorBase.set(b.id, arr);
      }
    }

    const colocados = new Set<string>();
    const resultado: Item[] = [];
    for (const i of filtrados) {
      if (colocados.has(i.id)) continue;
      const b = baseDe(i);
      // Acessório cujo base está nesta página: entra sob o base, não aqui.
      if (b && porId.has(b.id) && b.id !== i.id) continue;
      resultado.push(i);
      colocados.add(i.id);
      for (const f of filhosPorBase.get(i.id) || []) {
        if (!colocados.has(f.id)) {
          resultado.push(f);
          colocados.add(f.id);
        }
      }
    }
    return resultado;
  }, [filtrados]);

  return (
    <div>
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
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden h-9">
            <button
              type="button"
              onClick={() => setSoCatalogo(true)}
              title="Itens que aparecem na vitrine pública"
              className={`inline-flex items-center gap-1.5 px-3 text-sm font-medium transition-colors ${
                soCatalogo ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:text-slate-700"
              }`}
            >
              <Globe className="h-4 w-4" />
              Catálogo
            </button>
            <button
              type="button"
              onClick={() => setSoCatalogo(false)}
              title="Todos os itens em estoque (inclusive fora do catálogo)"
              className={`inline-flex items-center gap-1.5 px-3 text-sm font-medium border-l border-slate-200 transition-colors ${
                !soCatalogo ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:text-slate-700"
              }`}
            >
              <Package className="h-4 w-4" />
              Estoque
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSoRevisar((v) => !v);
            }}
            title="Itens importados/criados rápido que ainda faltam completar"
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
              soRevisar
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            A revisar
          </button>
          <ExportarCsv tipo="itens" />
          {migracao && (
            <Link href="/ativos/importar">
              <Button variant="outline">
                <PackagePlus className="h-4 w-4" />
                Importar
              </Button>
            </Link>
          )}
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
              {visibleItens.map((item) => {
                const base =
                  item.acessoriosVinc && item.acessoriosVinc.length > 0
                    ? item.acessoriosVinc[0].itemBase
                    : null;
                const qtdAcessorios = item.acessoriosBase?.length || 0;
                return (
                <React.Fragment key={item.id}>
                <tr
                  className={`transition-colors ${
                    base
                      ? "bg-amber-50/50 hover:bg-amber-50 border-l-2 border-amber-300"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-4 py-3">
                    {base ? (
                      <span className="text-sm font-mono text-amber-700">
                        <span className="text-amber-400">{base.codigo} ›</span> {item.codigo || "—"}
                      </span>
                    ) : (
                      <span className="text-sm font-mono text-slate-500">
                        {item.codigo || "—"}
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-3 ${base ? "pl-8" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          base ? "bg-amber-100" : "bg-blue-50"
                        }`}
                      >
                        {base ? (
                          <Link2 className="h-4 w-4 text-amber-600" />
                        ) : (
                          <Package className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {base && <span className="text-amber-500 mr-1">↳</span>}
                          {item.nome}
                          {item.natureza === "SERVICO" && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full align-middle">
                              serviço
                            </span>
                          )}
                          {qtdAcessorios > 0 && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full align-middle">
                              {qtdAcessorios} acessório{qtdAcessorios > 1 ? "s" : ""}
                            </span>
                          )}
                          {item.revisarCadastro && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full align-middle">
                              a revisar
                            </span>
                          )}
                        </p>
                        {base && (
                          <p className="text-xs text-amber-700">
                            Acessório de {base.nome} ({base.codigo})
                          </p>
                        )}
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
                    {item.subCategoria?.nome ? (
                      <span className="text-slate-400"> › {item.subCategoria.nome}</span>
                    ) : null}
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
                          title="Unidades: etiquetas QR, histórico, manutenção e baixa"
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

                {/* Visão Estoque: uma linha clicável por unidade física */}
                {!soCatalogo &&
                  (item.unidades || []).map((u) => {
                    const stU =
                      u.status === "EM_ESTOQUE"
                        ? { txt: "Em estoque", cls: "bg-emerald-50 text-emerald-700" }
                        : u.status === "NO_EVENTO"
                          ? { txt: "No evento", cls: "bg-blue-50 text-blue-700" }
                          : u.status === "MANUTENCAO"
                            ? { txt: "Manutenção", cls: "bg-amber-50 text-amber-700" }
                            : { txt: "Baixada", cls: "bg-red-50 text-red-600" };
                    return (
                      <tr
                        key={u.id}
                        onClick={() => (window.location.href = `/ativos/unidades/${u.id}`)}
                        className="cursor-pointer bg-slate-50/40 hover:bg-blue-50/60 transition-colors"
                        title="Abrir histórico individual desta unidade"
                      >
                        <td className="px-4 py-1.5 pl-8">
                          <span className="text-xs font-mono font-medium text-blue-600">
                            ↳ {u.codigo}
                          </span>
                        </td>
                        <td className="px-4 py-1.5" colSpan={3}>
                          <span className="text-xs text-slate-500">
                            {item.nome} — unidade {String(u.numero).padStart(2, "0")}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-center" colSpan={2}>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stU.cls}`}
                          >
                            {stU.txt}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-right" colSpan={2}>
                          <span className="text-[11px] text-blue-600 font-medium">
                            histórico →
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
                );
              })}
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
