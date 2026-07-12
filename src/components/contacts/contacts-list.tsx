"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ContactFormModal } from "./contact-form-modal";
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  Building2,
  Phone,
  Mail,
} from "lucide-react";

const perfilLabels: Record<string, string> = {
  AGENCIA: "Agência",
  ESPACO_EVENTO: "Espaço de Evento",
  CLIENTE_FINAL_PJ: "Cliente Final PJ",
  CLIENTE_FINAL_PF: "Cliente Final PF",
};

interface Contact {
  id: string;
  type: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string | null;
  perfil: string | null;
  isPostoServico: boolean;
  cidade: string | null;
  estado: string | null;
  _count: { orcamentos: number };
  subContacts: {
    nome: string;
    telefone: string | null;
    email: string | null;
    cargo: string | null;
  }[];
}

interface ContactsListProps {
  type: "CLIENTE" | "FORNECEDOR";
}

export function ContactsList({ type }: ContactsListProps) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type,
        page: String(page),
        limit: String(limit),
        search,
      });
      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
    } catch {
      toast("Erro ao carregar dados.", "error");
    } finally {
      setLoading(false);
    }
  }, [type, page, search, toast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);


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
      const res = await fetch(`/api/contacts/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast(
        `${type === "CLIENTE" ? "Cliente" : "Fornecedor"} excluído com sucesso.`,
        "success"
      );
      setDeleteId(null);
      fetchContacts();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  function openEdit(contact: Contact) {
    setEditContact(contact);
    setModalOpen(true);
  }

  function openCreate() {
    setEditContact(null);
    setModalOpen(true);
  }

  const label = type === "CLIENTE" ? "Cliente" : "Fornecedor";
  const labelPlural = type === "CLIENTE" ? "Clientes" : "Fornecedores";

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
              placeholder={`Buscar ${labelPlural.toLowerCase()}...`}
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

        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo {label}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
            <Users className="h-8 w-8" />
            <p className="text-sm">
              {search
                ? `Nenhum ${label.toLowerCase()} encontrado para "${search}"`
                : `Nenhum ${label.toLowerCase()} cadastrado ainda`}
            </p>
            {!search && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Adicionar {label}
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Nome / Razão Social
                </th>
                {type === "CLIENTE" && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Perfil
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Localização
                </th>
                {type === "CLIENTE" && (
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Orçamentos
                  </th>
                )}
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {contacts.map((contact) => (
                <React.Fragment key={contact.id}>
                  <tr
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() =>
                      setExpandedId(
                        expandedId === contact.id ? null : contact.id
                      )
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {contact.nomeFantasia}
                          </p>
                          <p className="text-xs text-slate-400">
                            {contact.razaoSocial}
                          </p>
                        </div>
                      </div>
                    </td>
                    {type === "CLIENTE" && (
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {contact.perfil && (
                            <Badge variant="neutral">
                              {perfilLabels[contact.perfil] || contact.perfil}
                            </Badge>
                          )}
                          {contact.isPostoServico && (
                            <Badge variant="info">Posto Oficial</Badge>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {contact.cidade && contact.estado
                        ? `${contact.cidade} - ${contact.estado}`
                        : contact.cidade || contact.estado || "—"}
                    </td>
                    {type === "CLIENTE" && (
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold px-2">
                          {contact._count.orcamentos}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openEdit(contact)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(contact.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded sub-contacts */}
                  {expandedId === contact.id &&
                    contact.subContacts &&
                    contact.subContacts.length > 0 && (
                      <tr className="bg-slate-50">
                        <td
                          colSpan={type === "CLIENTE" ? 5 : 4}
                          className="px-4 py-3"
                        >
                          <div className="pl-12">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                              Contatos
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {contact.subContacts.map((sc, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2 text-sm"
                                >
                                  <div>
                                    <p className="font-medium text-slate-700">
                                      {sc.nome}{" "}
                                      {sc.cargo && (
                                        <span className="text-slate-400 font-normal">
                                          ({sc.cargo})
                                        </span>
                                      )}
                                    </p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                      {sc.telefone && (
                                        <span className="flex items-center gap-1 text-xs text-slate-500">
                                          <Phone className="h-3 w-3" />
                                          {sc.telefone}
                                        </span>
                                      )}
                                      {sc.email && (
                                        <span className="flex items-center gap-1 text-xs text-slate-500">
                                          <Mail className="h-3 w-3" />
                                          {sc.email}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            {total} {total === 1 ? label.toLowerCase() : labelPlural.toLowerCase()} no total
          </p>
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

      {/* Form Modal */}
      <ContactFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchContacts}
        type={type}
        initial={editContact || undefined}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        message={`Deseja realmente excluir este ${label.toLowerCase()}? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
