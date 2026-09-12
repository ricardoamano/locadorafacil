"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { RevisaoDivergencias, type Decisao } from "@/components/ui/revisao-divergencias";
import { Upload, FileUp, CheckCircle2, Database } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Importa membros da equipe direto do Bubble (Data API) ou de um CSV.
// Não duplica: cruza por id do Bubble, CPF ou nome; divergências são
// decididas uma a uma antes de gravar. Mobile first: tudo empilha.

type Origem = "bubble" | "csv";

export function ImportarMembros({ onImportado }: { onImportado?: () => void }) {
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [origem, setOrigem] = useState<Origem>("bubble");
  const [csv, setCsv] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [previa, setPrevia] = useState<any | null>(null);
  const [decisoes, setDecisoes] = useState<Record<string, Decisao>>({});
  const [carregando, setCarregando] = useState(false);
  const refArq = useRef<HTMLInputElement>(null);

  function reset() {
    setCsv("");
    setNomeArquivo("");
    setPrevia(null);
    setDecisoes({});
  }

  function trocarOrigem(o: Origem) {
    setOrigem(o);
    setPrevia(null);
    setDecisoes({});
  }

  async function lerArquivo(file: File) {
    setCsv(await file.text());
    setNomeArquivo(file.name);
    setPrevia(null);
    setDecisoes({});
  }

  async function chamar(confirmar: boolean) {
    setCarregando(true);
    try {
      const res = await fetch("/api/import/membros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origem,
          csv: origem === "csv" ? csv : undefined,
          confirmar,
          decisoes: confirmar ? decisoes : undefined,
        }),
      });
      const d = await res.json().catch(() => ({ error: `Erro ${res.status}` }));
      if (!res.ok) throw new Error(d.error);
      if (!confirmar) {
        setPrevia(d);
      } else {
        toast(
          `✅ ${d.criados} membro(s) novo(s)` +
            (d.atualizados ? ` · ${d.atualizados} atualizado(s)` : "") +
            (d.mantidos ? ` · ${d.mantidos} já existiam` : "") +
            (d.especialidadesCriadas ? ` · ${d.especialidadesCriadas} especialidade(s) nova(s)` : ""),
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
  const podeAnalisar = origem === "bubble" || !!csv;

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <Upload className="h-4 w-4" />
        Importar
      </Button>

      <Modal
        open={aberto}
        onClose={() => !carregando && setAberto(false)}
        title="Importar equipe"
        size="lg"
      >
        <ModalBody>
          <p className="text-sm text-slate-500 mb-3">
            Traga funcionários, freelancers e técnicos. Nada duplica: quem já existe é
            reconhecido (pelo Bubble, CPF ou nome) e, se os dados forem diferentes, você decide
            um a um.
          </p>

          {/* Origem */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(
              [
                { v: "bubble", label: "Direto do Bubble", Icon: Database, dica: "Lê o tipo 'equipe' pela Data API" },
                { v: "csv", label: "Arquivo CSV", Icon: FileUp, dica: "Planilha com coluna Nome (e o que mais tiver)" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => trocarOrigem(o.v)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  origem === o.v ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <o.Icon className="h-4 w-4" />
                  {o.label}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{o.dica}</p>
              </button>
            ))}
          </div>

          {origem === "csv" && (
            <div className="rounded-lg border border-slate-200 p-3">
              <input
                ref={refArq}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) lerArquivo(f);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refArq.current?.click()}>
                  <FileUp className="h-4 w-4" />
                  {nomeArquivo ? "Trocar arquivo" : "Escolher arquivo"}
                </Button>
                {nomeArquivo && <span className="text-xs text-emerald-600 truncate">✓ {nomeArquivo}</span>}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Colunas aceitas: Nome*, Telefone, E-mail, RG, CPF, Tipo (fixo/freela/técnico), PIX,
                Cachê, Observações, Especialidades (separe por ;). Vírgula ou ponto e vírgula.
              </p>
            </div>
          )}

          {previa && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                <p className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  Prévia — {comp.total} membro(s) encontrado(s)
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Novos", comp.novos],
                    ["Já existem (iguais)", comp.iguais],
                    ["Divergentes", comp.divergentes.length],
                  ].map(([label, v]) => (
                    <div key={label as string} className="bg-white rounded-lg border border-slate-100 py-2">
                      <p className="text-lg font-bold text-slate-900">{v as number}</p>
                      <p className="text-[11px] text-slate-500">{label as string}</p>
                    </div>
                  ))}
                </div>
                {previa.colunas?.ignoradas?.length > 0 && (
                  <p className="text-[11px] text-amber-700 mt-2">
                    Colunas ignoradas: {previa.colunas.ignoradas.join(", ")}
                  </p>
                )}
                {comp.amostra?.length > 0 && (
                  <ul className="mt-2 text-xs text-slate-600 space-y-0.5">
                    {comp.amostra.map((a: any, i: number) => (
                      <li key={i} className="truncate">
                        • {a.nome} <span className="text-slate-400">— {a.tipo.toLowerCase()}{a.telefone ? ` · ${a.telefone}` : ""}{a.especialidades ? ` · ${a.especialidades}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {comp.divergentes.length > 0 && (
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
            <Button onClick={() => chamar(false)} loading={carregando} disabled={!podeAnalisar}>
              Analisar
            </Button>
          ) : (
            <Button onClick={() => chamar(true)} loading={carregando}>
              Importar ({comp.novos} novo(s))
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </>
  );
}
