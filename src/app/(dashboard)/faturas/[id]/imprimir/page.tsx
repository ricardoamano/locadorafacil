"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Printer, FileCheck } from "lucide-react";
import { NaoEncontrado } from "@/components/ui/nao-encontrado";

/* eslint-disable @typescript-eslint/no-explicit-any */

function fmtData(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtValor(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function ImprimirFaturaPage() {
  const params = useParams<{ id: string }>();
  const [dados, setDados] = useState<any | null>(null);
  const [emitida, setEmitida] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emitting, setEmitting] = useState(false);

  const load = useCallback(() => {
    if (!params?.id) return;
    fetch(`/api/faturas/${params.id}/emitir`)
      .then((r) => r.json())
      .then((d) => {
        setDados(d.dados);
        setEmitida(!!d.emitida);
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function emitirEImprimir() {
    setEmitting(true);
    try {
      const res = await fetch(`/api/faturas/${params.id}/emitir`, { method: "POST" });
      const d = await res.json();
      setDados(d.dados);
      setEmitida(true);
      setTimeout(() => window.print(), 300);
    } finally {
      setEmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!dados) {
    return <NaoEncontrado mensagem="Fatura não encontrada." voltarHref="/faturas" voltarLabel="Voltar para Faturas" />;
  }

  const e = dados.empresa || {};
  const c = dados.destinatario || {};

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Barra de ações — não sai na impressão */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Nota de Locação Nº {dados.numero}
          </p>
          <p className="text-xs text-slate-500">
            {emitida
              ? "Documento emitido — conteúdo congelado (reimpressões usam esta versão)"
              : "Pré-visualização — ainda não emitida"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {emitida ? (
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Salvar PDF
            </button>
          ) : (
            <button
              onClick={emitirEImprimir}
              disabled={emitting}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <FileCheck className="h-4 w-4" />
              {emitting ? "Emitindo..." : "Emitir e Imprimir"}
            </button>
          )}
        </div>
      </div>

      {/* Folha A4 */}
      <div className="mx-auto my-6 print:my-0 bg-white shadow-lg print:shadow-none max-w-[210mm] w-full">
        <div className="p-[10mm] print:p-[8mm]">
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            {/* ── Cabeçalho ── */}
            <div className="grid grid-cols-[42%_58%] border-b border-slate-800">
              <div className="p-3 flex flex-col items-center justify-center text-center border-r border-slate-300">
                {e.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.logoUrl} alt={e.nome} className="max-h-16 object-contain mb-1.5" />
                ) : (
                  <p className="text-xl font-black text-slate-900 mb-1">{e.nome}</p>
                )}
                <p className="text-[10px] leading-tight text-slate-700 font-medium">
                  {e.nome}
                  {e.endereco && (
                    <>
                      <br />
                      {e.endereco}
                    </>
                  )}
                  {(e.cidade || e.cep) && (
                    <>
                      <br />
                      {e.cidade}
                      {e.cep ? `, ${e.cep}` : ""}
                    </>
                  )}
                  {e.cnpj && (
                    <>
                      <br />
                      {e.cnpj}
                    </>
                  )}
                  {e.razaoSocial && (
                    <>
                      <br />
                      {e.razaoSocial}
                    </>
                  )}
                </p>
              </div>
              <div className="p-4 flex flex-col justify-center gap-2.5">
                <p className="text-xs font-bold text-slate-900">1º VIA - CLIENTE</p>
                <p className="text-xs text-slate-900">
                  <span className="font-bold">NATUREZA DA OPERAÇÃO:</span>{" "}
                  {e.naturezaOperacao}
                </p>
                <p className="text-xs text-slate-900">
                  <span className="font-bold">DATA EMISSÃO:</span> {fmtData(dados.dataEmissao)}
                </p>
                <p className="text-xs text-slate-900">
                  <span className="font-bold">NOTA DE LOCAÇÃO Nº:</span>{" "}
                  <span className="font-bold text-teal-700">{dados.numero}</span>
                </p>
              </div>
            </div>

            {/* ── Destinatário ── */}
            <div className="px-4 py-3 border-b border-slate-800 text-xs">
              <div className="grid grid-cols-[140px_1fr] gap-y-2">
                <span className="text-slate-700">RAZÃO SOCIAL</span>
                <span className="font-bold text-slate-900 uppercase">{c.razaoSocial}</span>
                <span className="text-slate-700">CNPJ (MF)</span>
                <span className="font-bold text-slate-900">{c.cnpj || "—"}</span>
                <span className="text-slate-700">ENDEREÇO</span>
                <span className="font-bold text-slate-900 uppercase">{c.endereco || "—"}</span>
                <span className="text-slate-700">BAIRRO</span>
                <span className="font-bold text-slate-900 uppercase">{c.bairro || "—"}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr_70px_50px_50px_1fr] gap-y-2 mt-2 items-baseline">
                <span className="text-slate-700">MUNICÍPIO</span>
                <span className="font-bold text-slate-900 uppercase">{c.municipio || "—"}</span>
                <span className="text-slate-700">ESTADO</span>
                <span className="font-bold text-slate-900">{c.estado || "—"}</span>
                <span className="text-slate-700">CEP</span>
                <span className="font-bold text-slate-900">{c.cep || "—"}</span>
              </div>
              <div className="grid grid-cols-[200px_1fr_180px_1fr] gap-y-2 mt-2">
                <span className="text-slate-700">INSCRIÇÃO ESTADUAL Nº</span>
                <span className="font-bold text-slate-900">{c.inscricaoEstadual || ""}</span>
                <span className="text-slate-700">INSCRIÇÃO MUNICIPAL</span>
                <span className="font-bold text-slate-900">{c.inscricaoMunicipal || ""}</span>
              </div>
            </div>

            {/* ── Código operação + vencimento ── */}
            <div className="grid grid-cols-[160px_1fr_220px] border-b border-slate-300 text-xs">
              <div className="px-4 py-2 text-slate-700 border-r border-slate-200">
                CÓDIGO OPERAÇÃO:
              </div>
              <div className="px-4 py-2 font-bold text-slate-900 text-center">{e.naturezaOperacao}</div>
              <div className="px-4 py-2 bg-yellow-300 font-bold text-slate-900 flex justify-center gap-3">
                <span className="text-slate-700 font-semibold">VENCIMENTO</span>
                <span>{fmtData(dados.dataVencimento)}</span>
              </div>
            </div>

            {/* ── Descritivo ── */}
            <div className="px-4 pt-3 pb-4">
              <p className="text-xs font-bold text-slate-900 mb-2">Descritivo</p>
              <div className="border border-slate-300 rounded-xl min-h-44 p-3 text-xs text-slate-900 uppercase whitespace-pre-wrap">
                {dados.descritivo}
              </div>

              {/* Total */}
              <div className="flex items-center justify-end gap-3 mt-4">
                <span className="text-sm font-bold text-slate-900">TOTAL</span>
                <span className="border-2 border-slate-900 rounded-lg px-4 py-1.5 text-sm font-bold text-slate-900">
                  {fmtValor(dados.valor)}
                </span>
              </div>

              {/* Dados para pagamento — padrão "Banco X / Agência / Conta Corrente / PIX (E-mail)" */}
              {(() => {
                const linhas: string[] =
                  Array.isArray(e.pagamento) && e.pagamento.length > 0
                    ? e.pagamento
                    : [
                        e.banco && `Banco ${e.banco}`,
                        e.agencia && `Agência ${e.agencia}`,
                        e.conta && `Conta Corrente ${e.conta}`,
                        e.pix && `PIX${String(e.pix).includes("@") ? " (E-mail)" : ""}: ${e.pix}`,
                      ].filter(Boolean);
                if (linhas.length === 0) return null;
                return (
                  <div className="mt-4 border border-slate-200 bg-slate-50 rounded-xl p-3 text-xs">
                    <p className="font-bold text-slate-900 mb-1.5">DADOS PARA PAGAMENTO</p>
                    {linhas.map((l, i) => (
                      <p key={i} className="text-slate-800">
                        {l}
                      </p>
                    ))}
                  </div>
                );
              })()}

              {/* Observação */}
              {e.observacao && (
                <div className="mt-3 bg-yellow-300 rounded-xl p-3 text-xs">
                  <p className="font-bold text-slate-900 mb-1">OBSERVAÇÃO</p>
                  <p className="text-slate-900 whitespace-pre-line">{e.observacao}</p>
                </div>
              )}
            </div>

            {/* ── Canhoto de recebimento ── */}
            <div className="border-t border-slate-300">
              <p className="px-4 py-2 bg-slate-100 text-[10px] text-slate-600 uppercase tracking-wide">
                RECEBI(EMOS) DE {e.razaoSocial || e.nome}, A(S) LOCAÇÃO(ÕES) CONSTANTES DESTA
                NOTA
              </p>
              <div className="grid grid-cols-[1fr_140px_1fr_100px] text-xs border-t border-slate-200">
                <div className="px-4 py-2.5 text-slate-400 font-semibold uppercase border-r border-slate-200">
                  Data do Recebimento
                </div>
                <div className="px-4 py-2.5 font-bold text-slate-900 border-r border-slate-200">
                  {fmtData(dados.dataEmissao)}
                </div>
                <div className="px-4 py-2.5 text-slate-400 font-semibold uppercase border-r border-slate-200">
                  Nota de Locação Nº
                </div>
                <div className="px-4 py-2.5 font-bold text-teal-700">{dados.numero}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          aside,
          header,
          nav {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .md\\:ml-60 {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
