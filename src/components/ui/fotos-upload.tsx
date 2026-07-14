"use client";

import React, { useRef, useState, useEffect } from "react";
import { ImagePlus, X, Search, ClipboardPaste, Star } from "lucide-react";
import { useToast } from "@/components/ui/toast";

// Upload de várias fotos (galeria do item) — grava no banco via /api/upload.
// Também: link de busca de imagens no Google + colar imagem (Ctrl+V).
// A capa é escolhida entre as próprias fotos (estrela), sem upload separado.

export function FotosUpload({
  label,
  value,
  onChange,
  consultaBusca,
  capa,
  onCapa,
}: {
  label?: string;
  value: string[];
  onChange: (urls: string[]) => void;
  // Texto para o botão "Buscar imagens no Google" (ex.: marca + modelo + nome)
  consultaBusca?: string;
  // Foto de capa selecionada e callback para alterá-la
  capa?: string;
  onCapa?: (url: string) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  // Guarda em ref para o listener de "paste" sempre ver o value/estado atuais
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  async function enviarArquivos(files: File[]) {
    setEnviando(true);
    const novas: string[] = [];
    try {
      for (const file of files.slice(0, 10)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const d = await res.json();
        if (!res.ok) {
          toast(`${file.name || "imagem"}: ${d.error || "erro no upload"}`, "error");
          continue;
        }
        novas.push(d.url);
      }
      if (novas.length > 0) {
        onChange([...valueRef.current, ...novas]);
        // Se ainda não há capa, a primeira foto adicionada vira a capa
        if (onCapa && !capa) onCapa(novas[0]);
      }
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // Colar imagem (Ctrl+V) de qualquer lugar enquanto o formulário está aberto.
  // Só age quando o clipboard tem imagem — não atrapalha colar texto nos campos.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const itens = Array.from(e.clipboardData?.items || []);
      const imgs = itens
        .filter((it) => it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);
      if (imgs.length === 0) return;
      e.preventDefault();
      enviarArquivos(imgs);
      toast("Imagem colada — enviando... 📋", "success");
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscaUrl = consultaBusca?.trim()
    ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(consultaBusca.trim())}`
    : "";

  return (
    <div>
      {label && <p className="text-sm font-medium text-slate-700 mb-1">{label}</p>}

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {buscaUrl && (
          <a
            href={buscaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Buscar imagens no Google
          </a>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <ClipboardPaste className="h-3.5 w-3.5" />
          copie a imagem e cole aqui (Ctrl+V)
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => {
          const ehCapa = !!onCapa && capa === url;
          return (
            <div
              key={i}
              className={`relative h-20 w-20 rounded-lg overflow-hidden border-2 group ${
                ehCapa ? "border-amber-400" : "border-slate-200"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              {onCapa && (
                <button
                  type="button"
                  onClick={() => onCapa(url)}
                  title={ehCapa ? "Esta é a capa" : "Definir como capa"}
                  className={`absolute bottom-0.5 left-0.5 h-5 w-5 rounded-full flex items-center justify-center transition-opacity ${
                    ehCapa
                      ? "bg-amber-400 text-white"
                      : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <Star className={`h-3 w-3 ${ehCapa ? "fill-current" : ""}`} />
                </button>
              )}
              {ehCapa && (
                <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold text-amber-700 bg-amber-100 rounded px-1">
                  CAPA
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  const novas = value.filter((_, idx) => idx !== i);
                  onChange(novas);
                  // Se removeu a capa, escolhe a primeira restante (ou limpa)
                  if (onCapa && capa === url) onCapa(novas[0] || "");
                }}
                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="h-20 w-20 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors disabled:opacity-60"
        >
          {enviando ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px] mt-0.5">Adicionar</span>
            </>
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && enviarArquivos(Array.from(e.target.files))}
      />
    </div>
  );
}
