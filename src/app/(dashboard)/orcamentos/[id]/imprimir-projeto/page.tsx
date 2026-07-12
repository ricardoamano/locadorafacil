"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { NaoEncontrado } from "@/components/ui/nao-encontrado";
import { mdParaHtml } from "@/lib/markdown";

/* eslint-disable @typescript-eslint/no-explicit-any */

// PDF do Orçamento de Projeto Especial — proposta em texto livre com o
// padrão visual da empresa (mesma família do PDF de orçamento por salas).

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function ddMes(d: string | Date) {
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")}${MESES[x.getMonth()]}`;
}

function slugNome(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function nomeArquivo(orc: any) {
  const cliente = slugNome(orc.cliente?.nomeFantasia || "CLIENTE");
  const emissao = orc.createdAt ? new Date(orc.createdAt) : new Date();
  const ddmmyy = `${String(emissao.getDate()).padStart(2, "0")}${String(
    emissao.getMonth() + 1
  ).padStart(2, "0")}${String(emissao.getFullYear()).slice(2)}`;
  const periodo =
    orc.dataInicio && orc.dataFim
      ? `${ddMes(orc.dataInicio)}a${ddMes(orc.dataFim)}`
      : orc.dataInicio
        ? ddMes(orc.dataInicio)
        : "";
  return [orc.numero, cliente, ddmmyy, periodo, "v1"].filter(Boolean).join("_");
}

function fmtValor(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtData(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : null;
}

export default function ImprimirProjetoPage() {
  const params = useParams<{ id: string }>();
  const [orc, setOrc] = useState<any | null>(null);
  const [empresa, setEmpresa] = useState<any | null>(null);
  const [me, setMe] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    Promise.all([
      fetch(`/api/orcamentos/${params.id}`).then((r) => r.json()),
      fetch("/api/empresa").then((r) => r.json()),
      fetch("/api/me").then((r) => r.json()),
    ])
      .then(([o, e, m]) => {
        setOrc(o?.id ? o : null);
        setEmpresa(e?.id ? e : null);
        setMe(m?.email ? m : null);
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => {
    if (orc) document.title = nomeArquivo(orc);
  }, [orc]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  if (!orc)
    return (
      <NaoEncontrado
        mensagem="Orçamento não encontrado."
        voltarHref="/orcamentos"
        voltarLabel="Voltar para Orçamentos"
      />
    );

  const validade = new Date(orc.createdAt);
  validade.setDate(validade.getDate() + 10);
  const itensSubtotal = (orc.salas || []).reduce(
    (acc: number, sl: any) =>
      acc + (sl.itens || []).reduce((a: number, i: any) => a + (i.subtotal || 0), 0),
    0
  );
  const brutoTotal = (orc.valorProjeto || 0) + itensSubtotal;
  const descontoValor =
    orc.desconto != null
      ? orc.descontoTipo === "percentual"
        ? (brutoTotal * orc.desconto) / 100
        : orc.desconto
      : 0;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          Proposta #{orc.numero} — {orc.eventoNome}
        </p>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Imprimir / Salvar PDF
        </button>
      </div>

      <div className="mx-auto my-6 print:my-0 bg-white shadow print:shadow-none w-[210mm] min-h-[297mm] px-[14mm] py-[12mm] text-[11px] leading-relaxed text-slate-800">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b-2 pb-4" style={{ borderColor: "#4b2a66" }}>
          <div className="flex items-center gap-3">
            {empresa?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logoUrl} alt="" className="h-16 w-auto object-contain" />
            )}
            <div>
              <p className="text-[14px] font-bold">{empresa?.name}</p>
              {empresa?.cnpj && <p className="text-slate-500">CNPJ: {empresa.cnpj}</p>}
              <p className="text-slate-500">
                {[empresa?.telefone, empresa?.email, empresa?.site].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[16px] font-extrabold" style={{ color: "#4b2a66" }}>
              PROPOSTA COMERCIAL
            </p>
            <p className="font-bold">Orçamento Nº {orc.numero}</p>
            <p className="text-slate-500">
              Emissão: {new Date(orc.createdAt).toLocaleDateString("pt-BR")}
            </p>
            <p className="text-slate-500">Validade: {validade.toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        {/* Cliente + projeto */}
        <div className="grid grid-cols-2 gap-4 mt-4 rounded border border-slate-200 p-4">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Cliente</p>
            <p className="font-bold text-[12px]">{orc.cliente?.nomeFantasia}</p>
            {orc.cliente?.razaoSocial && <p className="text-slate-500">{orc.cliente.razaoSocial}</p>}
            {orc.contato && (
              <p className="text-slate-500">
                A/C: {orc.contato.nome}
                {orc.contato.telefone ? ` · ${orc.contato.telefone}` : ""}
              </p>
            )}
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Projeto</p>
            <p className="font-bold text-[12px]">{orc.eventoNome}</p>
            {(fmtData(orc.dataInicio) || fmtData(orc.dataFim)) && (
              <p className="text-slate-500">
                {fmtData(orc.dataInicio) ? `Início: ${fmtData(orc.dataInicio)}` : ""}
                {fmtData(orc.dataFim) ? ` · Entrega: ${fmtData(orc.dataFim)}` : ""}
              </p>
            )}
            {orc.local?.nome && (
              <p className="text-slate-500">
                Local: {orc.local.nome}
                {[orc.local.rua, orc.local.numero, orc.local.cidade].filter(Boolean).length > 0
                  ? ` — ${[orc.local.rua, orc.local.numero, orc.local.cidade]
                      .filter(Boolean)
                      .join(", ")}`
                  : ""}
              </p>
            )}
            {me?.name && <p className="text-slate-500">Responsável: {me.name}</p>}
          </div>
        </div>

        {/* Conteúdo da proposta */}
        <div
          className="proposta-md mt-5"
          dangerouslySetInnerHTML={{ __html: mdParaHtml(orc.conteudoProjeto || "") }}
        />

        {/* Equipamentos e serviços do catálogo (lançados no sistema) */}
        {(orc.salas || []).some((sl: any) => (sl.itens || []).length > 0) && (
          <div className="mt-6" style={{ breakInside: "avoid" }}>
            <p
              className="text-white font-bold px-3 py-1.5 text-[11px] uppercase rounded-t"
              style={{ background: "#4b2a66" }}
            >
              Equipamentos e Serviços
            </p>
            <table className="w-full border-collapse border border-t-0 border-slate-200">
              <thead>
                <tr className="bg-[#faf9fc] text-[9px] uppercase text-slate-500">
                  <th className="border border-slate-200 px-2 py-1 text-left">Item</th>
                  <th className="border border-slate-200 px-2 py-1 w-12 text-center">Qtd</th>
                  <th className="border border-slate-200 px-2 py-1 w-14 text-center">Diárias</th>
                  <th className="border border-slate-200 px-2 py-1 w-24 text-right">Valor unit.</th>
                  <th className="border border-slate-200 px-2 py-1 w-24 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(orc.salas || []).flatMap((sl: any) =>
                  (sl.itens || []).map((i: any) => (
                    <tr key={i.id}>
                      <td className="border border-slate-200 px-2 py-1.5">
                        {i.item?.nome}
                        {i.descricaoComercial || i.item?.descricaoComercial ? (
                          <span className="text-slate-400 italic">
                            {" — "}
                            {i.descricaoComercial || i.item?.descricaoComercial}
                          </span>
                        ) : null}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center">
                        {i.quantidade}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center">
                        {i.item?.natureza === "SERVICO" ? "—" : i.diarias}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right">
                        {fmtValor(i.valorUnitario)}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-medium">
                        {fmtValor(i.subtotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Investimento */}
        <div className="mt-6" style={{ breakInside: "avoid" }}>
          <p
            className="text-white font-bold px-3 py-1.5 text-[11px] uppercase rounded-t"
            style={{ background: "#4b2a66" }}
          >
            Investimento
          </p>
          <div className="border border-t-0 border-slate-200 rounded-b p-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-1">
                {(orc.valorProjeto || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Projeto / desenvolvimento</span>
                    <span className="font-medium">{fmtValor(orc.valorProjeto)}</span>
                  </div>
                )}
                {itensSubtotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Equipamentos e serviços</span>
                    <span className="font-medium">{fmtValor(itensSubtotal)}</span>
                  </div>
                )}
                {descontoValor > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Desconto{orc.descontoTipo === "percentual" ? ` (${orc.desconto}%)` : ""}
                    </span>
                    <span className="font-medium">- {fmtValor(descontoValor)}</span>
                  </div>
                )}
                <div
                  className="flex justify-between border-t pt-1.5 text-[13px] font-extrabold"
                  style={{ borderColor: "#4b2a66", color: "#4b2a66" }}
                >
                  <span>TOTAL</span>
                  <span>{fmtValor(orc.total)}</span>
                </div>
              </div>
            </div>
            {(orc.formaPagamento || orc.condicoes) && (
              <div className="mt-3 pt-3 border-t border-slate-100 text-slate-600 space-y-0.5">
                {orc.formaPagamento && (
                  <p>
                    <span className="font-bold">Pagamento:</span> {orc.formaPagamento}
                  </p>
                )}
                {orc.condicoes && (
                  <p>
                    <span className="font-bold">Condições:</span> {orc.condicoes}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-8 text-center text-slate-400 text-[9.5px]" style={{ breakInside: "avoid" }}>
          <div className="mx-auto w-72 border-t border-slate-300 pt-2 text-slate-600">
            {empresa?.name}
            {me?.name ? ` — ${me.name}` : ""}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .proposta-md h1 { font-size: 17px; font-weight: 800; color: #4b2a66; margin: 12px 0 6px; }
        .proposta-md h2 { font-size: 14px; font-weight: 700; color: #4b2a66; margin: 14px 0 5px; border-bottom: 2px solid #ede9f4; padding-bottom: 3px; }
        .proposta-md h3 { font-size: 12px; font-weight: 700; color: #1e293b; margin: 10px 0 4px; }
        .proposta-md h4 { font-size: 11px; font-weight: 700; color: #334155; margin: 8px 0 3px; }
        .proposta-md p { margin: 5px 0; color: #334155; }
        .proposta-md ul, .proposta-md ol { margin: 5px 0 8px 18px; color: #334155; }
        .proposta-md ul { list-style: disc; }
        .proposta-md ol { list-style: decimal; }
        .proposta-md li { margin: 2px 0; }
        .proposta-md table { width: 100%; border-collapse: collapse; margin: 8px 0; break-inside: avoid; }
        .proposta-md th { background: #4b2a66; color: #fff; text-align: left; padding: 5px 8px; font-size: 10px; }
        .proposta-md td { border: 1px solid #e2e8f0; padding: 4px 8px; font-size: 10.5px; color: #334155; }
        .proposta-md tr:nth-child(even) td { background: #faf9fc; }
        .proposta-md blockquote { border-left: 3px solid #4b2a66; padding: 3px 12px; margin: 8px 0; color: #64748b; font-style: italic; background: #faf9fc; }
        .proposta-md hr { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
        .proposta-md code { background: #f1f5f9; border-radius: 3px; padding: 0 4px; }
        .proposta-md a { color: #6d28d9; text-decoration: underline; }
        @media print {
          aside, header, nav { display: none !important; }
          main { padding: 0 !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}
