"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, Sparkles, Trash2, Plus, PackagePlus, FileSpreadsheet } from "lucide-react";

// Importação em massa de itens: cole a lista (do Bubble, planilha ou digitada),
// a IA organiza em linhas, você revisa/corrige e cria tudo de uma vez.
// Os itens entram marcados como "a revisar" para refino posterior.

interface Linha {
  codigo?: string;
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
  // Modo planilha/CSV: cabeçalho + linhas + mapa coluna→campo
  const [csv, setCsv] = useState<{ cabecalho: string[]; dados: string[][] } | null>(null);
  const [mapa, setMapa] = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const CAMPOS: { key: string; label: string; dicas: RegExp }[] = [
    { key: "codigo", label: "Código / SKU", dicas: /c[oó]digo|sku|cod\b/i },
    { key: "nome", label: "Nome *", dicas: /nome|item|descri|produto|equipamento/i },
    { key: "marca", label: "Marca", dicas: /marca|fabricante|brand/i },
    { key: "modelo", label: "Modelo", dicas: /modelo|model/i },
    { key: "quantidade", label: "Quantidade", dicas: /quant|qtd|estoque|unidades/i },
    { key: "valorAluguel", label: "Diária (R$)", dicas: /di[aá]ria|valor|pre[cç]o|aluguel/i },
    { key: "categoria", label: "Categoria", dicas: /categ|tipo|grupo/i },
  ];

  function parseCsv(texto: string): { cabecalho: string[]; dados: string[][] } {
    const linhasBrutas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    const primeira = linhasBrutas[0] || "";
    const delim = [";", "\t", ","].sort(
      (a, b) => primeira.split(b).length - primeira.split(a).length
    )[0];
    const split = (l: string) => {
      const out: string[] = [];
      let cur = "";
      let q = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (ch === '"') {
          if (q && l[i + 1] === '"') {
            cur += '"';
            i++;
          } else q = !q;
        } else if (ch === delim && !q) {
          out.push(cur);
          cur = "";
        } else cur += ch;
      }
      out.push(cur);
      return out.map((c) => c.trim());
    };
    const cabecalho = split(primeira);
    const dados = linhasBrutas.slice(1).map(split);
    return { cabecalho, dados };
  }

  async function carregarArquivo(file: File) {
    const buf = await file.arrayBuffer();
    let txt = new TextDecoder("utf-8").decode(buf);
    if (txt.includes("�")) txt = new TextDecoder("windows-1252").decode(buf);
    const parsed = parseCsv(txt);
    if (parsed.cabecalho.length < 2 || parsed.dados.length === 0) {
      toast("Não consegui ler colunas nesse arquivo. Exporte como CSV com cabeçalho.", "error");
      return;
    }
    // Mapeamento automático pelos nomes das colunas
    const auto: Record<string, number> = {};
    for (const c of CAMPOS) {
      const idx = parsed.cabecalho.findIndex((h) => c.dicas.test(h));
      if (idx >= 0 && !Object.values(auto).includes(idx)) auto[c.key] = idx;
    }
    setCsv(parsed);
    setMapa(auto);
    if (fileRef.current) fileRef.current.value = "";
  }

  function aplicarMapa() {
    if (!csv || mapa.nome === undefined) {
      toast("Indique qual coluna é o Nome.", "error");
      return;
    }
    const numero = (s: string | undefined) =>
      Number(String(s || "").replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
    const pega = (row: string[], k: string) => (mapa[k] !== undefined ? row[mapa[k]] || "" : "");
    const novas: Linha[] = csv.dados
      .map((row) => ({
        codigo: pega(row, "codigo"),
        nome: pega(row, "nome"),
        marca: pega(row, "marca"),
        modelo: pega(row, "modelo"),
        quantidade: Math.round(numero(pega(row, "quantidade"))) || 1,
        valorAluguel: numero(pega(row, "valorAluguel")),
        categoria: pega(row, "categoria"),
      }))
      .filter((l) => l.nome);
    setLinhas(novas);
    setCsv(null);
    toast(`${novas.length} linhas carregadas da planilha — revise e crie.`, "success");
  }

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
      toast(
        `${d.criados} itens criados${d.atualizados ? ` e ${d.atualizados} já existentes atualizados (quantidade/diária)` : ""}. Revise-os quando puder.`,
        "success"
      );
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

      {!linhas && !csv && (
        <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <span className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
          </span>
          <div className="flex-1 min-w-56">
            <p className="text-sm font-medium text-slate-900">Tem uma planilha ou o export do Bubble?</p>
            <p className="text-xs text-slate-500">
              Suba o CSV (Bubble: Data → App data → Export). Você escolhe qual coluna é o quê — sem
              passar pela IA, ideal para listas grandes.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && carregarArquivo(e.target.files[0])}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4" />
            Subir CSV
          </Button>
        </div>
      )}

      {csv && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Diga qual coluna é o quê ({csv.dados.length} linhas encontradas)
            </h2>
            <p className="text-xs text-slate-400">
              Já tentei adivinhar pelos títulos das colunas — confira. Só o Nome é obrigatório.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CAMPOS.map((c) => (
              <label key={c.key} className="text-xs text-slate-600">
                <span className="block font-medium mb-1">{c.label}</span>
                <select
                  value={mapa[c.key] ?? ""}
                  onChange={(e) =>
                    setMapa((p) => {
                      const n = { ...p };
                      if (e.target.value === "") delete n[c.key];
                      else n[c.key] = Number(e.target.value);
                      return n;
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                >
                  <option value="">— não importar —</option>
                  {csv.cabecalho.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Coluna ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 overflow-x-auto">
            <p className="text-[11px] text-slate-400 mb-1">Prévia das 3 primeiras linhas:</p>
            <table className="text-[11px] text-slate-600">
              <tbody>
                {csv.dados.slice(0, 3).map((row, i) => (
                  <tr key={i}>
                    {row.map((cel, j) => (
                      <td key={j} className="px-2 py-0.5 whitespace-nowrap border-r border-slate-100 last:border-0">
                        {cel || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCsv(null)}>
              Cancelar
            </Button>
            <Button onClick={aplicarMapa}>Carregar linhas para revisão</Button>
          </div>
        </div>
      )}

      {!linhas && !csv && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
          <p className="text-sm font-medium text-slate-900">Ou cole uma lista solta</p>
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
                  <th className="px-3 py-2 text-left w-24">Código</th>
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
                      <Input
                        value={l.codigo || ""}
                        onChange={(e) => setCampo(i, "codigo", e.target.value)}
                        placeholder="auto"
                      />
                    </td>
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
