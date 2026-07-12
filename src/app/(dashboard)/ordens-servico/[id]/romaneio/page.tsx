"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { NaoEncontrado } from "@/components/ui/nao-encontrado";

/* eslint-disable @typescript-eslint/no-explicit-any */

function fmtData(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtValor(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function RomaneioPage() {
  const params = useParams<{ id: string }>();
  const [os, setOs] = useState<any | null>(null);
  const [extras, setExtras] = useState<any[]>([]);
  const [empresa, setEmpresa] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    Promise.all([
      fetch(`/api/ordens-servico/${params.id}`).then((r) => r.json()),
      fetch(`/api/ordens-servico/${params.id}/itens-extras`).then((r) => r.json()),
      fetch("/api/empresa").then((r) => r.json()),
    ])
      .then(([o, e, emp]) => {
        setOs(o?.id ? o : null);
        setExtras(e?.extras || []);
        setEmpresa(emp?.id ? emp : null);
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  if (!os) return <NaoEncontrado mensagem="OS não encontrada." voltarHref="/ordens-servico" voltarLabel="Voltar para Ordens de Serviço" />;

  const orc = os.orcamento;
  // Só equipamentos vão no romaneio (serviços não embarcam no caminhão)
  const salas = (orc?.salas || [])
    .map((s: any) => ({
      ...s,
      itens: (s.itens || []).filter((i: any) => i.item?.natureza !== "SERVICO"),
    }))
    .filter((s: any) => s.itens.length > 0);

  const totalReposicao =
    salas.reduce(
      (acc: number, s: any) =>
        acc +
        s.itens.reduce(
          (a: number, i: any) => a + (i.item?.valorReposicao || 0) * (i.quantidade || 0),
          0
        ),
      0
    ) +
    extras.reduce((a: number, e: any) => a + (e.item?.valorReposicao || 0) * e.quantidade, 0);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          Romaneio de Carga — OS #{orc?.numero}
        </p>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
      </div>

      <div className="mx-auto my-6 print:my-0 bg-white shadow print:shadow-none w-[210mm] min-h-[297mm] px-[12mm] py-[10mm] text-[10.5px] leading-snug text-slate-800">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            {empresa?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logoUrl} alt="" className="h-14 w-auto object-contain" />
            )}
            <div>
              <p className="text-[13px] font-bold">{empresa?.name}</p>
              <p>{[empresa?.telefone, empresa?.email].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold">ROMANEIO DE CARGA</p>
            <p className="font-bold">OS #{orc?.numero}</p>
            <p>Emitido em {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        {/* Evento */}
        <div className="grid grid-cols-2 gap-3 mt-3 border border-slate-300 rounded p-3">
          <div>
            <p><span className="font-bold">Cliente:</span> {orc?.cliente?.nomeFantasia}</p>
            <p><span className="font-bold">Evento:</span> {orc?.eventoNome || "—"}</p>
            {orc?.local?.nome && (
              <p><span className="font-bold">Local:</span> {orc.local.nome}</p>
            )}
          </div>
          <div>
            <p><span className="font-bold">Montagem:</span> {fmtData(orc?.dataMontagem)}</p>
            <p>
              <span className="font-bold">Evento:</span> {fmtData(orc?.dataInicio)}
              {orc?.dataFim ? ` a ${fmtData(orc.dataFim)}` : ""}
            </p>
          </div>
        </div>

        {/* Equipamentos por sala */}
        {salas.map((sala: any, si: number) => (
          <div key={si} className="mt-4" style={{ breakInside: "avoid" }}>
            <p className="bg-slate-800 text-white font-bold px-2 py-1 text-[11px] uppercase">
              {sala.nome}
            </p>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[9px] uppercase text-slate-600">
                  <th className="border border-slate-300 px-1.5 py-1 w-10 text-center">Qtd</th>
                  <th className="border border-slate-300 px-1.5 py-1 text-left">Equipamento</th>
                  <th className="border border-slate-300 px-1.5 py-1 w-24 text-right">Reposição (un.)</th>
                  <th className="border border-slate-300 px-1.5 py-1 w-14 text-center">Saída ✓</th>
                  <th className="border border-slate-300 px-1.5 py-1 w-14 text-center">Retorno ✓</th>
                </tr>
              </thead>
              <tbody>
                {sala.itens.map((i: any, ii: number) => (
                  <tr key={ii}>
                    <td className="border border-slate-300 px-1.5 py-1.5 text-center font-bold">
                      {i.quantidade}
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1.5">
                      {i.item?.nome}
                      {i.item?.codigo && (
                        <span className="text-slate-400"> ({i.item.codigo})</span>
                      )}
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1.5 text-right">
                      {fmtValor(i.item?.valorReposicao)}
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1.5 text-center text-slate-300">
                      ☐
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1.5 text-center text-slate-300">
                      ☐
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Itens extras */}
        {extras.length > 0 && (
          <div className="mt-4" style={{ breakInside: "avoid" }}>
            <p className="bg-red-700 text-white font-bold px-2 py-1 text-[11px] uppercase">
              Itens Extras / Acessórios (fora do orçamento)
            </p>
            <table className="w-full border-collapse">
              <tbody>
                {extras.map((e: any) => (
                  <tr key={e.id} className="text-red-700">
                    <td className="border border-slate-300 px-1.5 py-1.5 w-10 text-center font-bold">
                      {e.quantidade}
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1.5">
                      {e.item?.nome}
                      {e.item?.codigo && <span> ({e.item.codigo})</span>}
                      {e.fornecedor && (
                        <span className="font-semibold"> · sub-locado de {e.fornecedor.nomeFantasia}</span>
                      )}
                      {e.observacao && <span className="italic"> — {e.observacao}</span>}
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1.5 w-24 text-right">
                      {fmtValor(e.item?.valorReposicao)}
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1.5 w-14 text-center text-slate-300">☐</td>
                    <td className="border border-slate-300 px-1.5 py-1.5 w-14 text-center text-slate-300">☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Termo de responsabilidade */}
        <div className="mt-5 border border-slate-300 rounded p-3 text-[9.5px] text-slate-600" style={{ breakInside: "avoid" }}>
          <p className="font-bold text-[10px] uppercase text-slate-700 mb-1">
            Termo de Responsabilidade
          </p>
          <p>
            Declaro ter recebido os equipamentos acima relacionados em perfeito estado de
            funcionamento e conservação, responsabilizando-me pela guarda e devolução nas
            mesmas condições. Em caso de perda, extravio ou dano, comprometo-me a ressarcir
            o valor de reposição indicado por unidade
            {totalReposicao > 0
              ? ` (valor total de reposição desta carga: ${fmtValor(totalReposicao)})`
              : ""}
            .
          </p>
          <div className="grid grid-cols-2 gap-8 mt-8">
            <div className="text-center">
              <div className="border-t border-slate-400 pt-1">
                Responsável pela SAÍDA (cliente/recebedor)
                <br />
                Nome/Doc.: ______________________ Data: ____/____/____
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 pt-1">
                Responsável pelo RETORNO (conferente)
                <br />
                Nome/Doc.: ______________________ Data: ____/____/____
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          aside,
          header,
          nav {
            display: none !important;
          }
          main {
            padding: 0 !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
