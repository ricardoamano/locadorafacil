"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Zap, Send, Copy, RotateCcw, MessageCircle, FileText } from "lucide-react";

// Orçamento Rápido — chat com o assistente da empresa (mesma IA do WhatsApp).
// Digite o briefing do cliente e receba o texto pronto com quantidades e
// valores do catálogo; copie ou abra direto no WhatsApp para enviar.

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "orc_rapido_chat";

/** Converte a formatação de WhatsApp (*negrito*) para exibição no chat. */
function renderWhats(texto: string): React.ReactNode {
  return texto.split("\n").map((linha, i) => (
    <p key={i} className="min-h-[1em] whitespace-pre-wrap break-words">
      {linha.split(/(\*[^*\n]+\*)/g).map((parte, j) =>
        parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? (
          <strong key={j}>{parte.slice(1, -1)}</strong>
        ) : (
          <React.Fragment key={j}>{parte}</React.Fragment>
        )
      )}
    </p>
  ));
}

export default function OrcamentoRapidoPage() {
  const { toast } = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [formalizando, setFormalizando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      if (salvo) setMsgs(JSON.parse(salvo));
    } catch {}
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, enviando]);

  function persistir(novas: Msg[]) {
    setMsgs(novas);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(novas.slice(-30)));
    } catch {}
  }

  async function enviar() {
    const briefing = texto.trim();
    if (!briefing || enviando) return;
    const novas: Msg[] = [...msgs, { role: "user", content: briefing }];
    persistir(novas);
    setTexto("");
    setEnviando(true);
    try {
      const res = await fetch("/api/orcamentos/rapido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: novas }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro ao gerar");
      persistir([...novas, { role: "assistant", content: d.texto }]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao gerar o orçamento.", "error");
      persistir(novas.slice(0, -1));
      setTexto(briefing);
    } finally {
      setEnviando(false);
    }
  }

  async function formalizar() {
    if (formalizando || msgs.length === 0) return;
    setFormalizando(true);
    try {
      const res = await fetch("/api/orcamentos/rapido/formalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: msgs }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro ao formalizar");
      const avisos = Array.isArray(d.avisos) && d.avisos.length ? `\n⚠️ ${d.avisos.join("\n⚠️ ")}` : "";
      persistir([
        ...msgs,
        {
          role: "assistant",
          content: `✅ *Orçamento #${d.numero} criado no sistema!*\n${d.qtdItens} ${d.qtdItens === 1 ? "item" : "itens"} · Total: ${Number(d.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${avisos}`,
        },
      ]);
      toast(`Orçamento #${d.numero} criado! Abrindo...`, "success");
      window.open(`/orcamentos/${d.id}`, "_blank");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao formalizar.", "error");
    } finally {
      setFormalizando(false);
    }
  }

  function copiar(t: string) {
    navigator.clipboard.writeText(t);
    toast("Texto copiado! Cole no WhatsApp do cliente.", "success");
  }

  function abrirWhatsapp(t: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, "_blank");
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-8rem)]">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
            <Zap className="h-5 w-5 text-violet-700" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Orçamento Rápido</h1>
            <p className="text-xs text-slate-500">
              Briefing do cliente → texto pronto com valores do seu catálogo
            </p>
          </div>
        </div>
        {msgs.length > 0 && (
          <button
            onClick={() => {
              persistir([]);
              toast("Conversa limpa.", "success");
            }}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Limpar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-3">
        {msgs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-slate-400 px-6">
            <MessageCircle className="h-8 w-8" />
            <p className="text-sm">
              Descreva o que o cliente precisa. Ex.: <br />
              <span className="italic">
                &quot;4 TVs 55, 2 notebooks e 1 impressora, evento de 2 diárias&quot;
              </span>
            </p>
            <p className="text-xs">
              Pode pedir ajustes depois: &quot;troca por 3 TVs&quot;, &quot;quanto fica por semana?&quot;
            </p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                m.role === "user"
                  ? "bg-violet-600 text-white rounded-br-sm"
                  : "bg-white text-slate-800 border border-slate-100 rounded-bl-sm"
              }`}
            >
              {renderWhats(m.content)}
              {m.role === "assistant" && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => copiar(m.content)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600"
                  >
                    <Copy className="h-3 w-3" /> Copiar
                  </button>
                  <button
                    onClick={() => abrirWhatsapp(m.content)}
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    <MessageCircle className="h-3 w-3" /> Enviar no WhatsApp
                  </button>
                  {i === msgs.length - 1 && (
                    <button
                      onClick={formalizar}
                      disabled={formalizando}
                      className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium disabled:opacity-50"
                    >
                      <FileText className="h-3 w-3" />
                      {formalizando ? "Criando..." : "Criar orçamento oficial"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {enviando && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <div className="flex items-end gap-2 pt-3">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={2}
          placeholder="Digite ou cole o briefing do cliente..."
          className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        />
        <Button onClick={enviar} loading={enviando} disabled={!texto.trim()} className="h-11">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
