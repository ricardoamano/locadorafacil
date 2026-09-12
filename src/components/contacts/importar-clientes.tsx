"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { RevisaoDivergencias, type Decisao } from "@/components/ui/revisao-divergencias";
import { Upload, FileUp, CheckCircle2, MapPin } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Importa clientes + contatos exportados do Bubble (2 CSVs), com prévia antes
// de gravar. Não duplica: clientes já existentes são reconhecidos pelo nome e,
// quando os dados divergem, você decide item a item.

// Completa o endereço dos clientes pelo CNPJ (Receita), em lotes, até acabar.
export function CompletarEnderecos({ onCompletado }: { onCompletado?: () => void }) {
  const { toast } = useToast();
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<string>("");

  async function completar() {
    setRodando(true);
    let preenchidosTotal = 0;
    try {
      for (let i = 0; i < 60; i++) {
        const res = await fetch("/api/import/completar-cnpj", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limite: 20 }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        preenchidosTotal += d.preenchidos || 0;
        setProgresso(
          `${preenchidosTotal} preenchido(s)` +
            (d.restantes ? ` · ${d.restantes} restante(s)...` : "")
        );
        if (d.rateLimited) {
          await new Promise((r) => setTimeout(r, 3000)); // aguarda o limite liberar
          continue;
        }
        if (!d.restantes) break;
      }
      toast(`✅ Endereços completados: ${preenchidosTotal} cliente(s) pelo CNPJ.`, "success");
      onCompletado?.();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao completar.", "error");
    } finally {
      setRodando(false);
      setProgresso("");
    }
  }

  return (
    <Button variant="outline" onClick={completar} loading={rodando}>
      <MapPin className="h-4 w-4" />
      {rodando ? progresso || "Completando..." : "Completar endereços (CNPJ)"}
    </Button>
  );
}

