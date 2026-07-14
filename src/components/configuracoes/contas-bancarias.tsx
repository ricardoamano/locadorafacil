"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Plus, Copy, Trash2, Landmark } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Conta {
  id?: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  pix: string;
  pixTipo: string;
}

const vazia = (): Conta => ({
  banco: "",
  agencia: "",
  conta: "",
  tipoConta: "Corrente",
  pix: "",
  pixTipo: "E-mail",
});

// Monta o texto padrão "DADOS PARA PAGAMENTO" para copiar.
function textoPagamento(c: Conta): string {
  const linhas = ["DADOS PARA PAGAMENTO"];
  if (c.banco.trim()) linhas.push(`Banco ${c.banco.trim()}`);
  if (c.agencia.trim()) linhas.push(`Agência ${c.agencia.trim()}`);
  if (c.conta.trim()) linhas.push(`Conta ${c.tipoConta} ${c.conta.trim()}`);
  if (c.pix.trim())
    linhas.push(`PIX${c.pixTipo ? ` (${c.pixTipo})` : ""}: ${c.pix.trim()}`);
  return linhas.join("\n");
}

export function ContasBancarias() {
  const { toast } = useToast();
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvandoIdx, setSalvandoIdx] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/empresa/contas");
      const d = await res.json();
      setContas(
        (d.contas || []).map((c: any) => ({
          id: c.id,
          banco: c.banco || "",
          agencia: c.agencia || "",
          conta: c.conta || "",
          tipoConta: c.tipoConta || "Corrente",
          pix: c.pix || "",
          pixTipo: c.pixTipo || "",
        }))
      );
    } catch {
      toast("Erro ao carregar contas bancárias.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function setCampo(idx: number, campo: keyof Conta, valor: string) {
    setContas((p) => p.map((c, i) => (i === idx ? { ...c, [campo]: valor } : c)));
  }

  async function salvar(idx: number) {
    const c = contas[idx];
    if (!c.banco.trim()) {
      toast("Informe o banco.", "error");
      return;
    }
    setSalvandoIdx(idx);
    try {
      const res = await fetch("/api/empresa/contas", {
        method: c.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setContas((p) => p.map((x, i) => (i === idx ? { ...x, id: d.id } : x)));
      toast("Conta bancária salva!", "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSalvandoIdx(null);
    }
  }

  async function excluir(idx: number) {
    const c = contas[idx];
    if (c.id) {
      try {
        const res = await fetch(`/api/empresa/contas?id=${c.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
      } catch {
        toast("Erro ao excluir.", "error");
        return;
      }
    }
    setContas((p) => p.filter((_, i) => i !== idx));
  }

  function copiar(c: Conta) {
    navigator.clipboard.writeText(textoPagamento(c));
    toast("Dados bancários copiados! 📋", "success");
  }

  return (
    <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <Landmark className="h-4 w-4 text-blue-600" />
          Dados Bancários e PIX
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setContas((p) => [...p, vazia()])}
        >
          <Plus className="h-4 w-4" />
          Adicionar banco
        </Button>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Cadastre uma ou mais contas. Use “Copiar dados” para colar no WhatsApp/e-mail no padrão
        de cobrança. A 1ª conta é a usada na fatura.
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-16">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : contas.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
          Nenhuma conta cadastrada. Clique em “Adicionar banco”.
        </p>
      ) : (
        <div className="space-y-4">
          {contas.map((c, idx) => (
            <div key={c.id || idx} className="rounded-xl border border-slate-100 p-4 bg-slate-50/50">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Banco"
                  value={c.banco}
                  onChange={(e) => setCampo(idx, "banco", e.target.value)}
                  placeholder="Ex: Nubank (260)"
                />
                <Input
                  label="Agência"
                  value={c.agencia}
                  onChange={(e) => setCampo(idx, "agencia", e.target.value)}
                  placeholder="0001"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    label="Tipo"
                    value={c.tipoConta}
                    onChange={(e) => setCampo(idx, "tipoConta", e.target.value)}
                    options={[
                      { value: "Corrente", label: "Corrente" },
                      { value: "Poupança", label: "Poupança" },
                    ]}
                  />
                  <Input
                    label="Conta"
                    value={c.conta}
                    onChange={(e) => setCampo(idx, "conta", e.target.value)}
                    placeholder="00000000-0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <Select
                  label="Tipo de PIX"
                  value={c.pixTipo}
                  onChange={(e) => setCampo(idx, "pixTipo", e.target.value)}
                  options={[
                    { value: "E-mail", label: "E-mail" },
                    { value: "CNPJ", label: "CNPJ" },
                    { value: "CPF", label: "CPF" },
                    { value: "Telefone", label: "Telefone" },
                    { value: "Aleatória", label: "Chave aleatória" },
                  ]}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Chave PIX"
                    value={c.pix}
                    onChange={(e) => setCampo(idx, "pix", e.target.value)}
                    placeholder="chave conforme o tipo acima"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Button type="button" size="sm" onClick={() => salvar(idx)} loading={salvandoIdx === idx}>
                  Salvar
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => copiar(c)}>
                  <Copy className="h-4 w-4" />
                  Copiar dados
                </Button>
                <button
                  type="button"
                  onClick={() => excluir(idx)}
                  className="ml-auto text-slate-300 hover:text-red-500"
                  title="Excluir conta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
