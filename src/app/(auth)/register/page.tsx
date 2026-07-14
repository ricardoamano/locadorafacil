"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Eye, EyeOff, User, Building2, ArrowRight } from "lucide-react";
import { formatDoc, formatPhone } from "@/lib/utils";

// Onboarding público: cria a empresa + o usuário admin e já entra no sistema.

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    empresaNome: "",
    razaoSocial: "",
    cnpj: "",
    telefone: "",
    cidade: "",
    estado: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.nome.trim() || !form.email.trim() || !form.senha || !form.empresaNome.trim()) {
      setError("Preencha seu nome, e-mail, senha e o nome da empresa.");
      return;
    }
    if (form.senha.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro ao criar a conta.");

      // Entra automaticamente
      const result = await signIn("credentials", {
        email: form.email.trim().toLowerCase(),
        password: form.senha,
        redirect: false,
      });
      if (result?.error) {
        // Conta criada, mas falhou o login automático — manda para o login
        router.push("/login");
        return;
      }
      router.push("/configuracoes/empresa");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">LocadoraFácil</h1>
            <p className="text-sm text-slate-500 mt-1">
              Crie sua conta e comece a gerenciar suas locações
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Seus dados */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">Seus dados</h2>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    Seu nome *
                  </label>
                  <input
                    value={form.nome}
                    onChange={(e) => set("nome", e.target.value)}
                    placeholder="Nome completo"
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="voce@email.com"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      Senha *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.senha}
                        onChange={(e) => set("senha", e.target.value)}
                        placeholder="mín. 6 caracteres"
                        className={inputCls + " pr-10"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Dados da empresa */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">Sua empresa</h2>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    Nome da empresa *
                  </label>
                  <input
                    value={form.empresaNome}
                    onChange={(e) => set("empresaNome", e.target.value)}
                    placeholder="Ex.: Neostore Tecnologia para Eventos"
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      Razão social
                    </label>
                    <input
                      value={form.razaoSocial}
                      onChange={(e) => set("razaoSocial", e.target.value)}
                      placeholder="(opcional)"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      CNPJ
                    </label>
                    <input
                      value={form.cnpj}
                      onChange={(e) => set("cnpj", formatDoc(e.target.value))}
                      placeholder="(opcional)"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      Telefone
                    </label>
                    <input
                      value={form.telefone}
                      onChange={(e) => set("telefone", formatPhone(e.target.value))}
                      placeholder="(opcional)"
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      Cidade
                    </label>
                    <input
                      value={form.cidade}
                      onChange={(e) => set("cidade", e.target.value)}
                      placeholder="(opcional)"
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      UF
                    </label>
                    <select
                      value={form.estado}
                      onChange={(e) => set("estado", e.target.value)}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {ESTADOS.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Você poderá completar logo, endereço, dados bancários e demais informações
                depois em Configurações → Empresa.
              </p>
            </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "Criando sua conta..." : "Criar conta e começar"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
