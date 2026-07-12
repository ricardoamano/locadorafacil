"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

function fmtValor(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtData(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function AprovarOrcamentoPage() {
  const params = useParams<{ token: string }>();
  const [dados, setDados] = useState<any | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aprovado, setAprovado] = useState(false);

  useEffect(() => {
    if (!params?.token) return;
    fetch(`/api/aprovacao/${params.token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setErro(d.error || "Link inválido.");
          return;
        }
        setDados(d);
        if (d.status === "APROVADO") setAprovado(true);
      })
      .catch(() => setErro("Erro ao carregar o orçamento."))
      .finally(() => setLoading(false));
  }, [params?.token]);

  async function aprovar() {
    setEnviando(true);
    try {
      const res = await fetch(`/api/aprovacao/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, aceite }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErro(d.error || "Erro ao aprovar.");
        return;
      }
      setErro("");
      setAprovado(true);
    } catch {
      setErro("Erro ao aprovar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );

  if (!dados)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-slate-500 text-sm">{erro || "Link inválido ou expirado."}</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Cabeçalho */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-4">
          {dados.empresa?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dados.empresa.logoUrl}
              alt=""
              className="h-14 w-auto object-contain"
            />
          )}
          <div>
            <p className="text-lg font-bold text-slate-900">{dados.empresa?.name}</p>
            <p className="text-sm text-slate-500">
              Orçamento nº {dados.numero}
              {dados.evento ? ` — ${dados.evento}` : ""}
            </p>
          </div>
        </div>

        {/* Resumo */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <p>
              <span className="text-slate-400">Cliente: </span>
              <span className="font-medium text-slate-800">
                {dados.cliente}
                {dados.cliente2 ? `, ${dados.cliente2}` : ""}
              </span>
            </p>
            <p>
              <span className="text-slate-400">Período: </span>
              <span className="font-medium text-slate-800">
                {fmtData(dados.dataInicio)}
                {dados.dataFim ? ` a ${fmtData(dados.dataFim)}` : ""}
              </span>
            </p>
            {dados.local && (
              <p>
                <span className="text-slate-400">Local: </span>
                <span className="font-medium text-slate-800">{dados.local}</span>
              </p>
            )}
            {dados.tipoEvento && (
              <p>
                <span className="text-slate-400">Tipo: </span>
                <span className="font-medium text-slate-800">{dados.tipoEvento}</span>
              </p>
            )}
          </div>

          {dados.salas.map((sala: any, si: number) => (
            <div key={si}>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 rounded px-2 py-1 mb-1">
                {sala.nome}
              </p>
              <ul className="divide-y divide-slate-50 text-sm">
                {sala.itens.map((i: any, ii: number) => (
                  <li key={ii} className="flex items-center justify-between py-1.5 gap-3">
                    <span className="text-slate-700">
                      {i.quantidade}x {i.nome}
                      {i.descricao && (
                        <span className="text-slate-400 italic"> — {i.descricao}</span>
                      )}
                      {!i.servico && i.diarias > 1 && (
                        <span className="text-slate-400"> · {i.diarias} diárias</span>
                      )}
                    </span>
                    <span className="font-medium text-slate-800 whitespace-nowrap">
                      {fmtValor(i.subtotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="border-t border-slate-100 pt-3 text-sm space-y-1">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{fmtValor(dados.bruto)}</span>
            </div>
            {dados.descontoValor > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>
                  Desconto{dados.descontoTipo === "percentual" ? ` (${dados.desconto}%)` : ""}
                </span>
                <span className="text-red-500">− {fmtValor(dados.descontoValor)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-slate-900">
              <span>Total</span>
              <span>{fmtValor(dados.total)}</span>
            </div>
          </div>

          {(dados.formaPagamento || dados.condicoes) && (
            <p className="text-xs text-slate-500">
              <span className="font-semibold">Pagamento: </span>
              {[dados.formaPagamento, dados.condicoes].filter(Boolean).join(" — ")}
            </p>
          )}
          {dados.observacoes && (
            <p className="text-xs text-slate-500 whitespace-pre-wrap">
              <span className="font-semibold">Observações: </span>
              {dados.observacoes}
            </p>
          )}
        </div>

        {/* Aprovação */}
        {aprovado ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
            <p className="text-lg font-bold text-green-800">Orçamento aprovado! 🎉</p>
            <p className="text-sm text-green-700 mt-1">
              {dados.aprovadoOnlinePor
                ? `Aprovado por ${dados.aprovadoOnlinePor} em ${new Date(
                    dados.aprovadoOnlineEm
                  ).toLocaleString("pt-BR")}.`
                : "A equipe já foi notificada e dará sequência ao seu evento."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              Aprovar este orçamento
            </p>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo *"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="h-4 w-4 rounded mt-0.5"
              />
              Declaro que li e aceito os itens, valores e condições deste orçamento.
              A aprovação registra meu nome, data/hora e endereço IP.
            </label>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            <button
              onClick={aprovar}
              disabled={enviando || !nome.trim() || !aceite}
              className="w-full h-11 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {enviando ? "Aprovando..." : "✓ Aprovar orçamento"}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          {dados.empresa?.name}
          {dados.empresa?.telefone ? ` · ${dados.empresa.telefone}` : ""}
          {dados.empresa?.email ? ` · ${dados.empresa.email}` : ""}
        </p>
      </div>
    </div>
  );
}
