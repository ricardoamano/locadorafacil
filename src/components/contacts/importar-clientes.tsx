"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Upload, FileUp, CheckCircle2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Importa clientes + contatos exportados do Bubble (2 CSVs), com prévia antes
// de gravar. Reconstrói o vínculo cliente↔contatos automaticamente.

export function ImportarClientes({ onImportado }: { onImportado?: () => void }) {
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [clientesCsv, setClientesCsv] = useState("");
  const [contatosCsv, setContatosCsv] = useState("");
  const [nomeClientes, setNomeClientes] = useState("");
  const [nomeContatos, setNomeContatos] = useState("");
  const [previa, setPrevia] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);
  const refCli = useRef<HTMLInputElement>(null);
  const refCon = useRef<HTMLInputElement>(null);

  function reset() {
    setClientesCsv("");
    setContatosCsv("");
    setNomeClientes("");
    setNomeContatos("");
    setPrevia(null);
  }

  async function lerArquivo(file: File, alvo: "clientes" | "contatos") {
    const texto = await file.text();
    if (alvo === "clientes") {
      setClientesCsv(texto);
      setNomeClientes(file.name);
    } else {
      setContatosCsv(texto);
      setNomeContatos(file.name);
    }
    setPrevia(null);
  }

  async function analisar() {
    if (!clientesCsv.trim()) {
      toast("Envie ao menos o arquivo de clientes.", "error");
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch("/api/import/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientesCsv, contatosCsv }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPrevia(d);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao analisar.", "error");
    } finally {
      setCarregando(false);
    }
  }

  async function importar() {
    setCarregando(true);
    try {
      const res = await fetch("/api/import/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientesCsv, contatosCsv, confirmar: true }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast(
        `✅ ${d.criados} cliente(s) importado(s) (${d.contatosCriados} contato(s))` +
          (d.pulados ? ` · ${d.pulados} já existiam` : ""),
        "success"
      );
      setAberto(false);
      reset();
      onImportado?.();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao importar.", "error");
    } finally {
      setCarregando(false);
    }
  }

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
            Envie os dois arquivos exportados do Bubble: a lista de <strong>clientes</strong>{" "}
            e a de <strong>contatos</strong>. O sistema reconstrói o vínculo automaticamente
            e ignora registros de teste. Nada é gravado antes da prévia.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>

          {previa && (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                Prévia da importação
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mb-3">
                {[
                  ["Clientes", previa.stats.clientes],
                  ["Postos", previa.stats.postos],
                  ["Contatos", previa.stats.subcontatos],
                  ["Testes ignorados", previa.stats.gruposDescartados],
                ].map(([label, v]) => (
                  <div key={label as string} className="bg-white rounded-lg border border-slate-100 py-2">
                    <p className="text-lg font-bold text-slate-900">{v as number}</p>
                    <p className="text-[11px] text-slate-500">{label as string}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mb-1">Amostra:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
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
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setAberto(false)} disabled={carregando}>
            Cancelar
          </Button>
          {!previa ? (
            <Button onClick={analisar} loading={carregando} disabled={!clientesCsv}>
              Analisar
            </Button>
          ) : (
            <Button onClick={importar} loading={carregando}>
              Importar {previa.stats.clientes} cliente(s)
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </>
  );
}
