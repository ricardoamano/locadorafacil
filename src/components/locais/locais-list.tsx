"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LocalFormModal } from "./local-form-modal";
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ExternalLink,
} from "lucide-react";

interface Local {
  id: string;
  nome: string;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  cidade: string | null;
  estado: string | null;
  lat: number | null;
  lng: number | null;
}

function formatEndereco(l: Local): string {
  const parts = [
    l.rua && `${l.rua}${l.numero ? `, ${l.numero}` : ""}`,
    l.bairro,
    l.cidade && l.estado ? `${l.cidade} - ${l.estado}` : l.cidade || l.estado,
  ].filter(Boolean);
  return parts.join(" · ") || "—";
}

function mapsUrl(l: Local): string {
  if (l.lat != null && l.lng != null) {
    return `https://www.google.com/maps?q=${l.lat},${l.lng}`;
  }
  const q = encodeURIComponent(
    [l.rua, l.numero, l.bairro, l.cidade, l.estado].filter(Boolean).join(", ")
  );
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function LocaisList() {
  const { toast } = useToast();
  const [locais, setLocais] = useState<Local[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editLocal, setEditLocal] = useState<Local | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchLocais = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
      });
      const res = await fetch(`/api/locais?${params}`);
      const data = await res.json();
      setLocais(data.locais || []);
      setTotal(data.total || 0);
    } catch {
      toast("Erro ao carregar locais.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => {
    fetchLocais();
  }, [fetchLocais]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/locais/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Local excluído com sucesso.", "success");
      setDeleteId(null);
      fetchLocais();
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
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar locais..."
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

        <Button
          onClick={() => {
            setEditLocal(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Novo Local
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : locais.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
            <MapPin className="h-8 w-8" />
            <p className="text-sm">
              {search
                ? `Nenhum local encontrado para "${search}"`
                : "Nenhum local cadastrado ainda"}
            </p>
            {!search && (
              <Button
                size="sm"
                onClick={() => {
                  setEditLocal(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Adicionar Local
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Local
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Endereço
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Mapa
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {locais.map((local) => (
                <tr key={local.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        {local.nome}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {formatEndereco(local)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <a
                      href={mapsUrl(local)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir no Maps
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditLocal(local);
                          setModalOpen(true);
                        }}
                        className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(local.id)}
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
          <p className="text-sm text-slate-500">{total} locais no total</p>
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

      <LocalFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchLocais}
        initial={editLocal || undefined}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        message="Deseja realmente excluir este local? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
