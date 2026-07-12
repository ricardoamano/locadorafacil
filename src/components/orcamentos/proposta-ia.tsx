"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { mdParaHtml } from "@/lib/markdown";
import { Sparkles, Send, Check } from "lucide-react";

// Chat de geração de propostas com IA (usa a skill configurada pela empresa).
// A resposta escolhida cai direto no campo de conteúdo do Projeto Especial.

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function PropostaIa({ onUsar }: { onUsar: (markdown: string) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [gerando, setGerando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, gerando]);

  async function enviar() {
    const msg = texto.trim();
    if (!msg || gerando) return;
    const novas: Msg[] = [...mensagens, { role: "user", content: msg }];
    setMensagens(novas);
    setTexto("");
    setGerando(true);
    try {
      const res = await fetch("/api/ia/proposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: novas }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMensagens((p) => [...p, { role: "assistant", content: d.resposta }]);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro na IA.", "error");
      setMensagens(mensagens); // desfaz a mensagem que falhou
      setTexto(msg);
    } finally {
      setGerando(false);
    }
  }

  const ultimaResposta = [...mensagens].reverse().find((m) => m.role === "assistant");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Gerar com IA
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="✨ Gerar proposta com IA" size="lg">
        <ModalBody>
          <div className="flex flex-col h-[60vh]">
            {/* Conversa */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {mensagens.length === 0 && (
                <div className="text-sm text-slate-400 text-center py-8 px-6">
                  <Sparkles className="h-6 w-6 mx-auto mb-2 text-violet-300" />
                  Descreva o projeto e a IA escreve a proposta completa seguindo as
                  instruções da empresa.
                  <p className="mt-2 text-xs">
                    Ex: &quot;Aplicativo de credenciamento para evento de 5 mil pessoas,
                    com QR code, 3 telas, prazo de 6 semanas&quot;
                  </p>
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
                  Escrevendo a proposta...
                </div>
              )}
              <div ref={fimRef} />
            </div>

            {/* Entrada */}
            <div className="pt-3 border-t border-slate-100 mt-3 flex gap-2 items-end">
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
                placeholder="Descreva o projeto ou peça ajustes... (Enter envia)"
              />
              <Button onClick={enviar} loading={gerando} size="sm">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          {ultimaResposta && (
            <Button
              onClick={() => {
                onUsar(ultimaResposta.content);
                setOpen(false);
                toast("Proposta inserida no projeto — revise e ajuste o valor. ✨", "success");
              }}
            >
              <Check className="h-4 w-4" />
              Usar esta proposta
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </>
  );
}
