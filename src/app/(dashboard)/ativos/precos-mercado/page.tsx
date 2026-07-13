"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { FileUp, Trash2, Search, Database, ClipboardPaste, Sparkles } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Banco de Preços de Mercado: suba orçamentos de concorrentes e parceiros
// (PDF, planilha, DOCX, texto) ou cole o texto — a IA extrai os preços e
// alimenta as sugestões do sistema.

export default function PrecosMercadoPage() {
  const { toast } = useToast();
  const [registros, setRegistros] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [colarAberto, setColarAberto] = useState(false);
  const [textoColado, setTextoColado] = useState("");
  const [nomeColado, setNomeColado] = useState("");
  const [fonteColada, setFonteColada] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // Entrada rápida: escreva os preços à mão e a IA estrutura e sobe no banco
  const [textoRapido, setTextoRapido] = useState("");

  // Orientações por IA (manutenção do banco: limpar antigos, reajustar...)
  const [comando, setComando] = useState("");
  const [iaPensando, setIaPensando] = useState(false);
  const [iaAplicando, setIaAplicando] = useState(false);
  const [plano, setPlano] = useState<{
    resposta: string;
    acoes: any[];
    totalAfetados: number;
  } | null>(null);

  const carregar = useCallback(
    (q?: string) => {
      fetch(`/api/precos-mercado?busca=${encodeURIComponent(q ?? busca)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setRegistros(d.registros || []))
        .catch(() => {});
    },
    [busca]
  );

  useEffect(() => {
    carregar("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => carregar(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  async function importar(body: FormData | { texto: string; nome?: string; fonte?: string }) {
    setEnviando(true);
    try {
      const res = await fetch("/api/precos-mercado", {
        method: "POST",
        ...(body instanceof FormData
          ? { body }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(
        d.parcial
          ? `⚠️ ${d.importados} preço(s) importado(s) de "${d.fonte}" — o documento era grande e a leitura foi parcial; revise se faltou algum item.`
          : `✅ ${d.importados} preço(s) importado(s) de "${d.fonte}"!`,
        "success"
      );
      setColarAberto(false);
      setTextoColado("");
      setNomeColado("");
      setFonteColada("");
      setTextoRapido("");
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro na importação.", "error");
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function enviarArquivo(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    importar(fd);
  }

  async function excluir(id: string) {
    await fetch(`/api/precos-mercado?id=${id}`, { method: "DELETE" });
    carregar();
  }

  async function pedirPlano() {
    setIaPensando(true);
    setPlano(null);
    try {
      const res = await fetch("/api/precos-mercado/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comando }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPlano(d);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro na IA.", "error");
    } finally {
      setIaPensando(false);
    }
  }

  async function aplicarPlano() {
    if (!plano?.acoes?.length) return;
    setIaAplicando(true);
    try {
      const res = await fetch("/api/precos-mercado/ia?etapa=executar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acoes: plano.acoes }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(`✅ Pronto — ${d.afetados} registro(s) afetado(s).`, "success");
      setPlano(null);
      setComando("");
      carregar();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao aplicar.", "error");
    } finally {
      setIaAplicando(false);
    }
  }

  function descreveAcao(a: any) {
    const filtros = [
      a.filtro?.fonte && `fonte contém "${a.filtro.fonte}"`,
      a.filtro?.equipamento && `equipamento contém "${a.filtro.equipamento}"`,
      a.filtro?.marca && `marca contém "${a.filtro.marca}"`,
      a.filtro?.documento && `documento contém "${a.filtro.documento}"`,
      a.filtro?.antesDe &&
        `importados antes de ${new Date(a.filtro.antesDe).toLocaleDateString("pt-BR")}`,
      a.filtro?.depoisDe &&
        `importados depois de ${new Date(a.filtro.depoisDe).toLocaleDateString("pt-BR")}`,
    ].filter(Boolean);
    const alvo = filtros.length ? filtros.join(", ") : "TODOS os registros";
    return a.tipo === "deletar"
      ? `Excluir ${a.afetados} registro(s) — ${alvo}`
      : `Reajustar ${a.afetados} registro(s) em ${a.percentual > 0 ? "+" : ""}${a.percentual}% (${(a.campos || []).join(", ")}) — ${alvo}`;
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Ativos" }, { label: "Banco de Preços" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="h-6 w-6 text-violet-600" />
              Banco de Preços de Mercado
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Suba orçamentos de concorrentes e parceiros (PDF, planilha XLSX/CSV, DOCX,
              TXT/MD) ou cole o texto — a IA extrai os preços, guarda a empresa de origem
              e alimenta as sugestões de preço e o chat de Ajuda.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.docx,.txt,.md,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviarArquivo(f);
              }}
            />
            <Button
              variant="outline"
              onClick={() => setColarAberto(true)}
              disabled={enviando}
            >
              <ClipboardPaste className="h-4 w-4" />
              Colar texto
            </Button>
            <Button onClick={() => fileRef.current?.click()} loading={enviando}>
              <FileUp className="h-4 w-4" />
              {enviando ? "Analisando documento..." : "Importar arquivo"}
            </Button>
          </div>
        </div>

        {/* Entrada rápida — escreva e a IA analisa e sobe no banco */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-4">
          <p className="text-sm font-semibold text-slate-900 mb-1">
            ✍️ Anotar preços rapidamente
          </p>
          <p className="text-xs text-slate-400 mb-2">
            Escreva do seu jeito — a IA identifica equipamento, empresa e valores e sobe
            no banco. Ex.: &quot;Mega Eventos cobra R$ 350 a diária do moving beam 230,
            semana 900. Reposição 8 mil.&quot;
          </p>
          <div className="flex gap-2 items-end">
            <Textarea
              value={textoRapido}
              onChange={(e) => setTextoRapido(e.target.value)}
              rows={2}
              placeholder="Escreva os preços que você ouviu/recebeu... (Enter envia, Shift+Enter quebra linha)"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (textoRapido.trim())
                    importar({ texto: textoRapido, nome: "Anotação rápida" });
                }
              }}
            />
            <Button
              loading={enviando}
              disabled={!textoRapido.trim()}
              onClick={() => importar({ texto: textoRapido, nome: "Anotação rápida" })}
            >
              Analisar e subir
            </Button>
          </div>
        </div>

        <Modal
          open={colarAberto}
          onClose={() => !enviando && setColarAberto(false)}
          title="Colar texto do orçamento"
          size="2xl"
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              Cole abaixo o conteúdo do orçamento ou tabela de preços (texto simples ou
              Markdown) — a IA identifica os equipamentos, valores e a empresa de origem.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Empresa fonte (opcional)"
                value={fonteColada}
                onChange={(e) => setFonteColada(e.target.value)}
                placeholder="Se o texto não traz o nome da empresa"
              />
              <Input
                label="Identificação do documento (opcional)"
                value={nomeColado}
                onChange={(e) => setNomeColado(e.target.value)}
                placeholder='Ex.: "Orçamento Mega Eventos jun/2026"'
              />
            </div>
            <Textarea
              label="Texto do orçamento"
              value={textoColado}
              onChange={(e) => setTextoColado(e.target.value)}
              placeholder="Cole aqui o texto ou .md do orçamento..."
              className="min-h-[260px] font-mono text-xs"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setColarAberto(false)}
                disabled={enviando}
              >
                Cancelar
              </Button>
              <Button
                loading={enviando}
                disabled={!textoColado.trim()}
                onClick={() =>
                  importar({
                    texto: textoColado,
                    nome: nomeColado.trim() || undefined,
                    fonte: fonteColada.trim() || undefined,
                  })
                }
              >
                {enviando ? "Analisando texto..." : "Importar preços"}
              </Button>
            </div>
          </div>
        </Modal>

        <div className="bg-violet-50/60 border border-violet-100 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-violet-800 flex items-center gap-1.5 mb-2">
            <Sparkles className="h-4 w-4" />
            Manutenção do banco com IA
          </p>
          <div className="flex gap-2 flex-wrap">
            <Input
              value={comando}
              onChange={(e) => setComando(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && comando.trim() && !iaPensando) pedirPlano();
              }}
              placeholder='Ex.: "apague os preços da empresa X", "exclua o que foi importado há mais de 1 ano", "reajuste as diárias de moving em 10%"'
              className="flex-1 min-w-[260px] bg-white"
              disabled={iaPensando || iaAplicando}
            />
            <Button
              onClick={pedirPlano}
              loading={iaPensando}
              disabled={!comando.trim() || iaAplicando}
            >
              {iaPensando ? "Interpretando..." : "Analisar"}
            </Button>
          </div>
          <p className="text-xs text-violet-500 mt-1.5">
            Nada é alterado sem a sua confirmação — a IA mostra o plano e quantos
            registros serão afetados antes de aplicar.
          </p>
          {plano && (
            <div className="mt-3 bg-white rounded-lg border border-violet-100 p-3">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{plano.resposta}</p>
              {plano.acoes.length > 0 && (
                <>
                  <ul className="mt-2 space-y-1">
                    {plano.acoes.map((a, i) => (
                      <li key={i} className="text-sm text-slate-600 flex items-start gap-1.5">
                        <span
                          className={
                            a.tipo === "deletar" ? "text-red-500" : "text-amber-600"
                          }
                        >
                          {a.tipo === "deletar" ? "🗑" : "✎"}
                        </span>
                        {descreveAcao(a)}
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end gap-2 mt-3">
                    <Button
                      variant="outline"
                      onClick={() => setPlano(null)}
                      disabled={iaAplicando}
                    >
                      Cancelar
                    </Button>
                    <Button
                      loading={iaAplicando}
                      onClick={aplicarPlano}
                      variant={plano.acoes.some((a) => a.tipo === "deletar") ? "destructive" : "default"}
                    >
                      {iaAplicando
                        ? "Aplicando..."
                        : `Confirmar (${plano.totalAfetados} registro(s))`}
                    </Button>
                  </div>
                </>
              )}
              {plano.acoes.length === 0 && (
                <div className="flex justify-end mt-2">
                  <Button variant="outline" onClick={() => setPlano(null)}>
                    Fechar
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar equipamento, modelo, marca ou empresa..."
            className="pl-9"
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          {registros.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
              <Database className="h-8 w-8" />
              <p className="text-sm">
                {busca
                  ? "Nada encontrado"
                  : "Nenhum preço no banco ainda — importe um orçamento (arquivo ou texto colado)."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3">Equipamento</th>
                  <th className="px-4 py-3">Marca / Modelo</th>
                  <th className="px-4 py-3">Empresa (fonte)</th>
                  <th className="px-4 py-3 text-right">Diária</th>
                  <th className="px-4 py-3 text-right">Semana</th>
                  <th className="px-4 py-3 text-right">Mês</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Importado em</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.equipamento}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {[r.marca, r.modelo].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-violet-50 text-violet-700 text-xs font-medium px-2 py-0.5">
                        {r.fonte || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {r.diaria != null ? formatCurrency(r.diaria) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {r.semana != null ? formatCurrency(r.semana) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {r.mes != null ? formatCurrency(r.mes) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[140px] truncate">
                      {r.documento || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => excluir(r.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          {registros.length} registro(s) · valores unitários por diária · a pesquisa de
          mercado do cadastro de itens consulta este banco primeiro
        </p>
      </main>
    </>
  );
}
