"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { mdParaHtml } from "@/lib/markdown";
import { Sparkles, Send, Truck } from "lucide-react";

// Chat de logística/escala dentro da OS. Usa a skill de tipo ESCALA da empresa
// junto com o contexto da própria ordem de serviço (equipamentos, datas, local,
// equipe e veículos). Ajuda a dimensionar equipe e frota e a pensar a operação.

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGESTOES = [
  "Quantas pessoas e quais funções preciso para a montagem?",
  "Sugira a escala de veículos para levar esses equipamentos.",
  "Monte uma timeline da operação (montagem, evento, desmontagem).",
  "Quais riscos logísticos você vê nesta OS?",
];

export function OsEscalaIa({ osId }: { osId: string }) {
  const { toast } = useToast();
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [gerando, setGerando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, gerando]);

  async function enviar(msgTexto?: string) {
    const msg = (msgTexto ?? texto).trim();
    if (!msg || gerando) return;
    const novas: Msg[] = [...mensagens, { role: "user", content: msg }];
    setMensagens(novas);
    setTexto("");
    setGerando(true);
    try {
      const res = await fetch(`/api/ordens-servico/${osId}/escala-ia`, {
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

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center">
          <Truck className="h-4 w-4 text-violet-700" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Assistente de escala e logística
          </h3>
          <p className="text-xs text-slate-400">
            Pergunte sobre equipe, veículos e a operação — a IA já conhece esta OS.
          </p>
        </div>
      </div>

      <div className="mt-3 max-h-[50vh] overflow-y-auto space-y-3 pr-1">
        {mensagens.length === 0 ? (
          <div className="py-4">
            <div className="flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviar(s)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-violet-100 bg-violet-50/60 text-violet-700 hover:bg-violet-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          mensagens.map((m, i) =>
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
          )
        )}
        {gerando && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pl-1">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            Pensando na logística...
          </div>
        )}
        <div ref={fimRef} />
      </div>

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
          placeholder="Ex.: com esses equipamentos, quantos técnicos e qual veículo? (Enter envia)"
        />
        <Button onClick={() => enviar()} loading={gerando} size="sm">
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {mensagens.length === 0 && (
        <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Requer a IA configurada pelo administrador (Configurações → Inteligência
          Artificial).
        </p>
      )}
    </div>
  );
}
