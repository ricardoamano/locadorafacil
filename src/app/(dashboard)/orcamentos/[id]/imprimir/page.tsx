"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

function fmtData(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtValor(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function ImprimirOrcamentoPage() {
  const params = useParams<{ id: string }>();
  const [orc, setOrc] = useState<any | null>(null);
  const [empresa, setEmpresa] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    Promise.all([
      fetch(`/api/orcamentos/${params.id}`).then((r) => r.json()),
      fetch("/api/empresa").then((r) => r.json()),
    ])
      .then(([o, e]) => {
        setOrc(o?.id ? o : null);
        setEmpresa(e?.id ? e : null);
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!orc) {
    return <p className="p-8 text-sm text-slate-500">Orçamento não encontrado.</p>;
  }

  const salas: any[] = orc.salas || [];
  const bruto = salas.reduce(
    (acc, s) =>
      acc +
      (s.itens || []).reduce(
        (a: number, i: any) =>
          a + (i.quantidade || 0) * (i.diarias || 1) * (i.valorUnitario || 0),
        0
      ),
    0
  );
  const desconto = orc.desconto || 0;
  const descontoValor =
    orc.descontoTipo === "percentual" ? (bruto * desconto) / 100 : desconto;
  const total = Math.max(0, bruto - descontoValor);

  // Carga elétrica: soma de quantidade × kVA (não multiplica diárias)
  const totalKva = salas.reduce(
    (acc, s) =>
      acc +
      (s.itens || []).reduce(
        (a: number, i: any) => a + (i.quantidade || 0) * (i.item?.kva || 0),
        0
      ),
    0
  );

  const endereco = empresa
    ? [
        [empresa.rua, empresa.numero].filter(Boolean).join(", "),
        empresa.bairro,
        [empresa.cidade, empresa.estado].filter(Boolean).join(" - "),
        empresa.cep ? `CEP ${empresa.cep}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Barra de ações (não sai na impressão) */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          Orçamento #{orc.numero} — visualização de impressão
        </p>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Imprimir / Salvar PDF
        </button>
      </div>

      {/* Folha A4 */}
      <div className="mx-auto my-6 print:my-0 bg-white shadow print:shadow-none w-[210mm] min-h-[297mm] p-[12mm] text-[11px] leading-snug text-slate-900">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            {empresa?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={empresa.logoUrl}
                alt=""
                className="h-16 w-auto object-contain"
              />
            )}
            <div>
              <p className="text-[14px] font-bold">{empresa?.name}</p>
              {empresa?.cnpj && <p>CNPJ: {empresa.cnpj}</p>}
              {endereco && <p>{endereco}</p>}
              <p>
                {[empresa?.telefone, empresa?.email, empresa?.site]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[16px] font-bold">ORÇAMENTO</p>
            <p className="text-[14px] font-bold text-slate-700">Nº {orc.numero}</p>
            <p>Emissão: {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        {/* Cliente + Evento */}
        <div className="grid grid-cols-2 gap-4 mt-3 border border-slate-300 rounded p-3">
          <div>
            <p className="font-bold uppercase text-slate-500 text-[9px] mb-1">Cliente</p>
            <p className="font-semibold text-[12px]">{orc.cliente?.nomeFantasia}</p>
            {orc.cliente?.razaoSocial &&
              orc.cliente.razaoSocial !== orc.cliente.nomeFantasia && (
                <p>{orc.cliente.razaoSocial}</p>
              )}
          </div>
          <div>
            <p className="font-bold uppercase text-slate-500 text-[9px] mb-1">Evento</p>
            <p className="font-semibold text-[12px]">{orc.eventoNome || "—"}</p>
            <p>
              {orc.tipoEvento ? `${orc.tipoEvento} · ` : ""}
              {fmtData(orc.dataInicio)}
              {orc.dataFim ? ` a ${fmtData(orc.dataFim)}` : ""}
            </p>
            {orc.dataMontagem && <p>Montagem: {fmtData(orc.dataMontagem)}</p>}
            {orc.local?.nome && <p>Local: {orc.local.nome}</p>}
          </div>
        </div>

        {/* Salas */}
        {salas.map((sala: any, si: number) => {
          const subtotalSala = (sala.itens || []).reduce(
            (a: number, i: any) =>
              a + (i.quantidade || 0) * (i.diarias || 1) * (i.valorUnitario || 0),
            0
          );
          return (
            <div key={si} className="mt-4">
              <p className="bg-slate-800 text-white font-bold px-2 py-1 text-[11px] uppercase">
                {sala.nome}
              </p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[9px] uppercase text-slate-600">
                    <th className="border border-slate-300 px-1.5 py-1 text-center w-10">Qtd</th>
                    <th className="border border-slate-300 px-1.5 py-1 text-left">Descrição</th>
                    <th className="border border-slate-300 px-1.5 py-1 text-center w-14">Diárias</th>
                    <th className="border border-slate-300 px-1.5 py-1 text-right w-20">Valor Unit.</th>
                    <th className="border border-slate-300 px-1.5 py-1 text-right w-24">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(sala.itens || []).map((i: any, ii: number) => (
                    <tr key={ii}>
                      <td className="border border-slate-300 px-1.5 py-1 text-center">
                        {i.quantidade}
                      </td>
                      <td className="border border-slate-300 px-1.5 py-1">
                        {i.item?.nome}
                        {(i.descricaoComercial || i.item?.descricaoComercial) && (
                          <span className="italic text-slate-500">
                            {" — "}
                            {i.descricaoComercial || i.item?.descricaoComercial}
                          </span>
                        )}
                      </td>
                      <td className="border border-slate-300 px-1.5 py-1 text-center">
                        {i.diarias || 1}
                      </td>
                      <td className="border border-slate-300 px-1.5 py-1 text-right">
                        {fmtValor(i.valorUnitario || 0)}
                      </td>
                      <td className="border border-slate-300 px-1.5 py-1 text-right">
                        {fmtValor(
                          (i.quantidade || 0) * (i.diarias || 1) * (i.valorUnitario || 0)
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={4} className="border border-slate-300 px-1.5 py-1 text-right">
                      Subtotal {sala.nome}
                    </td>
                    <td className="border border-slate-300 px-1.5 py-1 text-right">
                      {fmtValor(subtotalSala)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Totais */}
        <div className="flex justify-end mt-4">
          <table className="w-64">
            <tbody>
              <tr>
                <td className="px-2 py-0.5 text-right text-slate-600">Subtotal:</td>
                <td className="px-2 py-0.5 text-right font-medium">{fmtValor(bruto)}</td>
              </tr>
              {descontoValor > 0 && (
                <tr>
                  <td className="px-2 py-0.5 text-right text-slate-600">
                    Desconto
                    {orc.descontoTipo === "percentual" ? ` (${desconto}%)` : ""}:
                  </td>
                  <td className="px-2 py-0.5 text-right font-medium text-red-600">
                    − {fmtValor(descontoValor)}
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-800">
                <td className="px-2 py-1 text-right font-bold text-[13px]">TOTAL:</td>
                <td className="px-2 py-1 text-right font-bold text-[13px]">
                  {fmtValor(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Carga elétrica */}
        {totalKva > 0 && (
          <div className="mt-3 border border-slate-300 rounded p-2 bg-slate-50">
            <p className="font-bold text-[10px] uppercase text-slate-600">
              Carga elétrica estimada
            </p>
            <p className="text-[12px] font-semibold">
              {totalKva.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kVA
              <span className="text-slate-500 font-normal text-[10px]">
                {" "}
                (soma de kVA × quantidade dos equipamentos)
              </span>
            </p>
          </div>
        )}

        {/* Pagamento e observações */}
        {(orc.formaPagamento || orc.condicoes) && (
          <div className="mt-3">
            <p className="font-bold text-[10px] uppercase text-slate-600">Pagamento</p>
            <p>
              {[orc.formaPagamento, orc.condicoes].filter(Boolean).join(" — ")}
            </p>
          </div>
        )}
        {orc.observacoes && (
          <div className="mt-3">
            <p className="font-bold text-[10px] uppercase text-slate-600">Observações</p>
            <p className="whitespace-pre-wrap">{orc.observacoes}</p>
          </div>
        )}
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
