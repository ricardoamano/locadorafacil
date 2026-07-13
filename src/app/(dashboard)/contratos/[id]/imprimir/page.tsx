"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { NaoEncontrado } from "@/components/ui/nao-encontrado";
import { mdParaHtml } from "@/lib/markdown";

/* eslint-disable @typescript-eslint/no-explicit-any */

// PDF do contrato — imprime a versão atual (ou uma versão específica via ?v=N),
// com nomeação do arquivo incluindo o número da versão.

function slugNome(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function ImprimirContratoPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const versaoParam = search.get("v");

  const [contrato, setContrato] = useState<any | null>(null);
  const [conteudo, setConteudo] = useState<string>("");
  const [versao, setVersao] = useState<number | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch(`/api/contratos/${id}`);
        if (!res.ok) throw new Error();
        const c = await res.json();
        setContrato(c);
        if (versaoParam && Number(versaoParam) !== c.versaoAtual) {
          const rv = await fetch(`/api/contratos/${id}/versoes/${versaoParam}`);
          if (!rv.ok) throw new Error();
          const v = await rv.json();
          setConteudo(v.conteudo || "");
          setVersao(v.numero);
        } else {
          setConteudo(c.conteudo || "");
          setVersao(c.versaoAtual);
        }
      } catch {
        setErro(true);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [id, versaoParam]);

  useEffect(() => {
    if (!contrato || !versao) return;
    const cliente = slugNome(contrato.cliente?.nomeFantasia || "CLIENTE");
    const num = contrato.orcamento?.numero ? `ORC${contrato.orcamento.numero}_` : "";
    document.title = `CONTRATO_${num}${cliente}_v${versao}`;
  }, [contrato, versao]);

  if (carregando)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  if (erro || !contrato)
    return (
      <NaoEncontrado
        mensagem="Contrato não encontrado"
        voltarHref="/contratos"
        voltarLabel="Voltar aos contratos"
      />
    );

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Barra de ações (não sai na impressão) */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{contrato.titulo}</p>
          <p className="text-xs text-slate-500">
            Versão v{versao}
            {versao !== contrato.versaoAtual && (
              <span className="text-amber-600 font-medium"> (versão antiga — a atual é v{contrato.versaoAtual})</span>
            )}
            {" · "}Use “Salvar como PDF” na impressão.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </button>
      </div>

      {/* Documento */}
      <div className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none my-6 print:my-0 px-10 py-10 print:px-0 print:py-0">
        <div
          className="proposta-md contrato-print text-[13px] leading-relaxed text-slate-900"
          dangerouslySetInnerHTML={{ __html: mdParaHtml(conteudo) }}
        />
        <p className="mt-10 pt-3 border-t border-slate-200 text-[10px] text-slate-400 flex justify-between">
          <span>{contrato.titulo}</span>
          <span>v{versao} · gerado em {new Date().toLocaleDateString("pt-BR")}</span>
        </p>
      </div>
    </div>
  );
}
