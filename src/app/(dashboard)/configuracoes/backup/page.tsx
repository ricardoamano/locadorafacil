"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { DatabaseBackup, Download, Trash2, ShieldCheck } from "lucide-react";

// Backups da empresa: snapshot diário automático + geração manual + download

interface Snap {
  id: string;
  tamanho: number;
  automatico: boolean;
  criadoPor?: string | null;
  createdAt: string;
}

function fmtTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ConfigBackupPage() {
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<Snap[]>([]);
  const [gerando, setGerando] = useState(false);
  const [semAcesso, setSemAcesso] = useState(false);
  const [carregado, setCarregado] = useState(false);

  const carregar = useCallback(() => {
    fetch("/api/backup")
      .then((r) => {
        if (r.status === 401) {
          setSemAcesso(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (!d) return;
        setSnapshots(d.snapshots || []);
        setCarregado(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function gerar() {
    setGerando(true);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (!res.ok) throw new Error();
      toast("Backup gerado! Baixe o arquivo para guardar uma cópia fora do sistema.", "success");
      carregar();
    } catch {
      toast("Erro ao gerar backup.", "error");
    } finally {
      setGerando(false);
    }
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir este backup?")) return;
    try {
      const res = await fetch(`/api/backup/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      carregar();
    } catch {
      toast("Erro ao excluir.", "error");
    }
  }

  if (semAcesso) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-slate-500">Apenas administradores podem gerenciar backups.</p>
      </div>
    );
  }
  if (!carregado) return null;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
          <DatabaseBackup className="h-5 w-5 text-blue-700" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Backup dos Dados</h1>
          <p className="text-sm text-slate-500">
            Todo dia o sistema gera um backup automático da empresa (mantém os 14 mais
            recentes). Você também pode gerar e baixar quando quiser.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          O backup inclui todos os cadastros: clientes, itens, orçamentos, OS, financeiro,
          equipe etc. (imagens ficam de fora para o arquivo continuar leve). Senhas e o token
          do WhatsApp nunca entram no arquivo.{" "}
          <strong>Dica: baixe uma cópia por semana e guarde fora do sistema</strong> (Drive,
          computador) — é a sua garantia independente de qualquer fornecedor.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">
          Backups disponíveis ({snapshots.length})
        </p>
        <Button onClick={gerar} loading={gerando}>
          <DatabaseBackup className="h-4 w-4" />
          Gerar backup agora
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
        {snapshots.length === 0 && (
          <p className="px-5 py-6 text-sm text-slate-400 text-center">
            Nenhum backup ainda — o primeiro automático sai hoje à noite, ou clique em
            &quot;Gerar backup agora&quot;.
          </p>
        )}
        {snapshots.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">
                {new Date(s.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-xs text-slate-400">
                {fmtTamanho(s.tamanho)} ·{" "}
                {s.automatico ? "automático" : `manual${s.criadoPor ? ` · ${s.criadoPor}` : ""}`}
              </p>
            </div>
            <a
              href={`/api/backup/${s.id}`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar
            </a>
            <button
              onClick={() => excluir(s.id)}
              className="text-slate-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Estes backups protegem contra exclusões e alterações acidentais. Para proteção
        gerenciada contra falha total do banco, o plano Pro do Supabase (US$ 25/mês) adiciona
        backups diários do banco inteiro com restauração em um clique.
      </p>
    </div>
  );
}
