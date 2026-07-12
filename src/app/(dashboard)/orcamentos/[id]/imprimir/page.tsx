"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { NaoEncontrado } from "@/components/ui/nao-encontrado";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ROXO = "#4b2a66";

function fmtData(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtValor(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function ddMes(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}${MESES[dt.getMonth()]}`;
}

function slugNome(nome: string) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Padrão: COD_CLIENTE1_CLIENTE2_DATA EMISSAO_INICIOaFIM_VERSAO
// Ex.: 1817_GAEL_COMUNICACAO_030726_08Jula08Jul_v1
function nomeArquivo(orc: any) {
  // Cliente 1 primeiro, depois Cliente 2 — mesma ordem da exibição
  const cliente = [
    slugNome(orc.cliente?.nomeFantasia || "CLIENTE"),
    orc.cliente2 ? slugNome(orc.cliente2.nomeFantasia) : "",
  ]
    .filter(Boolean)
    .join("_");
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

function Rotulo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="leading-relaxed">
      <span className="font-bold">{label}: </span>
      {children}
    </p>
  );
}

export default function ImprimirOrcamentoPage() {
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

  // O navegador usa o título da página como nome do PDF ao salvar
  useEffect(() => {
    if (orc) document.title = nomeArquivo(orc);
  }, [orc]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!orc) {
    return <NaoEncontrado mensagem="Orçamento não encontrado." voltarHref="/orcamentos" voltarLabel="Voltar para Orçamentos" />;
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

  // Carga elétrica total: quantidade × kVA (não multiplica diárias)
  const totalKva = salas.reduce(
    (acc, s) =>
      acc +
      (s.itens || []).reduce(
        (a: number, i: any) => a + (i.quantidade || 0) * (i.item?.kva || 0),
        0
      ),
    0
  );

  const contato = orc.contato || orc.cliente?.subContacts?.[0] || null;
  const contato2 = orc.contato2 || orc.cliente2?.subContacts?.[0] || null;
  // Com dois clientes, exibe em linha única na ordem cadastrada: Cliente 1, Cliente 2
  const nomeClientes = orc.cliente2
    ? `${orc.cliente?.nomeFantasia}, ${orc.cliente2.nomeFantasia}`
    : orc.cliente?.nomeFantasia;
  const dataOrc = orc.createdAt ? new Date(orc.createdAt) : new Date();
  const validade = new Date(dataOrc);
  validade.setDate(validade.getDate() + 10);

  const enderecoLocal = orc.local
    ? [
        [orc.local.rua, orc.local.numero].filter(Boolean).join(" "),
        orc.local.bairro,
        [orc.local.cidade, orc.local.estado].filter(Boolean).join(", "),
      ]
        .filter(Boolean)
        .join(", ")
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
      <div className="mx-auto my-6 print:my-0 bg-white shadow print:shadow-none w-[210mm] min-h-[297mm] px-[14mm] py-[10mm] text-[10.5px] leading-snug text-slate-800 flex flex-col">
        <div className="flex-1">
          {/* Cabeçalho: logo + vendedor */}
          <div className="flex items-start justify-between pt-2">
            <div>
              {empresa?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={empresa.logoUrl} alt={empresa?.name || ""} className="h-20 w-auto object-contain" />
              ) : (
                <p className="text-[18px] font-bold">{empresa?.name}</p>
              )}
            </div>
            <div className="pt-2">
              <Rotulo label="Vendedor">{me?.name || "—"}</Rotulo>
              <Rotulo label="E-mail">{me?.email || empresa?.email || "—"}</Rotulo>
              <Rotulo label="Telefone">{empresa?.telefone || "—"}</Rotulo>
            </div>
          </div>

          {/* Cliente × Orçamento */}
          <div className="flex items-start justify-between mt-6">
            <div>
              <Rotulo label="Cliente">{nomeClientes}</Rotulo>
              {contato?.nome && <Rotulo label="Contato">{contato.nome}</Rotulo>}
              {contato?.telefone && <Rotulo label="Telefone">{contato.telefone}</Rotulo>}
              {contato?.email && <Rotulo label="E-mail">{contato.email}</Rotulo>}
              {orc.cliente2 && contato2?.nome && (
                <Rotulo label="Contato (cliente 2)">
                  {contato2.nome}
                  {contato2.telefone ? ` — ${contato2.telefone}` : ""}
                </Rotulo>
              )}
            </div>
            <div>
              <Rotulo label="Orçamento">{orc.numero}</Rotulo>
              <Rotulo label="Data">{fmtData(orc.createdAt)}</Rotulo>
              <Rotulo label="Validade">{validade.toLocaleDateString("pt-BR")}</Rotulo>
            </div>
          </div>

          {/* Evento × Datas */}
          <div className="flex items-start justify-between mt-4">
            <div className="max-w-[110mm]">
              <Rotulo label="Evento">{orc.eventoNome || "—"}</Rotulo>
              {orc.local?.nome && <Rotulo label="Local">{orc.local.nome}</Rotulo>}
              {enderecoLocal && <Rotulo label="Endereço">{enderecoLocal}</Rotulo>}
            </div>
            <div>
              <Rotulo label="Início">{fmtData(orc.dataInicio)}</Rotulo>
              <Rotulo label="Término">{fmtData(orc.dataFim)}</Rotulo>
              {orc.dataMontagem && (
                <Rotulo label="Montagem">{fmtData(orc.dataMontagem)}</Rotulo>
              )}
            </div>
          </div>

          {/* Salas */}
          {salas.map((sala: any, si: number) => {
            const subtotalSala = (sala.itens || []).reduce(
              (a: number, i: any) =>
                a + (i.quantidade || 0) * (i.diarias || 1) * (i.valorUnitario || 0),
              0
            );
            const wattsSala = (sala.itens || []).reduce(
              (a: number, i: any) => a + (i.quantidade || 0) * (i.item?.watts || 0),
              0
            );
            return (
              <div key={si} className="mt-7" style={{ breakInside: "avoid" }}>
                <p className="text-[14px] font-bold text-slate-900 mb-2">{sala.nome}</p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-white text-[10.5px]" style={{ backgroundColor: ROXO }}>
                      <th className="px-3 py-2 text-left font-bold w-28 rounded-l-sm">Categoria</th>
                      <th className="px-3 py-2 text-left font-bold">Item</th>
                      <th className="px-3 py-2 text-center font-bold w-24">Quantidade</th>
                      <th className="px-3 py-2 text-center font-bold w-16">Diária</th>
                      <th className="px-3 py-2 text-right font-bold w-24 rounded-r-sm">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sala.itens || []).map((i: any, ii: number) => (
                      <tr key={ii} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-[9px] text-slate-500">
                          {i.item?.categoria?.nome || "N/A"}
                        </td>
                        <td className="px-3 py-2">
                          {i.item?.nome}
                          {(i.descricaoComercial || i.item?.descricaoComercial) && (
                            <span className="italic text-slate-500">
                              {" — "}
                              {i.descricaoComercial || i.item?.descricaoComercial}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">{i.quantidade}</td>
                        <td className="px-3 py-2 text-center">
                          {i.item?.natureza === "SERVICO" ? "—" : i.diarias || 1}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {fmtValor(
                            (i.quantidade || 0) * (i.diarias || 1) * (i.valorUnitario || 0)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-end justify-between mt-2">
                  <p className="text-[8px] text-slate-400">
                    {wattsSala > 0
                      ? `Consumo estimado dos equipamentos em potência máxima: ${wattsSala.toLocaleString("pt-BR")} Watts (${(wattsSala / 800).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kVA)`
                      : ""}
                  </p>
                  <p>
                    <span className="font-bold mr-4">Sub Total</span>
                    <span className="font-bold text-[12px]">{fmtValor(subtotalSala)}</span>
                  </p>
                </div>
              </div>
            );
          })}

          {/* Totais */}
          <div className="flex justify-end mt-10" style={{ breakInside: "avoid" }}>
            <div className="w-72">
              <div className="flex items-center justify-between py-0.5">
                <span className="font-bold">Total:</span>
                <span className="font-bold">{fmtValor(bruto)}</span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="font-bold">Desconto:</span>
                <span className="font-bold">
                  {descontoValor > 0
                    ? `${orc.descontoTipo === "percentual" ? `(${desconto}%) ` : ""}${fmtValor(descontoValor)}`
                    : "R$ ()"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 mt-1">
                <span className="font-bold text-[15px]">TOTAL:</span>
                <span className="font-bold text-[15px]">{fmtValor(total)}</span>
              </div>
            </div>
          </div>

          {/* Carga elétrica total */}
          {totalKva > 0 && (
            <p className="mt-4 text-[9px] text-slate-500">
              Carga elétrica total estimada do orçamento:{" "}
              <span className="font-bold text-slate-700">
                {totalKva.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kVA
              </span>{" "}
              (kVA × quantidade dos equipamentos)
            </p>
          )}

          {/* Observações */}
          <div className="mt-8">
            <p className="font-bold text-[12px]">Observações:</p>
            {orc.observacoes && (
              <p className="whitespace-pre-wrap mt-1">{orc.observacoes}</p>
            )}
          </div>

          {/* Forma de pagamento */}
          <div className="mt-6" style={{ breakInside: "avoid" }}>
            <p className="font-bold text-[12px]">Forma de pagamento:</p>
            <p className="mt-0.5">
              {[orc.formaPagamento, orc.condicoes].filter(Boolean).join(" — ") ||
                "a definir"}
            </p>
          </div>
        </div>

        {/* Rodapé */}
        <p className="text-right text-[8px] text-slate-400 mt-8">
          Desenvolvido por <span className="text-blue-600">{empresa?.name || "LocadoraFácil"}</span>
        </p>
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
