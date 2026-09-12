"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

// Lista de divergências de uma importação, com a decisão por registro:
// manter o que está no sistema, atualizar com o que veio, ou criar como novo.

export type Decisao = "manter" | "atualizar" | "criar";

export interface DivergenciaUi {
  chave: string;
  titulo: string; // nome do registro que chegou
  existenteResumo: string;
  diffs: { campo: string; label: string; atual: string; novo: string }[];
}

interface Props {
  divergentes: DivergenciaUi[];
  decisoes: Record<string, Decisao>;
  onChange: (chave: string, d: Decisao) => void;
  onTodos?: (d: Decisao) => void;
  permitirCriar?: boolean; // "criar como novo" nem sempre faz sentido (ex.: código único)
}

const OPCOES: { valor: Decisao; label: string; dica: string }[] = [
  { valor: "manter", label: "Manter o do sistema", dica: "Ignora o que veio no arquivo" },
  { valor: "atualizar", label: "Atualizar com o arquivo", dica: "Sobrescreve os campos diferentes" },
  { valor: "criar", label: "Criar como novo", dica: "Vira um segundo registro" },
];

export function RevisaoDivergencias({
  divergentes,
  decisoes,
  onChange,
  onTodos,
  permitirCriar = true,
}: Props) {
  if (divergentes.length === 0) return null;
  const opcoes = permitirCriar ? OPCOES : OPCOES.filter((o) => o.valor !== "criar");
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-semibold text-amber-900 flex-1 min-w-40">
          {divergentes.length} registro{divergentes.length > 1 ? "s" : ""} já existe
          {divergentes.length > 1 ? "m" : ""} com dados diferentes — decida um a um
        </p>
        {onTodos && (
          <div className="flex gap-1 text-[11px]">
            <span className="text-amber-800">Todos:</span>
            {opcoes.map((o) => (
              <button
                key={o.valor}
                onClick={() => onTodos(o.valor)}
                className="underline text-amber-800 hover:text-amber-950"
              >
                {o.label.toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {divergentes.map((d) => {
          const atual = decisoes[d.chave] || "manter";
          return (
            <div key={d.chave} className="bg-white rounded-lg border border-slate-100 p-3">
              <p className="text-sm font-medium text-slate-900">{d.titulo}</p>
              <p className="text-[11px] text-slate-400 mb-2">No sistema: {d.existenteResumo}</p>
              <table className="w-full text-xs mb-2">
                <thead>
                  <tr className="text-slate-400">
                    <th className="text-left font-medium py-0.5">Campo</th>
                    <th className="text-left font-medium py-0.5">No sistema</th>
                    <th className="text-left font-medium py-0.5">No arquivo</th>
                  </tr>
                </thead>
                <tbody>
                  {d.diffs.map((f) => (
                    <tr key={f.campo} className="border-t border-slate-50">
                      <td className="py-1 text-slate-500">{f.label}</td>
                      <td className={`py-1 ${atual === "manter" ? "font-semibold text-slate-900" : "text-slate-500 line-through"}`}>
                        {f.atual || "—"}
                      </td>
                      <td className={`py-1 ${atual === "atualizar" || atual === "criar" ? "font-semibold text-emerald-700" : "text-slate-500"}`}>
                        {f.novo || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-1.5">
                {opcoes.map((o) => (
                  <button
                    key={o.valor}
                    type="button"
                    title={o.dica}
                    onClick={() => onChange(d.chave, o.valor)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      atual === o.valor
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
