"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, ShieldCheck, UserX, UserCheck2, Users } from "lucide-react";

interface Usuario {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isOwner: boolean;
  ativo: boolean;
  createdAt: string;
}

interface FormData {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: string;
}

const empty = (): FormData => ({ name: "", email: "", password: "", role: "USER" });

export default function UsuariosPage() {
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormData>(empty());
  const [saving, setSaving] = useState(false);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/usuarios");
      if (res.status === 403) {
        setSemPermissao(true);
        return;
      }
      const data = await res.json();
      setUsuarios(data.usuarios || []);
    } catch {
      toast("Erro ao carregar usuários.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  async function handleSave() {
    if (!form.id && (!form.name.trim() || !form.email.trim() || !form.password)) {
      toast("Preencha nome, e-mail e senha.", "error");
      return;
    }
    setSaving(true);
    try {
      const url = form.id ? `/api/usuarios/${form.id}` : "/api/usuarios";
      const payload: Record<string, unknown> = {
        name: form.name,
        role: form.role,
      };
      if (!form.id) payload.email = form.email;
      if (form.password) payload.password = form.password;

      const res = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Erro ao salvar.", "error");
        return;
      }
      toast(form.id ? "Usuário atualizado!" : "Usuário criado!", "success");
      setModalOpen(false);
      fetchUsuarios();
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(u: Usuario) {
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Erro.", "error");
        return;
      }
      toast(u.ativo ? "Usuário desativado." : "Usuário ativado.", "success");
      fetchUsuarios();
    } catch {
      toast("Erro ao alterar status.", "error");
    }
  }

  if (semPermissao) {
    return (
      <>
        <Header breadcrumbs={[{ label: "Configurações" }, { label: "Usuários" }]} />
        <main className="pt-14 p-6">
          <div className="flex flex-col items-center justify-center h-60 gap-2 text-slate-400">
            <ShieldCheck className="h-8 w-8" />
            <p className="text-sm">
              Apenas administradores podem gerenciar usuários.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Configurações" }, { label: "Usuários" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie quem acessa o sistema da sua empresa
            </p>
          </div>
          <Button
            onClick={() => {
              setForm(empty());
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo Usuário
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : usuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <Users className="h-8 w-8" />
              <p className="text-sm">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Usuário", "Perfil", "Status", "Ações"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                        i === 3 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-blue-700 text-sm font-bold">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {u.name || "—"}
                          </p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={u.role === "ADMIN" ? "info" : "neutral"}>
                          {u.role === "ADMIN" ? "Administrador" : "Usuário"}
                        </Badge>
                        {u.isOwner && <Badge variant="success">Proprietário</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.ativo ? "success" : "danger"}>
                        {u.ativo ? "Ativo" : "Desativado"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setForm({
                              id: u.id,
                              name: u.name || "",
                              email: u.email,
                              password: "",
                              role: u.role,
                            });
                            setModalOpen(true);
                          }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!u.isOwner && (
                          <button
                            onClick={() => toggleAtivo(u)}
                            className={`p-1.5 rounded-md transition-colors ${
                              u.ativo
                                ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                                : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                            }`}
                            title={u.ativo ? "Desativar" : "Ativar"}
                          >
                            {u.ativo ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={form.id ? "Editar Usuário" : "Novo Usuário"}
          size="lg"
        >
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Nome *"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
              <Input
                label="E-mail *"
                type="email"
                value={form.email}
                disabled={!!form.id}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={form.id ? "Nova senha (opcional)" : "Senha *"}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                />
                <Select
                  label="Perfil"
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  options={[
                    { value: "USER", label: "Usuário" },
                    { value: "ADMIN", label: "Administrador" },
                  ]}
                />
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
      </main>
    </>
  );
}
