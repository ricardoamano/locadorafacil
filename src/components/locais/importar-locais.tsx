"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { RevisaoDivergencias, type Decisao } from "@/components/ui/revisao-divergencias";
import { Upload, FileUp, CheckCircle2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Importa os espaços de evento (Locais) exportados do Bubble, cruzando com o
// arquivo de endereços (opcional). Não duplica: compara com os existentes e,
// havendo divergência, você decide item a item antes de gravar.

export function ImportarLocais({ onImportado }: { onImportado?: () => void }) {
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [locaisCsv, setLocaisCsv] = useState("");
  const [enderecosCsv, setEnderecosCsv] = useState("");
  const [nomeLocais, setNomeLocais] = useState("");
  const [nomeEnd, setNomeEnd] = useState("");
  const [previa, setPrevia] = useState<any | null>(null);
  const [decisoes, setDecisoes] = useState<Record<string, Decisao>>({});
  const [carregando, setCarregando] = useState(false);
  const refLoc = useRef<HTMLInputElement>(null);
  const refEnd = useRef<HTMLInputElement>(null);

  function reset() {
    setLocaisCsv("");
    setEnderecosCsv("");
    setNomeLocais("");
    setNomeEnd("");
    setPrevia(null);
    setDecisoes({});
  }

  async function lerArquivo(file: File, alvo: "locais" | "enderecos") {
    const texto = await file.text();
    if (alvo === "locais") {
      setLocaisCsv(texto);
      setNomeLocais(file.name);
    } else {
      setEnderecosCsv(texto);
      setNomeEnd(file.name);
    }
    setPrevia(null);
    setDecisoes({});
  }

  async function chamar(confirmar: boolean) {
    setCarregando(true);
    try {
      const res = await fetch("/api/import/locais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locaisCsv,
          enderecosCsv: enderecosCsv || undefined,
          confirmar,
          decisoes: confirmar ? decisoes : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (!confirmar) {
        setPrevia(d);
      } else {
        toast(
          `✅ ${d.criados} local(is) novo(s)` +
            (d.atualizados ? ` · ${d.atualizados} atualizado(s)` : "") +
            (d.mantidos ? ` · ${d.mantidos} já existiam (mantidos)` : ""),
          "success"
        );
        setAberto(false);
        reset();
        onImportado?.();
      }
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
        title="Importar locais (espaços de evento)"
        size="lg"
      >
        <ModalBody>
          <p className="text-sm text-slate-500 mb-4">
            Envie o arquivo de <strong>Locais</strong> exportado do Bubble (e, opcional, o de{" "}
            <strong>Endereços</strong>). Nada duplica: o que já existe é reconhecido e, se os
            dados forem diferentes, você decide um a um.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">1. Locais *</p>
              <input
                ref={refLoc}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) lerArquivo(f, "locais");
                }}
              />
              <Button variant="outline" size="sm" onClick={() => refLoc.current?.click()}>
                <FileUp className="h-4 w-4" />
                {nomeLocais ? "Trocar" : "Escolher arquivo"}
              </Button>
              {nomeLocais && (
                <p className="text-xs text-emerald-600 mt-1.5 truncate">✓ {nomeLocais}</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">2. Endereços (opcional)</p>
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
              {nomeEnd && <p className="text-xs text-emerald-600 mt-1.5 truncate">✓ {nomeEnd}</p>}
            </div>
          </div>

          {previa && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                <p className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  Prévia
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Novos", comp?.novos ?? previa.stats.locais],
                    ["Já existem (iguais)", comp?.iguais ?? 0],
                    ["Divergentes", comp?.divergentes?.length ?? 0],
                  ].map(([label, v]) => (
                    <div key={label as string} className="bg-white rounded-lg border border-slate-100 py-2">
                      <p className="text-lg font-bold text-slate-900">{v as number}</p>
                      <p className="text-[11px] text-slate-500">{label as string}</p>
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
            <Button onClick={() => chamar(false)} loading={carregando} disabled={!locaisCsv}>
              Analisar
            </Button>
          ) : (
            <Button onClick={() => chamar(true)} loading={carregando}>
              Importar ({comp?.novos ?? previa.stats.locais} novo(s))
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </>
  );
}
