"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { mdParaHtml } from "@/lib/markdown";
import { LifeBuoy, Send, Plus, MessageSquare, Trash2 } from "lucide-react";

// Módulo Ajuda — chat com IA que consulta o Banco de Preços de Mercado
// e o estoque próprio: "quem tem um moving XYZ?", "quanto custa a diária?"
// Agora com histórico de conversas por usuário (estilo ChatGPT/Claude).

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface ConversaResumo {
  id: string;
  titulo: string;
  updatedAt: string;
}

const SUGESTOES = [
  "Quem tem moving head para alugar?",
  "Quanto custa a diária de um painel de LED no mercado?",
  "Quais equipamentos temos em estoque com mais de 5 unidades?",
];

export default function AjudaPage() {
  const { toast } = useToast();
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [gerando, setGerando] = useState(false);
  const [conversas, setConversas] = useState<ConversaResumo[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregarConversas = useCallback(() => {
    fetch("/api/ia/ajuda/conversas")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setConversas(d.conversas || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregarConversas();
  }, [carregarConversas]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, gerando]);

  function novaConversa() {
    setMensagens([]);
    setConversaId(null);
    setTexto("");
  }

  async function abrirConversa(id: string) {
    if (id === conversaId) return;
    try {
      const res = await fetch(`/api/ia/ajuda/conversas/${id}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setMensagens((d.mensagens || []) as Msg[]);
      setConversaId(id);
    } catch {
      toast("Não foi possível abrir esta conversa.", "error");
    }
  }

  async function excluirConversa(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/ia/ajuda/conversas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      if (id === conversaId) novaConversa();
      carregarConversas();
    } catch {
      toast("Erro ao excluir conversa.", "error");
    }
  }

  async function enviar(msgDireta?: string) {
    const msg = (msgDireta ?? texto).trim();
    if (!msg || gerando) return;
    const novas: Msg[] = [...mensagens, { role: "user", content: msg }];
    setMensagens(novas);
    setTexto("");
    setGerando(true);
    try {
      const res = await fetch("/api/ia/ajuda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: novas, conversaId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMensagens((p) => [...p, { role: "assistant", content: d.resposta }]);
      if (d.conversaId) {
        setConversaId(d.conversaId);
        carregarConversas();
      }
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro na IA.", "error");
      setMensagens(mensagens);
      setTexto(msg);
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Ajuda" }]} />
      <main className="pt-14 p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-violet-600" />
            Ajuda
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pergunte sobre equipamentos, quem tem e quanto custa — respondo com base no seu
            estoque e no Banco de Preços de Mercado.
          </p>
        </div>

        <div className="flex gap-4 max-w-6xl">
          {/* Histórico de conversas */}
          <aside className="hidden md:flex w-60 shrink-0 flex-col bg-white rounded-xl border border-slate-100 shadow-sm h-[calc(100vh-220px)]">
            <div className="p-3 border-b border-slate-100">
              <Button size="sm" className="w-full" onClick={novaConversa}>
                <Plus className="h-4 w-4" />
                Nova conversa
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversas.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 px-2">
                  Suas conversas ficam salvas aqui.
                </p>
              ) : (
                conversas.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => abrirConversa(c.id)}
                    className={`group w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      c.id === conversaId
                        ? "bg-violet-50 text-violet-700"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="flex-1 truncate">{c.titulo}</span>
                    <span
                      onClick={(e) => excluirConversa(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Chat */}
          <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col h-[calc(100vh-220px)]">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {mensagens.length === 0 && (
                <div className="text-center py-10">
                  <LifeBuoy className="h-8 w-8 mx-auto mb-3 text-violet-200" />
                  <p className="text-sm text-slate-400 mb-4">
                    Ex.: &quot;quem tem um moving modelo MAC Aura?&quot; · &quot;quanto custa a
                    diária desse moving?&quot;
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGESTOES.map((sug) => (
                      <button
                        key={sug}
                        onClick={() => enviar(sug)}
                        className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-700 hover:bg-violet-100 transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {mensagens.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-violet-600 text-white text-sm px-4 py-2.5 whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div
                      className="proposta-md max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-50 border border-slate-100 text-sm px-4 py-3"
                      dangerouslySetInnerHTML={{ __html: mdParaHtml(m.content) }}
                    />
                  </div>
                )
              )}
              {gerando && (
                <div className="flex items-center gap-2 text-xs text-slate-400 pl-1">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                  Consultando o banco...
                </div>
              )}
              <div ref={fimRef} />
            </div>

            <div className="border-t border-slate-100 p-3 flex gap-2 items-end">
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                rows={2}
                placeholder="Pergunte algo... (Enter envia)"
              />
              <Button onClick={() => enviar()} loading={gerando} size="sm">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
