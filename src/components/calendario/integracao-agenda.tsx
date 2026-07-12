"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CalendarPlus, Copy, RefreshCw, Ban } from "lucide-react";

// Integração da agenda da empresa com Google Agenda / Outlook / Apple (feed iCal)
export function IntegracaoAgenda() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/calendario/integracao")
      .then((r) => r.json())
      .then((d) => setUrl(d.url || null))
      .catch(() => {});
  }, [open]);

  const urlCompleta = url ? `${typeof window !== "undefined" ? window.location.origin : ""}${url}` : "";

  async function gerar() {
    setLoading(true);
    try {
      const res = await fetch("/api/calendario/integracao", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Apenas administradores podem gerar o link.", "error");
        return;
      }
      setUrl(d.url);
      toast(url ? "Novo link gerado — o anterior parou de funcionar." : "Link de agenda criado!", "success");
    } catch {
      toast("Erro ao gerar link.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function revogar() {
    setLoading(true);
    try {
      const res = await fetch("/api/calendario/integracao", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setUrl(null);
      toast("Integração desativada — o link deixou de funcionar.", "success");
    } catch {
      toast("Erro ao revogar.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(urlCompleta);
    toast("Link copiado!", "success");
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
        Integrar com Google Agenda
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Integração com Google Agenda" size="lg">
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Cada empresa tem seu <strong>link privado de agenda</strong>. Ao assinar
              esse link no Google Agenda, os eventos (aprovados e pendentes) e as datas
              de montagem da <strong>sua empresa</strong> aparecem automaticamente lá — e
              se atualizam sozinhos quando os orçamentos mudam aqui.
            </p>

            {url ? (
              <>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={urlCompleta}
                    className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-600 focus:outline-none"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button variant="outline" size="sm" onClick={copiar}>
                    <Copy className="h-4 w-4" />
                    Copiar
                  </Button>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 space-y-1.5">
                  <p className="font-semibold text-slate-700">Como assinar no Google Agenda:</p>
                  <p>1. Abra o Google Agenda no computador (calendar.google.com)</p>
                  <p>2. No menu lateral, clique no <strong>+</strong> ao lado de &quot;Outras agendas&quot;</p>
                  <p>3. Escolha <strong>&quot;Inscrever-se usando URL&quot;</strong> (ou &quot;Por URL&quot;)</p>
                  <p>4. Cole o link acima e confirme — pronto! ✅</p>
                  <p className="text-slate-400 pt-1">
                    Também funciona no Outlook e no Calendário da Apple. O Google atualiza
                    o feed automaticamente (a cada algumas horas).
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={gerar} loading={loading}>
                    <RefreshCw className="h-4 w-4" />
                    Gerar novo link (invalida o atual)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={revogar}
                    disabled={loading}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Ban className="h-4 w-4" />
                    Desativar integração
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <Button onClick={gerar} loading={loading}>
                  <CalendarPlus className="h-4 w-4" />
                  Gerar link de integração
                </Button>
                <p className="text-xs text-slate-400 mt-2">
                  Somente administradores podem gerar ou revogar o link da empresa.
                </p>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
