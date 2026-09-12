"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, Sparkles, Trash2, Plus, PackagePlus } from "lucide-react";

// Importação em massa de itens: cole a lista (do Bubble, planilha ou digitada),
// a IA organiza em linhas, você revisa/corrige e cria tudo de uma vez.
// Os itens entram marcados como "a revisar" para refino posterior.

interface Linha {
  nome: string;
  marca: string;
  modelo: string;
  quantidade: number;
  valorAluguel: number;
  categoria: string;
}

export default function ImportarItensPage() {
  const { toast } = useToast();
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [criando, setCriando] = useState(false);

  async function analisar() {
    if (texto.trim().length < 3) {
      toast("Cole a lista de itens primeiro.", "error");
      return;
    }
    setAnalisando(true);
    try {
      const res = await fetch("/api/itens/importar/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setLinhas(d.itens);
      toast(`${d.itens.length} itens identificados — revise e crie.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao analisar.", "error");
    } finally {
      setAnalisando(false);
    }
  }

  function setCampo(i: number, campo: keyof Linha, valor: string | number) {
    setLinhas((p) => (p ? p.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)) : p));
  }

  function addLinha() {
    setLinhas((p) => [
      ...(p || []),
      { nome: "", marca: "", modelo: "", quantidade: 1, valorAluguel: 0, categoria: "" },
    ]);
  }

  async function criar() {
    const validas = (linhas || []).filter((l) => l.nome.trim());
    if (validas.length === 0) {
      toast("Nenhum item com nome para criar.", "error");
      return;
    }
    setCriando(true);
    try {
      const res = await fetch("/api/itens/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens: validas }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(`${d.criados} itens criados! Revise-os quando puder.`, "success");
      setLinhas(null);
      setTexto("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao criar.", "error");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/ativos" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
          <PackagePlus className="h-5 w-5 text-violet-700" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Importar itens em massa</h1>
          <p className="text-xs text-slate-500">
            Cole sua lista (do Bubble, de uma planilha ou digitada) — a IA organiza e você cria
            tudo de uma vez. Dá para ajustar os detalhes depois.
          </p>
        </div>
      </div>

      {!linhas && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={12}
            placeholder={`Cole aqui. Ex.:\n2 Projetor Epson 5000 lumens 250\n10 Microfone Shure SM58 - 40 a diária\nTV 55 Samsung x4\nNotebook Dell i7, 8 unidades, 120`}
            className="font-mono text-xs"
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-slate-400">
              Pode ser bagunçado — uma linha por item ajuda. A IA separa nome, marca, modelo,
              quantidade e valor.
            </p>
            <Button onClick={analisar} loading={analisando}>
              <Sparkles className="h-4 w-4" />
              Analisar com IA
            </Button>
          </div>
        </div>
      )}

      {linhas && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Marca</th>
                  <th className="px-3 py-2 text-left">Modelo</th>
                  <th className="px-3 py-2 text-left">Categoria</th>
                  <th className="px-3 py-2 text-right w-20">Qtd</th>
                  <th className="px-3 py-2 text-right w-28">Diária (R$)</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-2 py-1">
                      <Input value={l.nome} onChange={(e) => setCampo(i, "nome", e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <Input value={l.marca} onChange={(e) => setCampo(i, "marca", e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <Input value={l.modelo} onChange={(e) => setCampo(i, "modelo", e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <Input value={l.categoria} onChange={(e) => setCampo(i, "categoria", e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        value={l.quantidade}
                        onChange={(e) => setCampo(i, "quantidade", Number(e.target.value))}
                        className="text-right"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        value={l.valorAluguel}
                        onChange={(e) => setCampo(i, "valorAluguel", Number(e.target.value))}
                        className="text-right"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button
                        onClick={() => setLinhas((p) => p!.filter((_, j) => j !== i))}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addLinha}>
                <Plus className="h-4 w-4" />
                Linha
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLinhas(null)}>
                Voltar e colar de novo
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {linhas.filter((l) => l.nome.trim()).length} itens
              </span>
              <Button onClick={criar} loading={criando}>
                <PackagePlus className="h-4 w-4" />
                Criar todos
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Os códigos são gerados em sequência automaticamente. Marcas e categorias novas são
            criadas pelo nome. Tudo entra marcado como <strong>&quot;a revisar&quot;</strong> para
            você completar fotos, descrições e acessórios depois.
          </p>
        </div>
      )}
    </div>
  );
}
