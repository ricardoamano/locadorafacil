"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CalendarPlus, Copy, RefreshCw, Ban } from "lucide-react";

// Integração INDIVIDUAL: as tarefas do usuário logado viram uma agenda no Google
export function IntegracaoTarefas() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/tarefas/integracao")
      .then((r) => r.json())
      .then((d) => setUrl(d.url || null))
      .catch(() => {});
  }, [open]);

  const urlCompleta = url
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${url}`
    : "";

  async function gerar() {
    setLoading(true);
    try {
      const res = await fetch("/api/tarefas/integracao", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error();
      setUrl(d.url);
      toast(
        url ? "Novo link gerado — o anterior parou de funcionar." : "Link criado!",
        "success"
      );
    } catch {
      toast("Erro ao gerar link.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function revogar() {
    setLoading(true);
    try {
      const res = await fetch("/api/tarefas/integracao", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setUrl(null);
      toast("Integração desativada.", "success");
    } catch {
      toast("Erro ao revogar.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
        Integrar com Google
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Minhas Tarefas no Google" size="lg">
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Este link é <strong>pessoal e individual</strong>: só as{" "}
              <strong>suas</strong> tarefas entram nele. Ao assinar no Google, elas
              aparecem como a agenda <strong>&quot;Tarefas — seu nome&quot;</strong>, com ☐
              pendentes (e ⚠ atrasadas) na data de entrega e ✅ concluídas — no
              computador e no celular, atualizando sozinhas.
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(urlCompleta);
                      toast("Link copiado!", "success");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copiar
                  </Button>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 space-y-1.5">
                  <p className="font-semibold text-slate-700">Como assinar no Google:</p>
                  <p>1. Abra calendar.google.com no computador</p>
                  <p>2. Menu lateral → <strong>+</strong> ao lado de &quot;Outras agendas&quot;</p>
                  <p>3. <strong>&quot;Inscrever-se usando URL&quot;</strong> → cole o link → confirmar ✅</p>
                  <p className="text-slate-400 pt-1">
                    Obs.: o app Google Tarefas não aceita assinatura por link — por isso
                    suas tarefas entram como uma agenda dedicada no Google Agenda, que
                    também aparece no celular.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={gerar} loading={loading}>
                    <RefreshCw className="h-4 w-4" />
                    Gerar novo link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={revogar}
                    disabled={loading}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Ban className="h-4 w-4" />
                    Desativar
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <Button onClick={gerar} loading={loading}>
                  <CalendarPlus className="h-4 w-4" />
                  Gerar meu link de tarefas
                </Button>
                <p className="text-xs text-slate-400 mt-2">
                  Cada usuário do sistema gera e gerencia o próprio link.
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
