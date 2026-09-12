"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Printer, FileCheck } from "lucide-react";
import { NaoEncontrado } from "@/components/ui/nao-encontrado";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Nota de Locação (fatura/recibo) — layout reproduz fielmente o recibo oficial
// da Neostore (NL-335): medidas em pt/mm, fonte Roboto, mesmas faixas e cores.
// Conferido lado a lado com o PDF de referência renderizado a 96 dpi.

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
  const pagamento: string[] =
    Array.isArray(e.pagamento) && e.pagamento.length > 0
      ? e.pagamento
      : ([
          e.banco && `Banco ${e.banco}`,
          e.agencia && `Agência ${e.agencia}`,
          e.conta && `Conta Corrente ${e.conta}`,
          e.pix && `PIX${String(e.pix).includes("@") ? " (E-mail)" : ""}: ${e.pix}`,
        ].filter(Boolean) as string[]);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Barra de ações — não sai na impressão */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-slate-900">Nota de Locação Nº {dados.numero}</p>
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

      {/* Folha A4 — na tela rola horizontalmente no celular; na impressão é a página */}
      <div className="overflow-x-auto print:overflow-visible">
        <div className="nl-folha mx-auto my-6 print:my-0 bg-white shadow-lg print:shadow-none">
          <div className="nl-caixa">
            {/* Cabeçalho */}
            <div className="nl-cab">
              <div className="nl-cab-esq">
                {e.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.logoUrl} alt={e.nome} />
                ) : (
                  <p style={{ fontSize: "16pt" }}>{e.nome}</p>
                )}
                <p>
                  {e.nome}
                  {e.endereco && (
                    <>
                      <br />
                      {e.endereco},
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
              <div className="nl-cab-dir">
                <p>1º VIA - CLIENTE</p>
                <p>
                  NATUREZA DA OPERAÇÃO:<span className="v">{e.naturezaOperacao}</span>
                </p>
                <p>
                  DATA EMISSÃO:<span className="v">{fmtData(dados.dataEmissao)}</span>
                </p>
                <p>
                  NOTA DE LOCAÇÃO Nº:<span className="v num">{dados.numero}</span>
                </p>
              </div>
            </div>

            {/* Destinatário */}
            <div className="nl-dest">
              <div className="lin">
                <span className="l">RAZÃO SOCIAL</span>
                <span className="v">{c.razaoSocial}</span>
              </div>
              <div className="lin">
                <span className="l">CNPJ (MF)</span>
                <span className="v">{c.cnpj || ""}</span>
              </div>
              <div className="lin">
                <span className="l">ENDEREÇO</span>
                <span className="v">{c.endereco || ""}</span>
              </div>
              <div className="lin">
                <span className="l">BAIRRO</span>
                <span className="v">{c.bairro || ""}</span>
              </div>
              <div className="lin3">
                <span className="l">MUNICÍPIO</span>
                <span className="v">{c.municipio || ""}</span>
                <span className="l">ESTADO</span>
                <span className="v">{c.estado || ""}</span>
                <span className="l">CEP</span>
                <span className="v">{c.cep || ""}</span>
              </div>
              <div className="lin2">
                <span className="l">
                  INSCRIÇÃO ESTADUAL Nº <span className="v">{c.inscricaoEstadual || ""}</span>
                </span>
                <span className="l">
                  INSCRIÇÃO MUNICIPAL <span className="v">{c.inscricaoMunicipal || ""}</span>
                </span>
              </div>
            </div>

            {/* Código operação + vencimento */}
            <div className="nl-cod">
              <div className="c1">CÓDIGO OPERAÇÃO:</div>
              <div className="c2">{e.naturezaOperacao}</div>
              <div className="c3">
                <span className="l">VENCIMENTO</span>
                <span>{fmtData(dados.dataVencimento)}</span>
              </div>
            </div>

            {/* Descritivo, total, pagamento, observação */}
            <div className="nl-corpo">
              <h4>Descritivo</h4>
              <div className="nl-desc">{dados.descritivo}</div>
              <div className="nl-total">
                <span className="l">TOTAL</span>
                <span className="v">{fmtValor(dados.valor)}</span>
              </div>
              {pagamento.length > 0 && (
                <div className="nl-pag">
                  <h5>DADOS PARA PAGAMENTO</h5>
                  {pagamento.map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                </div>
              )}
              {e.observacao && (
                <div className="nl-obs">
                  <h5>OBSERVAÇÃO</h5>
                  <p>{e.observacao}</p>
                </div>
              )}
            </div>

            {/* Canhoto */}
            <div className="nl-recebi">
              Recebi(emos) de {e.razaoSocial || e.nome}, a(s) locação(ões) constantes desta nota
            </div>
            <div className="nl-canhoto">
              <div className="l">Data do recebimento</div>
              <div>{fmtData(dados.dataEmissao)}</div>
              <div className="l">Nota de locação nº</div>
              <div className="num">{dados.numero}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fonte do recibo oficial */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
      />

      <style jsx global>{`
        .nl-folha {
          width: 210mm;
          min-height: 297mm;
          padding: 5.8mm 5.8mm 0;
          font-family: Roboto, "Helvetica Neue", Arial, "Liberation Sans", sans-serif;
          color: #111;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .nl-folha * { box-sizing: border-box; }
        .nl-caixa { border: 1px solid #333; border-radius: 6px; overflow: hidden; }
        .nl-cab { display: grid; grid-template-columns: 42% 58%; border-bottom: 1px solid #333; min-height: 130pt; }
        .nl-cab-esq { padding: 10pt 8pt 8pt; text-align: center; border-right: 1px solid #bbb; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .nl-cab-esq img { max-height: 58pt; max-width: 92%; object-fit: contain; margin-bottom: 5pt; }
        .nl-cab-esq p { margin: 0; font-size: 8pt; line-height: 1.6; font-weight: 700; color: #222; }
        .nl-cab-dir { padding: 14pt 14pt 16pt; display: flex; flex-direction: column; justify-content: space-between; }
        .nl-cab-dir p { margin: 0; font-size: 10.5pt; font-weight: 700; color: #222; line-height: 1.3; }
        .nl-cab-dir p span.v { margin-left: 5pt; }
        .nl-cab-dir .num { color: #1f7a6d; }
        .nl-dest { padding: 12pt 18pt 8pt; border-bottom: 1px solid #333; font-size: 10.5pt; }
        .nl-dest .lin { display: grid; grid-template-columns: 88pt 1fr; align-items: baseline; min-height: 24pt; }
        .nl-dest .lin3 { display: grid; grid-template-columns: 88pt 192pt 52pt 46pt 33pt 1fr; align-items: baseline; min-height: 24pt; }
        .nl-dest .lin2 { display: grid; grid-template-columns: 280pt 1fr; align-items: baseline; min-height: 24pt; }
        .nl-dest .l { color: #333; }
        .nl-dest .v { font-weight: 700; color: #111; text-transform: uppercase; }
        .nl-cod { display: grid; grid-template-columns: 26% 36% 38%; border-bottom: 1px solid #bbb; font-size: 10.5pt; height: 24pt; align-items: center; }
        .nl-cod .c1 { padding: 0 18pt; color: #333; border-right: 1px solid #ccc; height: 100%; display: flex; align-items: center; }
        .nl-cod .c2 { text-align: center; font-weight: 700; }
        .nl-cod .c3 { background: #ffff5c; height: 100%; display: flex; align-items: center; justify-content: center; gap: 10pt; font-weight: 700; }
        .nl-cod .c3 .l { color: #333; font-weight: 500; }
        .nl-corpo { padding: 12pt 18pt 0; }
        .nl-corpo h4 { margin: 0 0 8pt; font-size: 10.5pt; font-weight: 700; }
        .nl-desc { border: 1px solid #555; border-radius: 8px; min-height: 132pt; padding: 12pt; font-size: 10.5pt; text-transform: uppercase; white-space: pre-wrap; line-height: 1.35; }
        .nl-total { display: flex; justify-content: flex-end; align-items: center; gap: 10pt; margin: 12pt 0 10pt; }
        .nl-total .l { font-size: 11pt; font-weight: 700; color: #222; }
        .nl-total .v { border: 1.5px solid #333; border-radius: 6px; padding: 6pt 12pt; font-size: 11.5pt; font-weight: 700; min-width: 90pt; text-align: center; }
        .nl-pag { background: #f4f4f5; border: 1px solid #ddd; border-radius: 8px; padding: 8pt 12pt; font-size: 10.5pt; line-height: 1.4; }
        .nl-pag h5, .nl-obs h5 { margin: 0 0 3pt; font-size: 10.5pt; font-weight: 700; }
        .nl-pag p, .nl-obs p { margin: 0; }
        .nl-obs { background: #ffff5c; border-radius: 8px; padding: 8pt 12pt; font-size: 10.5pt; line-height: 1.4; margin-top: 8pt; white-space: pre-line; }
        .nl-recebi { margin-top: 10pt; background: #f5f5f5; border-top: 1px solid #e5e5e5; padding: 10pt 18pt; font-size: 8pt; color: #555; text-transform: uppercase; }
        .nl-canhoto { display: grid; grid-template-columns: 31% 19% 30% 20%; border-top: 1px solid #ccc; font-size: 11pt; font-weight: 700; height: 34pt; align-items: center; }
        .nl-canhoto div { height: 100%; display: flex; align-items: center; justify-content: center; border-right: 1px solid #ccc; text-transform: uppercase; }
        .nl-canhoto div:last-child { border-right: 0; }
        .nl-canhoto .l { color: #a9b3c1; }
        .nl-canhoto .num { color: #1f7a6d; }

        @media print {
          @page { size: A4; margin: 0; }
          aside, header, nav { display: none !important; }
          body { background: white !important; }
          .md\\:ml-60 { margin-left: 0 !important; }
          .nl-folha { margin: 0 !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
