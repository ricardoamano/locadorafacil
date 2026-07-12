"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Bot, Send, ExternalLink, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";

// Assistente de WhatsApp — painel de comunicação com a equipe escalada
// (cada empresa dá o nome que quiser ao assistente, ex.: NESTOR)

interface Escalado {
  membroId: string;
  nome: string;
  funcao?: string | null;
  telefone: string | null;
  telefoneOriginal: string | null;
  mensagens: { ESCALA: string; ALTERACAO: string; LEMBRETE: string };
}

interface HistoricoMsg {
  id: string;
  tipo: string;
  status: string;
  erro?: string | null;
  enviadoPor?: string | null;
  createdAt: string;
  membro?: { nome: string } | null;
}

interface Resultado {
  membroId: string;
  nome: string;
  status: string;
  erro?: string | null;
  link?: string | null;
}

const TIPOS = [
  { value: "ESCALA", label: "📋 Escala (enviar a OS)" },
  { value: "ALTERACAO", label: "⚠️ Alteração na OS" },
  { value: "LEMBRETE", label: "🔔 Lembrete de data" },
  { value: "AVULSA", label: "💬 Mensagem personalizada" },
] as const;

const TIPO_LABEL: Record<string, string> = {
  ESCALA: "Escala",
  ALTERACAO: "Alteração",
  LEMBRETE: "Lembrete",
  AVULSA: "Personalizada",
};

