"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { History, ShieldCheck, LogIn, Eye, Pencil } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TIPO_INFO: Record<string, { label: string; cor: string; Icon: any }> = {
  LOGIN: { label: "Login", cor: "text-emerald-600", Icon: LogIn },
  ACESSO: { label: "Acesso", cor: "text-blue-600", Icon: Eye },
  ALTERACAO: { label: "Alteração", cor: "text-amber-600", Icon: Pencil },
};

export default function LogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);
  const [tipo, setTipo] = useState("");
  const [userId, setUserId] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tipo) params.set("tipo", tipo);
      if (userId) params.set("userId", userId);
      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.status === 403) {
        setSemPermissao(true);
        return;
      }
      const d = await res.json();
      setLogs(d.logs || []);
      setUsuarios(d.usuarios || []);
    } catch {
      toast("Erro ao carregar os logs.", "error");
    } finally {
      setLoading(false);
    }
  }, [tipo, userId, toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (semPermissao) {
    return (
      <>
        <Header breadcrumbs={[{ label: "Configurações" }, { label: "Log de Acessos" }]} />
        <main className="pt-14 p-6">
          <div className="flex flex-col items-center justify-center h-60 gap-2 text-slate-400">
            <ShieldCheck className="h-8 w-8" />
            <p className="text-sm">Apenas o superadmin pode ver o log de acessos.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Configurações" }, { label: "Log de Acessos" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <History className="h-6 w-6 text-blue-600" />
              Log de Acessos
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Logins, módulos acessados e alterações feitas pelos usuários.
            </p>
          </div>
          <div className="flex gap-2">
            <Select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              options={[
                { value: "", label: "Todos os tipos" },
                { value: "LOGIN", label: "Logins" },
                { value: "ACESSO", label: "Acessos a módulos" },
                { value: "ALTERACAO", label: "Alterações" },
              ]}
            />
            <Select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              options={[
                { value: "", label: "Todos os usuários" },
                ...usuarios.map((u) => ({ value: u.id, label: u.name || u.email })),
              ]}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <History className="h-8 w-8" />
              <p className="text-sm">Nenhum registro ainda.</p>
            </div>
          ) : (
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((l) => {
                  const info = TIPO_INFO[l.tipo] || TIPO_INFO.ACESSO;
                  return (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-sm text-slate-800">{l.userNome}</p>
                        {l.userRole && (
                          <Badge variant="neutral">
                            {l.userRole === "SUPERADMIN"
                              ? "Superadmin"
                              : l.userRole === "ADMIN"
                                ? "Admin"
                                : "Usuário"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${info.cor}`}>
                          <info.Icon className="h-3.5 w-3.5" />
                          {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-700">
                        {l.acao}
                        {l.detalhe && <span className="text-slate-400"> — {l.detalhe}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Mostrando os 300 registros mais recentes. Acessos ao mesmo módulo são agrupados por
          janela de 10 minutos.
        </p>
      </main>
    </>
  );
}
