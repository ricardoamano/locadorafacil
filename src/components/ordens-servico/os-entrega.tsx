"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PackageCheck, Printer, Link2, Copy, ExternalLink } from "lucide-react";

interface Linha {
  itemId: string;
  nome: string;
  codigo: string;
  apelidos: string | null;
  separado: number;
  ficou: number;
}

interface EntregaInfo {
  publicToken: string;
  clienteNome: string | null;
  aceiteEm: string | null;
}

// "O que ficou no evento" — o time marca, na lista do que foi separado, o que
// PERMANECEU com o cliente. Gera o termo de entrega + link público de aceite.
export function OsEntrega({ osId }: { osId: string }) {
  const { toast } = useToast();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [houveConferencia, setHouveConferencia] = useState(false);
  const [entrega, setEntrega] = useState<EntregaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ordens-servico/${osId}/entrega`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setLinhas(d.itens || []);
      setObservacoes(d.observacoes || "");
      setHouveConferencia(!!d.houveConferencia);
      setEntrega(d.entrega || null);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao carregar.", "error");
    } finally {
      setLoading(false);
    }
  }, [osId, toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function setFicou(itemId: string, ficou: number) {
    setLinhas((p) =>
      p.map((l) =>
        l.itemId === itemId ? { ...l, ficou: Math.max(0, Math.min(ficou, l.separado)) } : l
      )
    );
  }

  const totalFicou = linhas.reduce((a, l) => a + (l.ficou > 0 ? 1 : 0), 0);

  async function salvar() {
    setSalvando(true);
    try {
      const res = await fetch(`/api/ordens-servico/${osId}/entrega`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: linhas.map((l) => ({ itemId: l.itemId, ficou: l.ficou })),
          observacoes,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(`Termo salvo — ${d.ficaram} item(ns) ficaram com o cliente.`, "success");
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSalvando(false);
    }
  }

  const linkCliente = entrega
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/entrega/${entrega.publicToken}`
    : "";

  if (loading)
    return (
      <div className="flex items-center justify-center h-24">
        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <PackageCheck className="h-4 w-4 text-blue-600" />
            O que ficou no evento
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Lista do que foi separado{houveConferencia ? " (conferência de saída)" : " (planejado)"}.
            Marque o que <strong>permaneceu com o cliente</strong> — isso gera o termo de entrega.
          </p>
        </div>
        <span className="text-xs font-medium text-blue-700 bg-blue-50 rounded-full px-2.5 py-1 shrink-0">
          {totalFicou} item(ns) ficaram
        </span>
      </div>

      {linhas.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
          Nada separado ainda. Confira as saídas na aba de conferência (ou adicione itens à OS).
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLinhas((p) => p.map((l) => ({ ...l, ficou: l.separado })))}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Tudo ficou
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => setLinhas((p) => p.map((l) => ({ ...l, ficou: 0 })))}
              className="text-xs font-medium text-slate-500 hover:underline"
            >
              Tudo voltou
            </button>
          </div>

          <div className="border border-slate-100 rounded-lg divide-y divide-slate-50">
            {linhas.map((l) => {
              const ficou = l.ficou > 0;
              return (
                <div
                  key={l.itemId}
                  className={`flex items-center gap-3 px-3 py-2 ${ficou ? "bg-amber-50/50" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={ficou}
                    onChange={(e) => setFicou(l.itemId, e.target.checked ? l.separado : 0)}
                    className="h-4 w-4 rounded shrink-0"
                    title="Marcar se ficou com o cliente"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 truncate">
                      {l.codigo && <span className="font-mono text-slate-400 mr-1">{l.codigo}</span>}
                      {l.nome}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">separado: {l.separado}</span>
                  {ficou && l.separado > 1 && (
                    <input
                      type="number"
                      min={1}
                      max={l.separado}
                      value={l.ficou}
                      onChange={(e) => setFicou(l.itemId, parseInt(e.target.value) || 0)}
                      className="h-8 w-16 rounded-md border border-amber-200 bg-white px-2 text-sm text-center shrink-0"
                      title="Quantas unidades ficaram"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Observações do termo (ex.: prazo de retirada, condição do material, responsável no local)..."
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={salvar} loading={salvando}>
              Salvar termo
            </Button>
            {entrega && (
              <>
                <a
                  href={`/ordens-servico/${osId}/entrega`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" type="button">
                    <Printer className="h-4 w-4" />
                    Imprimir / PDF
                  </Button>
                </a>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(linkCliente);
                    toast("Link do cliente copiado!", "success");
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copiar link do cliente
                </Button>
                <a href={linkCliente} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" type="button">
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </Button>
                </a>
              </>
            )}
          </div>

          {entrega?.aceiteEm ? (
            <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              Aceito por <strong>{entrega.clienteNome}</strong> em{" "}
              {new Date(entrega.aceiteEm).toLocaleString("pt-BR")}.
            </p>
          ) : entrega ? (
            <p className="text-xs text-slate-500">
              Link de aceite gerado — envie ao cliente para o “de acordo” com assinatura.
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              Salve o termo para gerar o link de aceite do cliente.
            </p>
          )}
        </>
      )}
    </div>
  );
}
