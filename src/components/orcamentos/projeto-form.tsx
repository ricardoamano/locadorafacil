"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { mdParaHtml } from "@/lib/markdown";
import { Sparkles, Eye, PencilLine, Printer } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Orçamento de Projeto Especial: proposta em texto livre (Markdown) colada
// do Claude/Word — mesma numeração dos orçamentos e mesmos fluxos de
// aprovação (OS + receita no financeiro).

const statusOptions = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "AGUARDANDO", label: "Aguardando aprovação" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "RECUSADO", label: "Recusado" },
  { value: "CANCELADO", label: "Cancelado" },
];

function parseValor(v: string): number {
  if (!v) return 0;
  if (v.includes(",")) return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
  return parseFloat(v) || 0;
}

export function ProjetoForm({ orcamento }: { orcamento?: any }) {
  const router = useRouter();
  const { toast } = useToast();
  const editando = Boolean(orcamento?.id);

  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState(orcamento?.clienteId || "");
  const [status, setStatus] = useState(orcamento?.status || "PENDENTE");
  const [nome, setNome] = useState(orcamento?.eventoNome || "");
  const [dataInicio, setDataInicio] = useState(orcamento?.dataInicio?.slice(0, 10) || "");
  const [dataFim, setDataFim] = useState(orcamento?.dataFim?.slice(0, 10) || "");
  const [valor, setValor] = useState(
    orcamento?.valorProjeto != null ? String(orcamento.valorProjeto).replace(".", ",") : ""
  );
  const [desconto, setDesconto] = useState(
    orcamento?.desconto != null ? String(orcamento.desconto).replace(".", ",") : ""
  );
  const [descontoTipo, setDescontoTipo] = useState(orcamento?.descontoTipo || "valor");
  const [formaPagamento, setFormaPagamento] = useState(orcamento?.formaPagamento || "");
  const [condicoes, setCondicoes] = useState(orcamento?.condicoes || "");
  const [conteudo, setConteudo] = useState(orcamento?.conteudoProjeto || "");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/contacts?type=CLIENTE&limit=200")
      .then((r) => r.json())
      .then((d) => setClientes(d.contacts || []))
      .catch(() => {});
  }, []);

  const valorNum = parseValor(valor);
  const descNum = parseValor(desconto);
  const total = Math.max(
    0,
    valorNum - (descontoTipo === "percentual" ? (valorNum * descNum) / 100 : descNum)
  );

  async function salvar() {
    if (!clienteId) return toast("Selecione o cliente.", "error");
    if (!nome.trim()) return toast("Dê um nome ao projeto.", "error");
    if (!conteudo.trim()) return toast("Cole ou escreva o conteúdo da proposta.", "error");

    setSaving(true);
    try {
      const body = {
        projetoEspecial: true,
        clienteId,
        status,
        eventoNome: nome.trim(),
        dataInicio: dataInicio || null,
        dataFim: dataFim || null,
        valorProjeto: valorNum,
        desconto: desconto ? descNum : null,
        descontoTipo,
        formaPagamento: formaPagamento || null,
        condicoes: condicoes || null,
        conteudoProjeto: conteudo,
        salas: [],
      };
      const res = await fetch(
        editando ? `/api/orcamentos/${orcamento.id}` : "/api/orcamentos",
        {
          method: editando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.vinculos?.criouOs) {
        toast("Projeto aprovado! OS e receita geradas automaticamente. 🎉", "success");
      } else {
        toast(editando ? "Projeto atualizado!" : `Projeto criado — orçamento #${d.numero}!`, "success");
      }
      router.push("/orcamentos");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  const clienteOptions = clientes.map((c) => ({ value: c.id, label: c.nomeFantasia }));

  return (
    <div className="max-w-4xl space-y-4">
      <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Projeto Especial {editando ? `— Orçamento #${orcamento.numero}` : ""}
          </h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Proposta em texto livre (desenvolvimento de aplicativos, jogos, projetos sob
          medida). Usa a mesma numeração dos orçamentos e, ao aprovar, gera OS e receita no
          financeiro automaticamente.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Cliente *"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            options={clienteOptions}
            placeholder="Selecione o cliente"
            searchable
          />
          <Input
            label="Nome do projeto *"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Desenvolvimento de aplicativo de credenciamento"
          />
          <Input
            label="Início (opcional)"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
          <Input
            label="Entrega/Fim (opcional)"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
      </div>

      {/* Conteúdo da proposta */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Conteúdo da proposta</h3>
            <p className="text-xs text-slate-400">
              Cole aqui o texto (do Claude, Word ou qualquer lugar). Aceita Markdown: #
              títulos, **negrito**, listas com -, tabelas com | e linhas com ---.
            </p>
          </div>
          <button
            onClick={() => setPreview((p) => !p)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              preview
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
            }`}
          >
            {preview ? <PencilLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {preview ? "Voltar a editar" : "Ver como vai ficar"}
          </button>
        </div>

        {preview ? (
          <div
            className="proposta-md rounded-lg border border-slate-100 bg-slate-50/50 p-5 text-sm"
            dangerouslySetInnerHTML={{ __html: mdParaHtml(conteudo || "*Nada ainda...*") }}
          />
        ) : (
          <Textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={18}
            placeholder={"# Proposta — Aplicativo XYZ\n\n## Escopo\n- Levantamento de requisitos\n- Design das telas\n- Desenvolvimento iOS e Android\n\n## Cronograma\n| Etapa | Prazo |\n|---|---|\n| Design | 2 semanas |\n| Desenvolvimento | 6 semanas |\n\n## Investimento\nConforme resumo ao final da proposta."}
            className="font-mono text-xs"
          />
        )}
      </div>

      {/* Valores e condições */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Valores e condições</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Input
            label="Valor do projeto (R$) *"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="25.000,00"
          />
          <Input
            label="Desconto"
            value={desconto}
            onChange={(e) => setDesconto(e.target.value)}
            placeholder="0,00"
          />
          <Select
            label="Tipo de desconto"
            value={descontoTipo}
            onChange={(e) => setDescontoTipo(e.target.value)}
            options={[
              { value: "valor", label: "R$" },
              { value: "percentual", label: "%" },
            ]}
          />
          <div className="flex flex-col justify-end">
            <p className="text-xs text-slate-400 mb-1">Total</p>
            <p className="text-lg font-bold text-slate-900">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <Input
            label="Forma de pagamento"
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
            placeholder="Ex: 50% na assinatura, 50% na entrega"
          />
          <Input
            label="Condições / validade"
            value={condicoes}
            onChange={(e) => setCondicoes(e.target.value)}
            placeholder="Ex: Proposta válida por 15 dias"
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="w-56">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={statusOptions}
          />
        </div>
        <div className="flex items-center gap-3">
          {editando && (
            <a
              href={`/orcamentos/${orcamento.id}/imprimir-projeto`}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:border-purple-300 hover:text-purple-700 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </a>
          )}
          <Button variant="outline" onClick={() => router.push("/orcamentos")} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving}>
            {editando ? "Salvar Projeto" : "Criar Projeto"}
          </Button>
        </div>
      </div>

      {/* Estilos do preview (mesma cara do PDF) */}
      <style jsx global>{`
        .proposta-md h1 { font-size: 1.35rem; font-weight: 800; color: #4b2a66; margin: 0.75rem 0 0.5rem; }
        .proposta-md h2 { font-size: 1.1rem; font-weight: 700; color: #4b2a66; margin: 1rem 0 0.4rem; border-bottom: 2px solid #ede9f4; padding-bottom: 0.2rem; }
        .proposta-md h3 { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0.8rem 0 0.3rem; }
        .proposta-md h4 { font-size: 0.9rem; font-weight: 700; color: #334155; margin: 0.6rem 0 0.25rem; }
        .proposta-md p { margin: 0.4rem 0; color: #334155; line-height: 1.55; }
        .proposta-md ul, .proposta-md ol { margin: 0.4rem 0 0.6rem 1.4rem; color: #334155; }
        .proposta-md ul { list-style: disc; }
        .proposta-md ol { list-style: decimal; }
        .proposta-md li { margin: 0.15rem 0; line-height: 1.5; }
        .proposta-md table { width: 100%; border-collapse: collapse; margin: 0.6rem 0; }
        .proposta-md th { background: #4b2a66; color: #fff; text-align: left; padding: 6px 10px; font-size: 0.8rem; }
        .proposta-md td { border: 1px solid #e2e8f0; padding: 5px 10px; font-size: 0.85rem; color: #334155; }
        .proposta-md tr:nth-child(even) td { background: #faf9fc; }
        .proposta-md blockquote { border-left: 3px solid #4b2a66; padding: 0.3rem 0.9rem; margin: 0.6rem 0; color: #64748b; font-style: italic; background: #faf9fc; }
        .proposta-md hr { border: none; border-top: 1px solid #e2e8f0; margin: 1rem 0; }
        .proposta-md code { background: #f1f5f9; border-radius: 4px; padding: 1px 5px; font-size: 0.85em; }
        .proposta-md a { color: #6d28d9; text-decoration: underline; }
        .proposta-md strong { color: #1e293b; }
      `}</style>
    </div>
  );
}