export function ImportarClientes({ onImportado }: { onImportado?: () => void }) {
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [clientesCsv, setClientesCsv] = useState("");
  const [contatosCsv, setContatosCsv] = useState("");
  const [enderecosCsv, setEnderecosCsv] = useState("");
  const [nomeClientes, setNomeClientes] = useState("");
  const [nomeContatos, setNomeContatos] = useState("");
  const [nomeEnd, setNomeEnd] = useState("");
  const [previa, setPrevia] = useState<any | null>(null);
  const [decisoes, setDecisoes] = useState<Record<string, Decisao>>({});
  const [carregando, setCarregando] = useState(false);
  const refCli = useRef<HTMLInputElement>(null);
  const refCon = useRef<HTMLInputElement>(null);
  const refEnd = useRef<HTMLInputElement>(null);

  function reset() {
    setClientesCsv("");
    setContatosCsv("");
    setEnderecosCsv("");
    setNomeClientes("");
    setNomeContatos("");
    setNomeEnd("");
    setPrevia(null);
    setDecisoes({});
  }

  async function lerArquivo(file: File, alvo: "clientes" | "contatos" | "enderecos") {
    const texto = await file.text();
    if (alvo === "clientes") {
      setClientesCsv(texto);
      setNomeClientes(file.name);
    } else if (alvo === "contatos") {
      setContatosCsv(texto);
      setNomeContatos(file.name);
    } else {
      setEnderecosCsv(texto);
      setNomeEnd(file.name);
    }
    setPrevia(null);
    setDecisoes({});
  }

  async function chamar(confirmar: boolean) {
    if (!clientesCsv.trim()) {
      toast("Envie ao menos o arquivo de clientes.", "error");
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch("/api/import/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientesCsv,
          contatosCsv,
          enderecosCsv: enderecosCsv || undefined,
          confirmar,
          decisoes: confirmar ? decisoes : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (!confirmar) {
        setPrevia(d);
        return;
      }
      toast(
        `✅ ${d.criados} cliente(s) novo(s) (${d.contatosCriados} contato(s))` +
          (d.atualizados ? ` · ${d.atualizados} atualizado(s)` : "") +
          (d.mantidos ? ` · ${d.mantidos} já existiam (mantidos)` : ""),
        "success"
      );
      setAberto(false);
      reset();
      onImportado?.();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro na importação.", "error");
    } finally {
      setCarregando(false);
    }
  }

  const comp = previa?.comparacao;

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <Upload className="h-4 w-4" />
        Importar
      </Button>

      <Modal
        open={aberto}
        onClose={() => !carregando && setAberto(false)}
        title="Importar clientes (CSV do Bubble)"
        size="lg"
      >
        <ModalBody>
          <p className="text-sm text-slate-500 mb-4">
            Envie os arquivos do Bubble: <strong>clientes</strong>, <strong>contatos</strong> e
            (opcional) <strong>endereços</strong>. Nada duplica: quem já existe é reconhecido pelo
            nome — campos em branco são completados e, se houver dados diferentes, você decide
            um a um antes de gravar.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">1. Clientes *</p>
              <input
                ref={refCli}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) lerArquivo(f, "clientes");
                }}
              />
              <Button variant="outline" size="sm" onClick={() => refCli.current?.click()}>
                <FileUp className="h-4 w-4" />
                {nomeClientes ? "Trocar" : "Escolher arquivo"}
              </Button>
              {nomeClientes && (
                <p className="text-xs text-emerald-600 mt-1.5 truncate">✓ {nomeClientes}</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">2. Contatos</p>
              <input
                ref={refCon}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) lerArquivo(f, "contatos");
                }}
              />
              <Button variant="outline" size="sm" onClick={() => refCon.current?.click()}>
                <FileUp className="h-4 w-4" />
                {nomeContatos ? "Trocar" : "Escolher arquivo"}
              </Button>
              {nomeContatos && (
                <p className="text-xs text-emerald-600 mt-1.5 truncate">✓ {nomeContatos}</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">3. Endereços</p>
              <input
                ref={refEnd}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) lerArquivo(f, "enderecos");
                }}
              />
              <Button variant="outline" size="sm" onClick={() => refEnd.current?.click()}>
                <FileUp className="h-4 w-4" />
                {nomeEnd ? "Trocar" : "Escolher arquivo"}
              </Button>
              {nomeEnd && (
                <p className="text-xs text-emerald-600 mt-1.5 truncate">✓ {nomeEnd}</p>
              )}
            </div>
          </div>

          {previa && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                <p className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  Prévia da importação
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mb-3">
                  {[
                    ["Novos", comp?.novos ?? previa.stats.clientes],
                    ["Já existem (iguais)", comp?.iguais ?? 0],
                    ["Divergentes", comp?.divergentes?.length ?? 0],
                    ["Contatos (pessoas)", previa.stats.subcontatos],
                  ].map(([label, v]) => (
                    <div key={label as string} className="bg-white rounded-lg border border-slate-100 py-2">
                      <p className="text-lg font-bold text-slate-900">{v as number}</p>
                      <p className="text-[11px] text-slate-500">{label as string}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mb-1">Amostra:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {previa.amostra.map((c: any, i: number) => (
                    <div key={i} className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{c.nomeFantasia}</span>
                      {c.posto && <span className="ml-1 text-violet-600">(posto)</span>}
                      {c.contatos.length > 0 && (
                        <span className="text-slate-400"> — {c.contatos.join(", ")}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {comp?.divergentes?.length > 0 && (
                <RevisaoDivergencias
                  divergentes={comp.divergentes}
                  decisoes={decisoes}
                  onChange={(chave, d) => setDecisoes((p) => ({ ...p, [chave]: d }))}
                  onTodos={(d) =>
                    setDecisoes(Object.fromEntries(comp.divergentes.map((x: any) => [x.chave, d])))
                  }
                />
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setAberto(false)} disabled={carregando}>
            Cancelar
          </Button>
          {!previa ? (
            <Button onClick={() => chamar(false)} loading={carregando} disabled={!clientesCsv}>
              Analisar
            </Button>
          ) : (
            <Button onClick={() => chamar(true)} loading={carregando}>
              Importar ({comp?.novos ?? previa.stats.clientes} novo(s))
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </>
  );
}