export function OsNestor({ osId }: { osId: string }) {
  const { toast } = useToast();
  const [configurado, setConfigurado] = useState(false);
  const [assistente, setAssistente] = useState("Assistente");
  const [linkOs, setLinkOs] = useState<string | null>(null);
  const [escalados, setEscalados] = useState<Escalado[]>([]);
  const [historico, setHistorico] = useState<HistoricoMsg[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState<string>("ESCALA");
  const [textoAvulsa, setTextoAvulsa] = useState("");
  const [previewDe, setPreviewDe] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [links, setLinks] = useState<Resultado[]>([]);
  const [carregado, setCarregado] = useState(false);

  const carregar = useCallback(() => {
    fetch(`/api/nestor?osId=${osId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setConfigurado(d.configurado);
        setAssistente(d.assistente || "Assistente");
        setLinkOs(d.linkOs || null);
        setEscalados(d.escalados || []);
        setHistorico(d.historico || []);
        setSelecionados(
          new Set(
            (d.escalados || [])
              .filter((e: Escalado) => e.telefone)
              .map((e: Escalado) => e.membroId)
          )
        );
        setCarregado(true);
      })
      .catch(() => {});
  }, [osId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function toggle(membroId: string) {
    setSelecionados((p) => {
      const s = new Set(p);
      if (s.has(membroId)) s.delete(membroId);
      else s.add(membroId);
      return s;
    });
  }

  async function enviar() {
    if (selecionados.size === 0) {
      toast("Selecione pelo menos um membro da equipe.", "error");
      return;
    }
    if (tipo === "AVULSA" && !textoAvulsa.trim()) {
      toast("Escreva a mensagem personalizada.", "error");
      return;
    }
    setEnviando(true);
    setLinks([]);
    try {
      const res = await fetch("/api/nestor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          osId,
          tipo,
          membroIds: Array.from(selecionados),
          mensagemPersonalizada: tipo === "AVULSA" ? textoAvulsa : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      const resultados: Resultado[] = d.resultados || [];
      if (d.viaApi) {
        const ok = resultados.filter((r) => r.status === "ENVIADA").length;
        const falhas = resultados.filter((r) => r.status === "ERRO");
        if (ok > 0) toast(`${assistente} enviou ${ok} mensagem(ns) no WhatsApp! ✅`, "success");
        if (falhas.length > 0)
          toast(
            `${falhas.length} falha(s): ${falhas.map((f) => `${f.nome} (${f.erro})`).join("; ")}`,
            "error"
          );
      } else {
        setLinks(resultados.filter((r) => r.link));
        const semTel = resultados.filter((r) => r.status === "ERRO");
        if (semTel.length > 0)
          toast(`Sem telefone: ${semTel.map((f) => f.nome).join(", ")}`, "error");
      }
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao enviar.", "error");
    } finally {
      setEnviando(false);
    }
  }

  if (!carregado) return null;

  return (
    <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <Bot className="h-4 w-4 text-emerald-700" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{assistente} — WhatsApp da equipe</h3>
            <p className="text-xs text-slate-400">
              {configurado ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Envio automático ativo
                </span>
              ) : (
                <>
                  Modo manual (abre o WhatsApp com a mensagem pronta) ·{" "}
                  <Link href="/configuracoes/whatsapp" className="text-blue-600 hover:underline">
                    ativar envio automático
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        {linkOs && (
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(linkOs);
              toast("Link público da OS copiado!", "success");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
            title="Link simplificado da OS (sem valores) — para compartilhar com a equipe"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Copiar link público da OS
          </button>
        )}
      </div>

      {escalados.length === 0 ? (
        <p className="text-sm text-slate-400">
          Escale membros da equipe acima e salve a OS — depois o assistente avisa cada um pelo
          WhatsApp.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Tipo de mensagem */}
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  tipo === t.value
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tipo === "AVULSA" && (
            <Textarea
              value={textoAvulsa}
              onChange={(e) => setTextoAvulsa(e.target.value)}
              placeholder="Escreva o recado para a equipe selecionada..."
              rows={3}
            />
          )}

          {/* Escalados */}
          <div className="space-y-1.5">
            {escalados.map((e) => (
              <div key={e.membroId} className="border-b border-slate-50 pb-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selecionados.has(e.membroId)}
                    disabled={!e.telefone}
                    onChange={() => toggle(e.membroId)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span className="font-medium text-slate-800">{e.nome}</span>
                  {e.funcao && <span className="text-xs text-slate-400">· {e.funcao}</span>}
                  {e.telefone ? (
                    <span className="text-xs text-slate-400 ml-auto">{e.telefoneOriginal}</span>
                  ) : (
                    <span className="text-xs text-red-500 ml-auto inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> sem telefone no cadastro
                    </span>
                  )}
                  {tipo !== "AVULSA" && (
                    <button
                      onClick={() => setPreviewDe(previewDe === e.membroId ? null : e.membroId)}
                      className="text-slate-400 hover:text-emerald-600"
                      title="Ver mensagem"
                    >
                      {previewDe === e.membroId ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
                {previewDe === e.membroId && tipo !== "AVULSA" && (
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50/60 border border-emerald-100 p-3 text-xs text-slate-700 font-sans">
                    {e.mensagens[tipo as keyof typeof e.mensagens]}
                  </pre>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={enviar} loading={enviando} size="sm">
              <Send className="h-4 w-4" />
              {configurado ? `Enviar pelo ${assistente}` : "Preparar mensagens"}
            </Button>
            <span className="text-xs text-slate-400">
              {selecionados.size} selecionado(s) · sem valores financeiros na mensagem
            </span>
          </div>

          {/* Links wa.me quando não há API configurada */}
          {links.length > 0 && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-emerald-800">
                Mensagens prontas — clique para abrir cada conversa no WhatsApp:
              </p>
              {links.map((l) => (
                <a
                  key={l.membroId}
                  href={l.link!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-emerald-700 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Enviar para {l.nome}
                </a>
              ))}
            </div>
          )}

          {/* Histórico */}
          {historico.length > 0 && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-medium text-slate-600">
                Histórico de envios ({historico.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {historico.map((h) => (
                  <li key={h.id} className="flex items-center gap-2">
                    <span
                      className={
                        h.status === "ENVIADA"
                          ? "text-emerald-600"
                          : h.status === "LINK"
                            ? "text-blue-500"
                            : "text-red-500"
                      }
                    >
                      {h.status === "ENVIADA" ? "✓" : h.status === "LINK" ? "↗" : "✕"}
                    </span>
                    <span>
                      {TIPO_LABEL[h.tipo] || h.tipo} para {h.membro?.nome || h.id} ·{" "}
                      {new Date(h.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {h.enviadoPor ? ` · ${h.enviadoPor}` : ""}
                      {h.erro ? ` · ${h.erro}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
