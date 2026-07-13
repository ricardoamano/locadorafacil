"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { NaoEncontrado } from "@/components/ui/nao-encontrado";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Termo de Permanência — "o que ficou no evento". Lista os itens separados que
// permaneceram com o cliente. Impressão/PDF; a assinatura pode vir do aceite
// online (link público) ou ser feita à mão na via impressa.

function fmtData(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function EntregaImprimirPage() {
  const params = useParams<{ id: string }>();
  const [os, setOs] = useState<any | null>(null);
  const [entrega, setEntrega] = useState<any | null>(null);
  const [empresa, setEmpresa] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    Promise.all([
      fetch(`/api/ordens-servico/${params.id}`).then((r) => r.json()),
      fetch(`/api/ordens-servico/${params.id}/entrega`).then((r) => r.json()),
      fetch("/api/empresa").then((r) => r.json()),
    ])
      .then(([o, en, emp]) => {
        setOs(o?.id ? o : null);
        setEntrega(en?.itens ? en : null);
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
  if (!os)
    return (
      <NaoEncontrado
        mensagem="OS não encontrada."
        voltarHref="/ordens-servico"
        voltarLabel="Voltar para Ordens de Serviço"
      />
    );

  const orc = os.orcamento;
  const ficaram = (entrega?.itens || []).filter((i: any) => i.ficou > 0);
  const aceite = entrega?.entrega?.aceiteEm ? entrega.entrega : null;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          Termo de Permanência — OS #{orc?.numero}
        </p>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Imprimir / PDF
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
              {empresa?.cnpj && <p>CNPJ: {empresa.cnpj}</p>}
              <p>{[empresa?.telefone, empresa?.email].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold">TERMO DE PERMANÊNCIA</p>
            <p className="font-bold">OS #{orc?.numero}</p>
            <p>Emitido em {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        {/* Cliente e evento */}
        <div className="grid grid-cols-2 gap-3 mt-3 border border-slate-300 rounded p-3">
          <div>
            <p>
              <span className="font-bold">Cliente:</span> {orc?.cliente?.nomeFantasia}
            </p>
            {orc?.cliente?.razaoSocial && <p>{orc.cliente.razaoSocial}</p>}
            {orc?.cliente?.cnpj && <p>CNPJ: {orc.cliente.cnpj}</p>}
          </div>
          <div>
            <p>
              <span className="font-bold">Evento:</span> {orc?.eventoNome || "—"}
            </p>
            <p>
              <span className="font-bold">Data:</span> {fmtData(orc?.dataInicio)}
            </p>
            <p>
              <span className="font-bold">Local:</span> {orc?.local?.nome || "—"}
            </p>
          </div>
        </div>

        <p className="mt-3">
          Declaramos que os itens abaixo, de propriedade de{" "}
          <span className="font-bold">{empresa?.name}</span>, <span className="font-bold">permaneceram no local do evento</span> sob
          responsabilidade e guarda do cliente, que se compromete pela sua conservação e devolução
          nas mesmas condições.
        </p>

        {/* Tabela do que ficou */}
        <table className="w-full mt-3 border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1 text-left w-16">Código</th>
              <th className="border border-slate-300 px-2 py-1 text-left">Equipamento</th>
              <th className="border border-slate-300 px-2 py-1 text-center w-20">Qtd. ficou</th>
              <th className="border border-slate-300 px-2 py-1 text-center w-16">Conferido</th>
            </tr>
          </thead>
          <tbody>
            {ficaram.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-slate-300 px-2 py-3 text-center text-slate-400">
                  Nenhum item permaneceu no evento.
                </td>
              </tr>
            ) : (
              ficaram.map((i: any) => (
                <tr key={i.itemId}>
                  <td className="border border-slate-300 px-2 py-1 font-mono">{i.codigo || "—"}</td>
                  <td className="border border-slate-300 px-2 py-1">{i.nome}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center font-bold">{i.ficou}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">☐</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {entrega?.observacoes && (
          <div className="mt-3 border border-slate-300 rounded p-2">
            <span className="font-bold">Observações:</span> {entrega.observacoes}
          </div>
        )}

        {/* Aceite / assinatura */}
        <div className="mt-8 grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="h-16 flex items-end justify-center">
              {aceite?.assinatura && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={aceite.assinatura} alt="assinatura" className="max-h-16 object-contain" />
              )}
            </div>
            <div className="border-t border-slate-500 pt-1">
              <p className="font-bold">{aceite?.clienteNome || "Cliente (recebedor)"}</p>
              {aceite?.clienteDoc && <p>Doc.: {aceite.clienteDoc}</p>}
              {aceite?.aceiteEm && (
                <p className="text-slate-500">
                  Aceito on-line em {new Date(aceite.aceiteEm).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="h-16" />
            <div className="border-t border-slate-500 pt-1">
              <p className="font-bold">{empresa?.name}</p>
              <p>Responsável pela entrega</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
