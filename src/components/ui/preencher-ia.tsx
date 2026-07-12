"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast";

// Botão "✨ Preencher com IA" — usado nos formulários de item, local e cliente.
// Chama /api/ia/preencher e devolve o JSON para o formulário aplicar.

export function PreencherIa({
  tipo,
  texto,
  onDados,
}: {
  tipo: "item" | "local" | "cliente";
  texto: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDados: (dados: any) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function preencher() {
    if (!texto || texto.trim().length < 3) {
      toast("Digite o nome primeiro, depois clique em Preencher com IA.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ia/preencher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, texto: texto.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onDados(d.dados);
      toast("Preenchido com IA — revise antes de salvar. ✨", "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro na IA.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={preencher}
      disabled={loading}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-violet-200 bg-violet-50 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-60 shrink-0"
      title="Preenche os campos automaticamente com IA a partir do nome"
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {loading ? "Preenchendo..." : "Preencher com IA"}
    </button>
  );
}
