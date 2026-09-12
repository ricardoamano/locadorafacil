"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Database, Search } from "lucide-react";

// Migração do Bubble via Data API: guarda URL + Private key (só superadmin) e
// lê a estrutura do app antigo (tipos, campos, amostras) para montar a
// importação de orçamentos/faturas com os vínculos preservados.

interface TipoInfo {
  nome: string;
  total: number;
  campos: string[];
}

export default function ConfigBubblePage() {
  const { toast } = useToast();
  const [appUrl, setAppUrl] = useState("");
  const [token, setToken] = useState("");
  const [tokenConfigurado, setTokenConfigurado] = useState(false);
  const [tipos, setTipos] = useState<TipoInfo[] | null>(null);
  const [lidoEm, setLidoEm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [semAcesso, setSemAcesso] = useState(false);

  useEffect(() => {
    fetch("/api/import/bubble")
      .then((r) => {
        if (r.status === 403 || r.status === 401) {
          setSemAcesso(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (!d) return;
        setAppUrl(d.appUrl || "");
        setTokenConfigurado(!!d.tokenConfigurado);
        if (d.meta?.tipos) {
          setLidoEm(d.meta.lidoEm || null);
          setTipos(
            Object.entries(d.meta.tipos as Record<string, { total: number; campos: { id: string; type: string }[] }>).map(
              ([nome, m]) => ({
                nome,
                total: m.total,
                campos: (m.campos || []).map((f) => `${f.id} (${f.type})`),
              })
            )
          );
        }
      })
      .catch(() => {});
  }, []);

  async function enviar(acao: "salvar" | "descobrir") {
    setSalvando(true);
    try {
      const res = await fetch("/api/import/bubble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appUrl, token: token || undefined, acao }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToken("");
      setTokenConfigurado(true);
      if (acao === "descobrir") {
        setTipos(d.tipos);
        setLidoEm(new Date().toISOString());
        toast(`Estrutura lida: ${d.tipos.length} tipos encontrados. ✅`, "success");
      } else toast("Conexão salva.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro.", "error");
    } finally {
      setSalvando(false);
    }
  }

  if (semAcesso)
    return <p className="text-sm text-slate-500">Apenas o superadmin configura a migração do Bubble.</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center">
          <Database className="h-5 w-5 text-sky-700" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Migração do Bubble (Data API)</h1>
          <p className="text-xs text-slate-500">
            Conexão direta com o app antigo para importar orçamentos e faturas com os vínculos
            (cliente, local, itens) preservados.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
        <Input
          label="URL do app no Bubble"
          value={appUrl}
          onChange={(e) => setAppUrl(e.target.value)}
          placeholder="https://seuapp.bubbleapps.io  (ou o domínio próprio)"
        />
        <Input
          label={tokenConfigurado ? "Private key (já configurada — preencha só para trocar)" : "Private key (Settings → API)"}
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={tokenConfigurado ? "••••••••••••" : "Cole a chave"}
        />
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">No editor do Bubble:</p>
          <p>1. <strong>Settings → API</strong> → marque <strong>Enable Data API</strong>.</p>
          <p>
            2. Na lista de tipos, marque os que vamos ler: Orçamento, itens do orçamento (e salas, se
            houver), Fatura, Cliente, Contato, Local, Item/Equipamento.
          </p>
          <p>3. Em <strong>Private key</strong>, clique em <em>Generate a new API token</em> e cole acima.</p>
          <p>4. Use a URL da versão <strong>live</strong> (sem /version-test) para pegar os dados reais.</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={() => enviar("salvar")} loading={salvando}>
            Salvar
          </Button>
          <Button onClick={() => enviar("descobrir")} loading={salvando}>
            <Search className="h-4 w-4" />
            Testar e ler a estrutura
          </Button>
        </div>
      </div>

      {tipos && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Estrutura encontrada ({tipos.length} tipos)
            </h2>
            {lidoEm && (
              <p className="text-xs text-slate-400">
                Lida em {new Date(lidoEm).toLocaleString("pt-BR")} — é com isso que a importação
                de orçamentos/faturas é montada.
              </p>
            )}
          </div>
          <div className="space-y-2">
            {tipos.map((t) => (
              <details key={t.nome} className="rounded-lg border border-slate-100 p-3">
                <summary className="cursor-pointer text-sm text-slate-800">
                  <span className="font-medium">{t.nome}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {t.total >= 0 ? `${t.total} registros` : "sem acesso"} · {t.campos.length} campos
                  </span>
                </summary>
                <p className="mt-2 text-[11px] text-slate-500 break-words">{t.campos.join(" · ")}</p>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
