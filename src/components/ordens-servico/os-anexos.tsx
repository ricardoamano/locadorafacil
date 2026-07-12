"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Paperclip, Link2, Upload, Trash2, FileText, ExternalLink } from "lucide-react";

// Arquivos e links da OS — material de apoio para a equipe (briefings, PDFs,
// PPTs, vídeos, drives). Tudo aparece também no link público da OS.

interface Anexo {
  id: string;
  tipo: string;
  titulo: string;
  url: string;
  criadoPor?: string | null;
  createdAt: string;
}

export function OsAnexos({ osId }: { osId: string }) {
  const { toast } = useToast();
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitulo, setLinkTitulo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => {
    fetch(`/api/ordens-servico/${osId}/anexos`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAnexos(d.anexos || []))
      .catch(() => {});
  }, [osId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function uploadArquivo(file: File) {
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/ordens-servico/${osId}/anexos`, {
        method: "POST",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast("Arquivo anexado!", "success");
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro no upload.", "error");
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function adicionarLink() {
    if (!linkUrl.trim()) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/ordens-servico/${osId}/anexos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl, titulo: linkTitulo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast("Link adicionado!", "success");
      setLinkUrl("");
      setLinkTitulo("");
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao adicionar link.", "error");
    } finally {
      setEnviando(false);
    }
  }

  async function remover(anexoId: string) {
    if (!window.confirm("Remover este anexo da OS?")) return;
    try {
      const res = await fetch(`/api/ordens-servico/${osId}/anexos?anexoId=${anexoId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      carregar();
    } catch {
      toast("Erro ao remover.", "error");
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <Paperclip className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">Arquivos e Links</h3>
      </div>
      <p className="text-xs text-slate-400 mb-3">
        Briefings, PDFs, apresentações, vídeos e links dos clientes — a equipe vê tudo pelo
        link público da OS. Arquivos até 4 MB; maiores, cole o link (Drive, WeTransfer...).
      </p>

      {/* Lista */}
      {anexos.length > 0 && (
        <ul className="space-y-1.5 mb-4">
          {anexos.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 text-sm border-b border-slate-50 pb-1.5"
            >
              {a.tipo === "ARQUIVO" ? (
                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
              ) : (
                <Link2 className="h-4 w-4 text-slate-400 shrink-0" />
              )}
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate flex-1 inline-flex items-center gap-1"
              >
                {a.titulo}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              {a.criadoPor && (
                <span className="text-xs text-slate-400 hidden sm:inline">{a.criadoPor}</span>
              )}
              <button
                onClick={() => remover(a.id)}
                className="text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Adicionar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadArquivo(f);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            loading={enviando}
            className="w-full"
          >
            <Upload className="h-4 w-4" />
            Enviar arquivo
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
          />
          <Input
            value={linkTitulo}
            onChange={(e) => setLinkTitulo(e.target.value)}
            placeholder="Título (opcional)"
          />
          <Button variant="outline" size="sm" onClick={adicionarLink} disabled={!linkUrl.trim() || enviando}>
            <Link2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
