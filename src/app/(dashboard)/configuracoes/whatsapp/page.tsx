"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Bot, Send } from "lucide-react";

// Configuração do NESTOR — assistente de WhatsApp da empresa

export default function ConfigWhatsappPage() {
  const { toast } = useToast();
  const [numero, setNumero] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [token, setToken] = useState("");
  const [tokenConfigurado, setTokenConfigurado] = useState(false);
  const [configurado, setConfigurado] = useState(false);
  const [testarPara, setTestarPara] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/empresa/whatsapp")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setNumero(d.numero || "");
        setPhoneId(d.phoneId || "");
        setTokenConfigurado(d.tokenConfigurado);
        setConfigurado(d.configurado);
      })
      .catch(() => {});
  }, []);

  async function salvar(comTeste: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/empresa/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero,
          phoneId,
          token: token || undefined,
          testarPara: comTeste ? testarPara : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(
        comTeste ? "Configuração salva e mensagem de teste enviada! ✅" : "Configuração salva!",
        "success"
      );
      setToken("");
      const st = await fetch("/api/empresa/whatsapp").then((r) => r.json());
      setTokenConfigurado(st.tokenConfigurado);
      setConfigurado(st.configurado);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <Bot className="h-5 w-5 text-emerald-700" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">NESTOR — WhatsApp da empresa</h1>
          <p className="text-sm text-slate-500">
            O assistente que envia OS, alterações e lembretes à equipe escalada.
          </p>
        </div>
      </div>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          configurado
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        {configurado
          ? "✅ Envio automático ativo: o NESTOR manda as mensagens direto no WhatsApp da equipe, incluindo os lembretes diários automáticos."
          : "⚠️ Sem credenciais, o NESTOR funciona em modo manual: prepara as mensagens e abre o WhatsApp para você enviar com um clique. Configure abaixo para ativar o envio 100% automático."}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
        <Input
          label="Número do WhatsApp (exibição)"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="+55 11 99999-9999"
        />
        <Input
          label="Phone Number ID (WhatsApp Business Cloud API)"
          value={phoneId}
          onChange={(e) => setPhoneId(e.target.value)}
          placeholder="Ex: 106540352242922"
        />
        <Input
          label={tokenConfigurado ? "Token de acesso (já configurado — preencha só para trocar)" : "Token de acesso permanente"}
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={tokenConfigurado ? "••••••••••••" : "EAAG..."}
        />

        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">Onde pegar essas credenciais:</p>
          <p>1. Acesse developers.facebook.com → seu app → WhatsApp → Configuração da API</p>
          <p>2. Copie o <strong>Phone Number ID</strong> do número cadastrado (o NESTOR)</p>
          <p>3. Gere um <strong>token permanente</strong> em Configurações do app → Usuários do sistema</p>
          <p className="pt-1">
            Cada empresa usa o próprio número — o sistema é multiempresa.
          </p>
        </div>

        <div className="border-t border-slate-100 pt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <Input
              label="Enviar teste para (opcional)"
              value={testarPara}
              onChange={(e) => setTestarPara(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => salvar(true)}
            loading={saving}
            disabled={!testarPara}
          >
            <Send className="h-4 w-4" />
            Salvar e testar
          </Button>
          <Button onClick={() => salvar(false)} loading={saving}>
            Salvar
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 text-sm text-slate-600 space-y-2">
        <h2 className="font-semibold text-slate-900">O que o NESTOR faz</h2>
        <ul className="list-disc pl-5 space-y-1 text-slate-500">
          <li>📋 Envia a OS completa (evento, datas, horários, local, função) aos escalados</li>
          <li>⚠️ Avisa a equipe quando a OS é alterada</li>
          <li>🔔 Lembrete automático todo dia às 9h para eventos do dia seguinte</li>
          <li>💬 Recados personalizados para os membros selecionados</li>
          <li>🔒 Nunca inclui valores financeiros nas mensagens</li>
        </ul>
      </div>
    </div>
  );
}
