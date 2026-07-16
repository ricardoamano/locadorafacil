"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Camera, Plus, MapPin, Image as ImageIcon, MessageCircle } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function VisitasPage() {
  const { toast } = useToast();
  const [visitas, setVisitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaOpen, setNovaOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [localNome, setLocalNome] = useState("");
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/visitas");
      const d = await res.json();
      setVisitas(d.visitas || []);
    } catch {
      toast("Erro ao carregar visitas.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criar() {
    if (!titulo.trim()) {
      toast("Dê um título para a visita (ex.: Casamento Villa X).", "error");
      return;
    }
    setCriando(true);
    try {
      const res = await fetch("/api/visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, localNome }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      window.location.href = `/visitas/${d.id}`;
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao criar.", "error");
      setCriando(false);
    }
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Visitas Técnicas" }]} />
      <main className="pt-14 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Camera className="h-6 w-6 text-blue-600" />
              Visitas Técnicas
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Fotos, vídeos e anotações feitos em campo — compartilháveis por link.
            </p>
          </div>
          <Button onClick={() => setNovaOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova Visita
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : visitas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 gap-2 text-slate-400 border border-dashed border-slate-200 rounded-xl">
            <Camera className="h-10 w-10" />
            <p className="text-sm">Nenhuma visita ainda — crie a primeira.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visitas.map((v) => (
              <Link
                key={v.id}
                href={`/visitas/${v.id}`}
                className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:border-blue-200 transition-colors"
              >
                <p className="font-semibold text-slate-900 truncate">{v.titulo}</p>
                {v.localNome && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" /> {v.localNome}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" /> {v._count?.midias ?? 0} mídia(s)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> {v._count?.comentarios ?? 0}
                  </span>
                  <span className="ml-auto">
                    {v.data ? new Date(v.data).toLocaleDateString("pt-BR") : ""}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <Modal open={novaOpen} onClose={() => setNovaOpen(false)} title="Nova Visita Técnica" size="sm">
          <ModalBody>
            <div className="space-y-3">
              <Input
                label="Título *"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Visita técnica — Casamento Villa Blue"
                autoFocus
              />
              <Input
                label="Local (opcional)"
                value={localNome}
                onChange={(e) => setLocalNome(e.target.value)}
                placeholder="Ex.: Villa Blue Eventos, Salão A"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)} disabled={criando}>
              Cancelar
            </Button>
            <Button onClick={criar} loading={criando}>
              Criar e abrir
            </Button>
          </ModalFooter>
        </Modal>
      </main>
    </>
  );
}
