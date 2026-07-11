"use client";

import React, { useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";

interface ImageUploadProps {
  label?: string;
  value: string; // URL da imagem (ex.: /api/arquivos/abc)
  onChange: (url: string) => void;
  hint?: string;
}

export function ImageUpload({ label, value, onChange, hint }: ImageUploadProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(file: File) {
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Erro ao enviar imagem.", "error");
        return;
      }
      onChange(d.url);
      toast("Imagem enviada!", "success");
    } catch {
      toast("Erro ao enviar imagem.", "error");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-300" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {value ? "Trocar imagem" : "Enviar imagem"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-sm text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Remover imagem"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviar(f);
          }}
        />
      </div>
      <p className="text-xs text-slate-400">{hint || "JPG, PNG, WEBP, GIF ou SVG — até 3 MB."}</p>
    </div>
  );
}
