"use client";

import { FechamentoMensal } from "@/components/postos/fechamento-mensal";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Wrench, Pencil, Sparkles, FileUp } from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  PENDENTE: { label: "Pendente", variant: "warning" },
  AGUARDANDO: { label: "Aguardando", variant: "info" },
  APROVADO: { label: "Aprovado", variant: "success" },
  REPROVADO: { label: "Reprovado", variant: "danger" },
  CANCELADO: { label: "Cancelado", variant: "neutral" },
};

interface Orcamento {
  id: string;
  numero: number;
  status: string;
  eventoNome: string | null;
  dataInicio: string | null;
  total: number;
  cliente: { id: string; nomeFantasia: string };
  local: { id: string; nome: string } | null;
}

// Resultado da análise da OS do posto pela IA (rota importar-os).
interface ItemAnalisado {
  descricao: string;
  natureza: string;
  quantidade: number;
  diarias: number;
  valorUnitario: number | null;
  itemId: string | null;
  itemNome: string | null;
  valorCatalogo: number | null;
}
interface Analise {
  documento: string;
  dados: {
    posto?: string | null;
    numeroOsExterna?: string | null;
    eventoNome?: string | null;
    tipoEvento?: string | null;
    localNome?: string | null;
    dataMontagem?: string | null;
    dataInicio?: string | null;
    dataFim?: string | null;
    observacoes?: string | null;
  };
  salas: { nome: string; itens: ItemAnalisado[] }[];
  clienteSugeridoId: string | null;
  localSugeridoId: string | null;
  postos: { id: string; nomeFantasia: string }[];
  parcial: boolean;
}

