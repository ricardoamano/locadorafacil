"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ShieldCheck, Users } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function PerfisPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [semPermissao, setSemPermissao] = useState(false);
  const [rotulos, setRotulos] = useState({ SUPERADMIN: "", ADMIN: "", USER: "" });
  const [adminTodos, setAdminTodos] = useState(true);
  const [adminModulos, setAdminModulos] = useState<string[]>([]);
  const [modulosAdmin, setModulosAdmin] = useState<{ key: string; label: string }[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/empresa/perfis");
      const d = await res.json();
      setModulosAdmin(d.modulosAdmin || []);
      setRotulos(d.config.rotulos);
      const am: string[] | null = d.config.adminModulos;
      setAdminTodos(!am || am.length === 0);
      setAdminModulos(am || (d.modulosAdmin || []).map((m: any) => m.key));
      if (!d.podeEditar) setSemPermissao(true);
    } catch {
      toast("Erro ao carregar perfis.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    setSaving(true);
    try {
      const res = await fetch("/api/empresa/perfis", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rotulos,
          adminModulos: adminTodos ? null : adminModulos,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast("Perfis e acessos salvos! Vale no próximo login/em ~30s.", "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (semPermissao) {
    return (
      <>
        <Header breadcrumbs={[{ label: "Configurações" }, { label: "Perfis e Acessos" }]} />
        <main className="pt-14 p-6">
          <div className="flex flex-col items-center justify-center h-60 gap-2 text-slate-400">
            <ShieldCheck className="h-8 w-8" />
            <p className="text-sm">Apenas o superadmin pode alterar perfis e acessos.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Configurações" }, { label: "Perfis e Acessos" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Perfis e Acessos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Renomeie os perfis e defina o que o perfil Administrador pode acessar. Só o superadmin
            edita aqui.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="max-w-3xl space-y-4">
            {/* Nomenclaturas */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Nomenclaturas dos perfis</h2>
              <p className="text-xs text-slate-400 mb-4">
                Como cada perfil aparece na tela de usuários e nos logs (ex.: “Gerente”,
                “Operador”).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Superadmin (acesso total)"
                  value={rotulos.SUPERADMIN}
                  onChange={(e) => setRotulos((p) => ({ ...p, SUPERADMIN: e.target.value }))}
                />
                <Input
                  label="Administrador (intermediário)"
                  value={rotulos.ADMIN}
                  onChange={(e) => setRotulos((p) => ({ ...p, ADMIN: e.target.value }))}
                />
                <Input
                  label="Usuário (restrito)"
                  value={rotulos.USER}
                  onChange={(e) => setRotulos((p) => ({ ...p, USER: e.target.value }))}
                />
              </div>
            </section>

            {/* Acessos do perfil Administrador */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">
                Acessos do perfil {rotulos.ADMIN || "Administrador"}
              </h2>
              <p className="text-xs text-slate-400 mb-3">
                O superadmin sempre acessa tudo. O usuário comum é configurado individualmente na
                tela de Usuários. Aqui você define os módulos do perfil intermediário.
                (Configurações nunca fica disponível para esse perfil.)
              </p>
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={adminTodos}
                  onChange={(e) => setAdminTodos(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm text-slate-700">
                  Acessa <strong>todos</strong> os módulos operacionais
                </span>
              </label>
              {!adminTodos && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {modulosAdmin.map((m) => {
                    const marcado = adminModulos.includes(m.key);
                    return (
                      <label
                        key={m.key}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                          marcado ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() =>
                            setAdminModulos((p) =>
                              marcado ? p.filter((k) => k !== m.key) : [...p, m.key]
                            )
                          }
                          className="h-3.5 w-3.5 rounded"
                        />
                        {m.label}
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="flex justify-end">
              <Button onClick={salvar} loading={saving}>
                Salvar perfis e acessos
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
