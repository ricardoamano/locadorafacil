"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { NaoEncontrado } from "@/components/ui/nao-encontrado";
import { AnotadorFoto } from "@/components/visitas/anotador-foto";
import {
  Camera,
  Video,
  Paperclip,
  Copy,
  ExternalLink,
  Trash2,
  Pencil,
  FileText,
  MessageCircle,
  Send,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Comprime a foto no navegador (máx 1600px, JPEG) — cabe no limite de 4 MB
// e sobe rápido mesmo no 4G do evento.
async function comprimirFoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const urlTmp = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b || file), "image/jpeg", 0.85);
      URL.revokeObjectURL(urlTmp);
    };
    img.onerror = () => resolve(file);
    img.src = urlTmp;
  });
}

export default function VisitaDetalhePage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [visita, setVisita] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [obs, setObs] = useState("");
  const [descEdit, setDescEdit] = useState<Record<string, string>>({});
  const [comentando, setComentando] = useState<string | null>(null); // midiaId ou "geral"
  const [comentarioTexto, setComentarioTexto] = useState("");
  const [anotando, setAnotando] = useState<any | null>(null);
  const refFoto = useRef<HTMLInputElement>(null);
  const refVideo = useRef<HTMLInputElement>(null);
  const refArquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/visitas/${params.id}`);
      if (!res.ok) {
        setVisita(null);
        return;
      }
      const d = await res.json();
      setVisita(d);
      setObs(d.observacoes || "");
      const de: Record<string, string> = {};
      for (const m of d.midias || []) de[m.id] = m.descricao || "";
      setDescEdit(de);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviarMidia(file: File, ehFoto: boolean) {
    setEnviando(true);
    try {
      const blob = ehFoto ? await comprimirFoto(file) : file;
      if (blob.size > 4 * 1024 * 1024) {
        toast(
          "Arquivo acima de 4 MB — para vídeos longos, suba no Drive e cole o link nas observações.",
          "error"
        );
        return;
      }
      const fd = new FormData();
      fd.append("file", new File([blob], file.name || "midia", { type: blob.type || file.type }));
      const res = await fetch(`/api/visitas/${params.id}/midias`, { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast("Enviado! Adicione a descrição. 📸", "success");
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao enviar.", "error");
    } finally {
      setEnviando(false);
    }
  }

  async function salvarDescricao(midiaId: string) {
    try {
      const res = await fetch(`/api/visitas/${params.id}/midias`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ midiaId, descricao: descEdit[midiaId] || "" }),
      });
      if (!res.ok) throw new Error();
      toast("Descrição salva.", "success");
    } catch {
      toast("Erro ao salvar descrição.", "error");
    }
  }

  async function excluirMidia(midiaId: string) {
    try {
      const res = await fetch(`/api/visitas/${params.id}/midias?midiaId=${midiaId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      carregar();
    } catch {
      toast("Erro ao excluir.", "error");
    }
  }

  async function salvarObs() {
    try {
      const res = await fetch(`/api/visitas/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacoes: obs }),
      });
      if (!res.ok) throw new Error();
      toast("Observações salvas.", "success");
    } catch {
      toast("Erro ao salvar.", "error");
    }
  }

  async function comentar() {
    if (!comentarioTexto.trim() || !comentando) return;
    try {
      const res = await fetch(`/api/visitas/${params.id}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: comentarioTexto,
          midiaId: comentando === "geral" ? null : comentando,
        }),
      });
      if (!res.ok) throw new Error();
      setComentarioTexto("");
      setComentando(null);
      carregar();
    } catch {
      toast("Erro ao comentar.", "error");
    }
  }

  async function salvarAnotacao(blob: Blob) {
    if (!anotando) return;
    const fd = new FormData();
    fd.append("file", new File([blob], "anotada.jpg", { type: "image/jpeg" }));
    fd.append("substituirId", anotando.id);
    const res = await fetch(`/api/visitas/${params.id}/midias`, { method: "POST", body: fd });
    if (res.ok) {
      toast("Anotações salvas na foto! 🖊️", "success");
      carregar();
    } else {
      toast("Erro ao salvar anotações.", "error");
    }
  }

  if (loading)
    return (
      <>
        <Header breadcrumbs={[{ label: "Visitas Técnicas" }]} />
        <main className="pt-14 p-6 flex justify-center h-60 items-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </main>
      </>
    );
  if (!visita)
    return (
      <>
        <Header breadcrumbs={[{ label: "Visitas Técnicas" }]} />
        <main className="pt-14 p-6">
          <NaoEncontrado mensagem="Visita não encontrada." voltarHref="/visitas" voltarLabel="Voltar" />
        </main>
      </>
    );

  const linkPublico = `${typeof window !== "undefined" ? window.location.origin : ""}/visita/${visita.publicToken}`;
  const comentariosDe = (midiaId: string | null) =>
    (visita.comentarios || []).filter((c: any) => c.midiaId === midiaId);

  return (
    <>
      <Header breadcrumbs={[{ label: "Visitas Técnicas" }, { label: visita.titulo }]} />
      <main className="pt-14 p-3 sm:p-6 max-w-3xl mx-auto">
        {/* Cabeçalho + link público */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3">
          <h1 className="text-lg font-bold text-slate-900">{visita.titulo}</h1>
          {visita.localNome && <p className="text-sm text-slate-500">{visita.localNome}</p>}
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(linkPublico);
                toast("Link público copiado! 🔗", "success");
              }}
            >
              <Copy className="h-4 w-4" /> Copiar link público
            </Button>
            <a href={linkPublico} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4" /> Abrir
              </Button>
            </a>
          </div>
        </div>

        {/* Botões de captura — grandes para uso no celular */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <button
            onClick={() => refFoto.current?.click()}
            disabled={enviando}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-blue-600 text-white py-5 font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <Camera className="h-7 w-7" />
            {enviando ? "Enviando..." : "Tirar foto"}
          </button>
          <button
            onClick={() => refVideo.current?.click()}
            disabled={enviando}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-violet-600 text-white py-5 font-semibold text-sm hover:bg-violet-700 transition-colors disabled:opacity-60"
          >
            <Video className="h-7 w-7" />
            Gravar vídeo
          </button>
          <button
            onClick={() => refArquivo.current?.click()}
            disabled={enviando}
            className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-600 py-5 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            <Paperclip className="h-7 w-7" />
            Anexar arquivo
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mb-4 text-center">
          Fotos são comprimidas automaticamente. Vídeos: até 4 MB (clipes curtos) — vídeos longos,
          suba no Drive e cole o link nas observações.
        </p>
        <input ref={refFoto} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarMidia(f, true); e.target.value = ""; }} />
        <input ref={refVideo} type="file" accept="video/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarMidia(f, false); e.target.value = ""; }} />
        <input ref={refArquivo} type="file" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarMidia(f, f.type.startsWith("image/")); e.target.value = ""; }} />

        {/* Mídias */}
        <div className="space-y-3">
          {(visita.midias || []).map((m: any) => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {m.tipo === "FOTO" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.descricao || ""} className="w-full max-h-[420px] object-contain bg-slate-900/5" />
              )}
              {m.tipo === "VIDEO" && (
                <video src={m.url} controls className="w-full max-h-[420px] bg-black" />
              )}
              {m.tipo === "ARQUIVO" && (
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-4 text-blue-600 hover:underline">
                  <FileText className="h-5 w-5 shrink-0" />
                  {m.nome || "Arquivo"}
                </a>
              )}
              <div className="p-3">
                <div className="flex gap-2">
                  <input
                    value={descEdit[m.id] ?? ""}
                    onChange={(e) => setDescEdit((p) => ({ ...p, [m.id]: e.target.value }))}
                    onBlur={() => (descEdit[m.id] ?? "") !== (m.descricao || "") && salvarDescricao(m.id)}
                    placeholder="Descrição / comentário desta mídia..."
                    className="flex-1 h-9 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {m.tipo === "FOTO" && (
                    <button
                      onClick={() => setAnotando(m)}
                      className="h-9 px-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 shrink-0"
                      title="Desenhar anotações coloridas na foto"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => excluirMidia(m.id)}
                    className="h-9 px-2 rounded-lg text-slate-300 hover:text-red-500 shrink-0"
                    title="Excluir mídia"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Comentários da mídia */}
                {comentariosDe(m.id).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {comentariosDe(m.id).map((c: any) => (
                      <p key={c.id} className="text-xs text-slate-600 bg-slate-50 rounded-md px-2 py-1">
                        <strong className={c.interno ? "text-blue-700" : "text-emerald-700"}>
                          {c.autorNome}
                          {!c.interno && " (externo)"}:
                        </strong>{" "}
                        {c.texto}
                      </p>
                    ))}
                  </div>
                )}
                {comentando === m.id ? (
                  <div className="flex gap-1.5 mt-2">
                    <input
                      value={comentarioTexto}
                      onChange={(e) => setComentarioTexto(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && comentar()}
                      placeholder="Seu comentário..."
                      autoFocus
                      className="flex-1 h-9 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button size="sm" onClick={comentar}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setComentando(m.id); setComentarioTexto(""); }}
                    className="mt-2 text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Comentar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Observações gerais */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mt-4">
          <Textarea
            label="Observações gerais da visita"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Anotações gerais: acesso de carga, energia, pé-direito, contatos do local, links de vídeos longos..."
            rows={4}
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" onClick={salvarObs}>Salvar observações</Button>
          </div>
        </div>

        {anotando && (
          <AnotadorFoto
            url={anotando.url}
            open={!!anotando}
            onClose={() => setAnotando(null)}
            onSalvar={salvarAnotacao}
          />
        )}
      </main>
    </>
  );
}