function fmtData(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const temHora = d.getHours() + d.getMinutes() > 0;
  return (
    d.toLocaleDateString("pt-BR") +
    (temHora ? ` ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "")
  );
}

export default function PostosServicoPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);

  // Importação de OS do posto com IA
  const [importAberto, setImportAberto] = useState(false);
  const [textoColado, setTextoColado] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [clienteId, setClienteId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orcamentos?postos=1&limit=100");
      const data = await res.json();
      setOrcamentos(data.orcamentos || []);
    } catch {
      toast("Erro ao carregar dados.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function fecharImport() {
    if (analisando || criando) return;
    setImportAberto(false);
    setAnalise(null);
    setTextoColado("");
    setClienteId("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function analisar(entrada: File | string) {
    setAnalisando(true);
    try {
      let res: Response;
      if (typeof entrada === "string") {
        res = await fetch("/api/postos-servico/importar-os", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: entrada, nome: "texto colado" }),
        });
      } else {
        const fd = new FormData();
        fd.append("file", entrada);
        res = await fetch("/api/postos-servico/importar-os", { method: "POST", body: fd });
      }
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAnalise(d);
      setClienteId(d.clienteSugeridoId || "");
      if (d.parcial)
        toast("O documento era grande e a leitura foi parcial — revise os itens.", "error");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro na análise.", "error");
    } finally {
      setAnalisando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function criarOrcamento() {
    if (!analise) return;
    setCriando(true);
    try {
      const salas = analise.salas.map((s) => ({
        nome: s.nome,
        itens: s.itens.map((i) => ({
          ...i,
          valorUnitario: i.valorUnitario ?? i.valorCatalogo ?? 0,
        })),
      }));
      const res = await fetch("/api/postos-servico/importar-os?etapa=criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documento: analise.documento,
          dados: analise.dados,
          clienteId: clienteId || null,
          novoPostoNome: clienteId ? null : analise.dados.posto || null,
          localId: analise.localSugeridoId,
          salas,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(
        `✅ Orçamento #${d.numero} criado!${
          d.itensCriados?.length
            ? ` ${d.itensCriados.length} item(ns) novo(s) cadastrado(s) no catálogo.`
            : ""
        }`,
        "success"
      );
      fecharImport();
      router.push(`/orcamentos/${d.orcamentoId}`);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao criar o orçamento.", "error");
      setCriando(false);
    }
  }

  const totalPrevisto = analise
    ? analise.salas.reduce(
        (acc, s) =>
          acc +
          s.itens.reduce(
            (a, i) => a + i.quantidade * i.diarias * (i.valorUnitario ?? i.valorCatalogo ?? 0),
            0
          ),
        0
      )
    : 0;

  return (
    <>
      <Header breadcrumbs={[{ label: "Postos de Serviço" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Postos de Serviço</h1>
            <p className="text-sm text-slate-500 mt-1">
              Eventos e orçamentos de clientes marcados como posto de serviço oficial
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <FechamentoMensal onFaturado={fetchData} />
            <Button variant="outline" onClick={() => setImportAberto(true)}>
              <Sparkles className="h-4 w-4 text-violet-600" />
              Importar OS do posto
            </Button>
            <Link href="/orcamentos/novo">
              <Button>
                <Plus className="h-4 w-4" />
                Novo Evento de Posto
              </Button>
            </Link>
          </div>
        </div>

        <Modal
          open={importAberto}
          onClose={fecharImport}
          title={analise ? "Revisar OS interpretada" : "Importar OS do posto com IA"}
          size="2xl"
        >
          {!analise ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-500">
                Anexe a OS enviada pelo posto de serviço (PDF, planilha XLSX/CSV, DOCX,
                TXT/MD) ou cole o texto dela. A IA interpreta as informações do evento e
                dos itens pedidos, guarda o padrão da OS do posto e monta um orçamento.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.docx,.txt,.md,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) analisar(f);
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                loading={analisando}
                className="w-full"
              >
                <FileUp className="h-4 w-4" />
                {analisando ? "Analisando OS..." : "Anexar arquivo da OS"}
              </Button>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="h-px bg-slate-100 flex-1" />
                ou cole o texto
                <div className="h-px bg-slate-100 flex-1" />
              </div>
              <Textarea
                value={textoColado}
                onChange={(e) => setTextoColado(e.target.value)}
                placeholder="Cole aqui o conteúdo da OS do posto..."
                className="min-h-[180px] font-mono text-xs"
                disabled={analisando}
              />
              <div className="flex justify-end">
                <Button
                  loading={analisando}
                  disabled={!textoColado.trim()}
                  onClick={() => analisar(textoColado)}
                >
                  <Sparkles className="h-4 w-4" />
                  {analisando ? "Analisando OS..." : "Analisar com IA"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm bg-slate-50 rounded-lg p-3">
                <p className="col-span-2">
                  <span className="text-slate-400">Evento:</span>{" "}
                  <span className="font-medium text-slate-800">
                    {analise.dados.eventoNome || "—"}
                  </span>
                  {analise.dados.tipoEvento ? (
                    <span className="text-slate-500"> · {analise.dados.tipoEvento}</span>
                  ) : null}
                </p>
                <p>
                  <span className="text-slate-400">Montagem:</span>{" "}
                  {fmtData(analise.dados.dataMontagem)}
                </p>
                <p>
                  <span className="text-slate-400">Evento:</span>{" "}
                  {fmtData(analise.dados.dataInicio)}
                  {analise.dados.dataFim ? ` → ${fmtData(analise.dados.dataFim)}` : ""}
                </p>
                <p className="col-span-2">
                  <span className="text-slate-400">Local:</span>{" "}
                  {analise.dados.localNome || "—"}
                </p>
                {analise.dados.numeroOsExterna ? (
                  <p className="col-span-2">
                    <span className="text-slate-400">OS do posto:</span>{" "}
                    {analise.dados.numeroOsExterna}
                  </p>
                ) : null}
              </div>

              <div>
                <Select
                  label="Posto de serviço (cliente)"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  options={analise.postos.map((p) => ({ value: p.id, label: p.nomeFantasia }))}
                  placeholder={
                    analise.dados.posto
                      ? `Cadastrar "${analise.dados.posto}" como novo posto`
                      : "Selecione o posto"
                  }
                  searchable
                  clearable
                />
                {!clienteId && analise.dados.posto ? (
                  <p className="text-xs text-amber-600 mt-1">
                    Sem posto selecionado, &quot;{analise.dados.posto}&quot; será cadastrado
                    como novo cliente Posto de Serviço.
                  </p>
                ) : null}
              </div>

              <div className="border border-slate-100 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                        <th className="px-3 py-2">Item pedido</th>
                        <th className="px-3 py-2 text-center">Qtd</th>
                        <th className="px-3 py-2 text-center">Diárias</th>
                        <th className="px-3 py-2 text-right">Unit.</th>
                        <th className="px-3 py-2">Catálogo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analise.salas.map((s, si) => (
                        <React.Fragment key={si}>
                          {analise.salas.length > 1 && (
                            <tr className="bg-violet-50/60">
                              <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold text-violet-700">
                                {s.nome}
                              </td>
                            </tr>
                          )}
                          {s.itens.map((i, ii) => (
                            <tr key={ii} className="border-t border-slate-50">
                              <td className="px-3 py-2 text-slate-800">{i.descricao}</td>
                              <td className="px-3 py-2 text-center">{i.quantidade}</td>
                              <td className="px-3 py-2 text-center">{i.diarias}</td>
                              <td className="px-3 py-2 text-right">
                                {formatCurrency(i.valorUnitario ?? i.valorCatalogo ?? 0)}
                              </td>
                              <td className="px-3 py-2">
                                {i.itemId ? (
                                  <Badge variant="success">{i.itemNome}</Badge>
                                ) : (
                                  <Badge variant="warning">novo item</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-slate-400 -mt-2">
                Itens marcados como &quot;novo item&quot; serão cadastrados no catálogo.
                Total previsto: <strong>{formatCurrency(totalPrevisto)}</strong> — dá para
                ajustar tudo depois no editor do orçamento.
              </p>

              <div className="flex justify-between gap-2">
                <Button variant="ghost" onClick={() => setAnalise(null)} disabled={criando}>
                  ← Analisar outra OS
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={fecharImport} disabled={criando}>
                    Cancelar
                  </Button>
                  <Button loading={criando} onClick={criarOrcamento}>
                    {criando ? "Criando orçamento..." : "Criar orçamento"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : orcamentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400 text-center px-6">
              <Wrench className="h-8 w-8" />
              <p className="text-sm">
                Nenhum orçamento de posto de serviço ainda.
              </p>
              <p className="text-xs">
                Marque um cliente como &quot;Posto de Serviço Oficial&quot; no cadastro e
                crie orçamentos para ele — eles aparecerão aqui.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Nº", "Posto / Evento", "Data", "Status", "Total", "Ações"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                        i >= 4 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orcamentos.map((orc) => {
                  const cfg = statusConfig[orc.status] || statusConfig.PENDENTE;
                  return (
                    <tr key={orc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono font-medium text-slate-700">
                          #{orc.numero}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">
                          {orc.cliente?.nomeFantasia}
                        </p>
                        <p className="text-xs text-slate-400">
                          {orc.eventoNome || "—"}
                          {orc.local ? ` · ${orc.local.nome}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {orc.dataInicio
                          ? new Date(orc.dataInicio).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                        {formatCurrency(orc.total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/orcamentos/${orc.id}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Abrir"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
