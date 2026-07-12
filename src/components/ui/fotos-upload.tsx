"use client";

import React, { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

// Upload de várias fotos (galeria do item) — grava no banco via /api/upload

export function FotosUpload({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviarArquivos(files: FileList) {
    setEnviando(true);
    const novas: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const d = await res.json();
        if (!res.ok) {
          toast(`${file.name}: ${d.error || "erro no upload"}`, "error");
          continue;
        }
        novas.push(d.url);
      }
      if (novas.length > 0) onChange([...value, ...novas]);
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      {label && <p className="text-sm font-medium text-slate-700 mb-1">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden border border-slate-200 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
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
        onChange={(e) => e.target.files?.length && enviarArquivos(e.target.files)}
      />
    </div>
  );
}
