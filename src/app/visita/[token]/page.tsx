"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { FileText, MessageCircle, Send, MapPin, User } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Link público da visita técnica: material organizado (fotos, vídeos,
// arquivos). Visitantes podem comentar após se identificar (nome + contato).

export default function VisitaPublicaPage() {
  const params = useParams<{ token: string }>();
  const [dados, setDados] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  // Identificação do visitante (fica no navegador)
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [identificado, setIdentificado] = useState(false);
  const [idOpen, setIdOpen] = useState(false);
  // Comentário
  const [comentando, setComentando] = useState<string | null>(null); // midiaId | "geral"
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/visita-publica/${params.token}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDados(d);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Link inválido.");
    } finally {
      setLoading(false);
    }
  }, [params.token]);

  useEffect(() => {
    carregar();
    try {
      const salvo = JSON.parse(localStorage.getItem("visita_identidade") || "null");
      if (salvo?.nome && salvo?.contato) {
        setNome(salvo.nome);
        setContato(salvo.contato);
        setIdentificado(true);
      }
    } catch {}
  }, [carregar]);

  function confirmarIdentidade() {
    const ehEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contato.trim());
    const ehCel = contato.replace(/\D/g, "").length >= 10;
    if (nome.trim().length < 3 || (!ehEmail && !ehCel)) return;
    localStorage.setItem("visita_identidade", JSON.stringify({ nome: nome.trim(), contato: contato.trim() }));
    setIdentificado(true);
    setIdOpen(false);
  }

  async function comentar() {
    if (!texto.trim() || !comentando) return;
    if (!identificado) {
      setIdOpen(true);
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/visita-publica/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autorNome: nome,
          autorContato: contato,
          texto,
          midiaId: comentando === "geral" ? null : comentando,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setTexto("");
      setComentando(null);
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao comentar.");
    } finally {
      setEnviando(false);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  if (erro || !dados)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-4xl mb-3">🔍</p>
          <h1 className="text-lg font-semibold text-slate-800">{erro || "Link inválido"}</h1>
        </div>
      </div>
    );

  const v = dados.visita;
  const comentariosDe = (midiaId: string | null) =>
    (v.comentarios || []).filter((c: any) => c.midiaId === midiaId);

  const CaixaComentario = ({ alvo }: { alvo: string }) =>
    comentando === alvo ? (
      <div className="flex gap-1.5 mt-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && comentar()}
          placeholder={identificado ? `Comentando como ${nome}...` : "Seu comentário..."}
          autoFocus
          className="flex-1 h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={comentar}
          disabled={enviando}
          className="h-10 px-3 rounded-lg bg-blue-600 text-white disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    ) : (
      <button
        onClick={() => { setComentando(alvo); setTexto(""); if (!identificado) setIdOpen(true); }}
        className="mt-2 text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
      >
        <MessageCircle className="h-3.5 w-3.5" /> Comentar
      </button>
    );

  return (
    <div className="min-h-screen bg-slate-50 py-5 px-3">
      <div className="max-w-2xl mx-auto space-y-3">
        {/* Cabeçalho */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
          {dados.empresa?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dados.empresa.logoUrl} alt="" className="max-h-12 mx-auto mb-2 object-contain" />
          ) : (
            <p className="text-sm font-semibold text-slate-700">{dados.empresa?.name}</p>
          )}
          <h1 className="text-xl font-bold text-slate-900">{v.titulo}</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-2 flex-wrap">
            {v.localNome && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {v.localNome}
              </span>
            )}
            {v.data && <span>{new Date(v.data).toLocaleDateString("pt-BR")}</span>}
          </p>
          {identificado && (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded-full inline-flex items-center gap-1 px-2.5 py-0.5 mt-2">
              <User className="h-3 w-3" /> {nome}
            </p>
          )}
        </div>

        {v.observacoes && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-sm text-slate-700 whitespace-pre-wrap">
            {v.observacoes}
          </div>
        )}

        {/* Mídias */}
        {(v.midias || []).map((m: any) => (
          <div key={m.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {m.tipo === "FOTO" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt={m.descricao || ""} className="w-full max-h-[480px] object-contain bg-slate-900/5" />
            )}
            {m.tipo === "VIDEO" && <video src={m.url} controls className="w-full max-h-[480px] bg-black" />}
            {m.tipo === "ARQUIVO" && (
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-4 text-blue-600 hover:underline">
                <FileText className="h-5 w-5 shrink-0" /> {m.nome || "Arquivo"}
              </a>
            )}
            <div className="p-3">
              {m.descricao && <p className="text-sm text-slate-700">{m.descricao}</p>}
              {comentariosDe(m.id).length > 0 && (
                <div className="mt-2 space-y-1">
                  {comentariosDe(m.id).map((c: any) => (
                    <p key={c.id} className="text-xs text-slate-600 bg-slate-50 rounded-md px-2 py-1">
                      <strong className={c.interno ? "text-blue-700" : "text-emerald-700"}>{c.autorNome}:</strong>{" "}
                      {c.texto}
                    </p>
                  ))}
                </div>
              )}
              <CaixaComentario alvo={m.id} />
            </div>
          </div>
        ))}

        {/* Comentários gerais */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Comentários gerais</h2>
          {comentariosDe(null).length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum comentário ainda.</p>
          ) : (
            <div className="space-y-1">
              {comentariosDe(null).map((c: any) => (
                <p key={c.id} className="text-xs text-slate-600 bg-slate-50 rounded-md px-2 py-1">
                  <strong className={c.interno ? "text-blue-700" : "text-emerald-700"}>{c.autorNome}:</strong>{" "}
                  {c.texto}
                </p>
              ))}
            </div>
          )}
          <CaixaComentario alvo="geral" />
        </div>

        <p className="text-center text-xs text-slate-400 pb-4">{dados.empresa?.name} — visita técnica</p>
      </div>

      {/* Identificação para comentar */}
      {idOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <h3 className="font-semibold text-slate-900 mb-1">Identifique-se para comentar</h3>
            <p className="text-xs text-slate-500 mb-3">
              Seu nome aparece no comentário; o contato fica visível só para a equipe.
            </p>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo *"
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="E-mail ou celular *"
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIdOpen(false)}
                className="flex-1 h-10 rounded-lg border border-slate-200 text-sm text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarIdentidade}
                disabled={
                  nome.trim().length < 3 ||
                  (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contato.trim()) &&
                    contato.replace(/\D/g, "").length < 10)
                }
                className="flex-1 h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
