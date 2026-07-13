"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { CANAL_OPCOES, RESULTADO_OPCOES } from "@/lib/crm";
import { PhoneCall, MessageCircle, Clock, CheckCircle2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PRIORIDADE: Record<string, { label: string; variant: "danger" | "warning" | "neutral" }> = {
  ALTA: { label: "Alta", variant: "danger" },
  MEDIA: { label: "Média", variant: "warning" },
  BAIXA: { label: "Baixa", variant: "neutral" },
};

const RESULTADO_LABEL: Record<string, string> = Object.fromEntries(
  RESULTADO_OPCOES.map((o) => [o.value, o.label])
);

function waLink(telefone: string | null, texto: string): string | null {
  if (!telefone) return null;
  let t = telefone.replace(/\D/g, "");
  if (t.length <= 11) t = "55" + t;
  return `https://wa.me/${t}?text=${encodeURIComponent(texto)}`;
}

function dataCurta(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function CrmPage() {
  const { toast } = useToast();
  const [followups, setFollowups] = useState<any[]>([]);
  const [pendentes, setPendentes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [alvo, setAlvo] = useState<any | null>(null);
  const [form, setForm] = useState({ canal: "WHATSAPP", resultado: "SEM_RESPOSTA", observacao: "", proximaData: "" });
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm");
      const d = await res.json();
      setFollowups(d.followups || []);
      setPendentes(d.pendentes || 0);
    } catch {
      toast("Erro ao carregar o CRM.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirRegistro(f: any) {
    setForm({ canal: "WHATSAPP", resultado: "SEM_RESPOSTA", observacao: "", proximaData: "" });
    setAlvo(f);
  }

  async function registrar() {
    if (!alvo) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/${alvo.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.novoStatus === "APROVADO") toast("🎉 Orçamento marcado como aprovado!", "success");
      else if (d.novoStatus === "REPROVADO") toast("Orçamento marcado como perdido.", "success");
      else toast("Contato registrado. Próximo follow-up agendado.", "success");
      setAlvo(null);
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao registrar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "CRM / Follow-up" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="h-6 w-6 text-blue-600" />
              CRM / Follow-up
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Cobre feedback dos orçamentos ainda não aprovados. A rotina prioriza os
              atrasados e os eventos que estão chegando.
            </p>
          </div>
          {pendentes > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {pendentes} follow-up{pendentes > 1 ? "s" : ""} vencido{pendentes > 1 ? "s" : ""}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : followups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm">Nenhum orçamento em aberto — tudo em dia! 🎉</p>
            </div>
          ) : (
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Prioridade", "Orçamento", "Cliente", "Valor", "Evento", "Próximo contato", "Último retorno", "Ações"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                          i === 7 ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {followups.map((f) => {
                  const prio = PRIORIDADE[f.prioridade] || PRIORIDADE.BAIXA;
                  const wa = waLink(
                    f.contatoTelefone,
                    `Olá${f.contatoNome ? ` ${f.contatoNome}` : ""}! Tudo bem? Passando para saber se conseguiu avaliar nossa proposta${
                      f.eventoNome ? ` para o evento "${f.eventoNome}"` : ""
                    }. Fico à disposição!`
                  );
                  return (
                    <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <Badge variant={prio.variant}>{prio.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">
                          #{f.numero}
                          {f.projetoEspecial && (
                            <span className="ml-1 text-[10px] text-violet-600">projeto</span>
                          )}
                        </p>
                        {f.eventoNome && (
                          <p className="text-xs text-slate-400 truncate max-w-48">{f.eventoNome}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {f.cliente?.nomeFantasia || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(f.total)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {f.dataEvento ? (
                          <span
                            className={
                              f.diasParaEvento !== null && f.diasParaEvento >= 0 && f.diasParaEvento <= 7
                                ? "text-red-600 font-medium"
                                : ""
                            }
                          >
                            {dataCurta(f.dataEvento)}
                            {f.diasParaEvento !== null && f.diasParaEvento >= 0 && (
                              <span className="block text-xs">
                                em {f.diasParaEvento} dia{f.diasParaEvento !== 1 ? "s" : ""}
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={f.vencido ? "text-red-600 font-medium" : "text-slate-500"}>
                          {dataCurta(f.proximaData)}
                          {f.vencido && <span className="block text-xs">vencido</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {f.ultimoContato ? (
                          <>
                            <span>{dataCurta(f.ultimoContato)}</span>
                            {f.ultimoResultado && (
                              <span className="block text-slate-400">
                                {RESULTADO_LABEL[f.ultimoResultado] || f.ultimoResultado}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-300">sem contato</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir WhatsApp"
                              className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          )}
                          <Button size="sm" variant="outline" onClick={() => abrirRegistro(f)}>
                            Registrar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Modal
          open={!!alvo}
          onClose={() => !saving && setAlvo(null)}
          title={alvo ? `Registrar contato — orçamento #${alvo.numero}` : ""}
          size="md"
        >
          <ModalBody>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Canal"
                  value={form.canal}
                  onChange={(e) => setForm((p) => ({ ...p, canal: e.target.value }))}
                  options={CANAL_OPCOES}
                />
                <Select
                  label="Resultado"
                  value={form.resultado}
                  onChange={(e) => setForm((p) => ({ ...p, resultado: e.target.value }))}
                  options={RESULTADO_OPCOES}
                />
              </div>
              <Textarea
                label="Observação"
                value={form.observacao}
                onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))}
                placeholder="O que o cliente respondeu..."
                rows={3}
              />
              {!["GANHOU", "PERDEU"].includes(form.resultado) && (
                <Input
                  label="Próximo follow-up (opcional)"
                  type="date"
                  value={form.proximaData}
                  onChange={(e) => setForm((p) => ({ ...p, proximaData: e.target.value }))}
                />
              )}
              {["GANHOU", "PERDEU"].includes(form.resultado) && (
                <p className="text-xs text-slate-500">
                  {form.resultado === "GANHOU"
                    ? "O orçamento será marcado como aprovado."
                    : "O orçamento será marcado como perdido (reprovado)."}
                </p>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setAlvo(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={registrar} loading={saving}>
              Salvar contato
            </Button>
          </ModalFooter>
        </Modal>
      </main>
    </>
  );
}
