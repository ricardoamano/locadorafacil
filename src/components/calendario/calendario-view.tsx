"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

const statusConfig: Record<
  string,
  { label: string; dot: string; chip: string }
> = {
  APROVADO: {
    label: "Aprovado",
    dot: "bg-green-500",
    chip: "bg-green-100 text-green-800 hover:bg-green-200",
  },
  AGUARDANDO: {
    label: "Aguardando",
    dot: "bg-amber-400",
    chip: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  },
  PENDENTE: {
    label: "Pendente",
    dot: "bg-blue-400",
    chip: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  },
  REPROVADO: {
    label: "Reprovado",
    dot: "bg-red-500",
    chip: "bg-red-100 text-red-800 hover:bg-red-200",
  },
  CANCELADO: {
    label: "Cancelado",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600 hover:bg-slate-200",
  },
};

interface Evento {
  id: string;
  numero: number;
  status: string;
  eventoNome: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  cliente: { nomeFantasia: string };
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function CalendarioView() {
  const router = useRouter();
  const { toast } = useToast();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<Record<string, boolean>>({
    APROVADO: true,
    AGUARDANDO: true,
    PENDENTE: true,
    REPROVADO: true,
    CANCELADO: false,
  });

  useEffect(() => {
    setLoading(true);
    fetch("/api/orcamentos?limit=200")
      .then((r) => r.json())
      .then((d) => setEventos((d.orcamentos || []).filter((o: Evento) => o.dataInicio)))
      .catch(() => toast("Erro ao carregar eventos.", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  const ano = cursor.getFullYear();
  const mes = cursor.getMonth();

  // Mapa dia -> eventos (evento aparece em todos os dias entre início e fim)
  const eventosPorDia = useMemo(() => {
    const map: Record<string, Evento[]> = {};
    for (const ev of eventos) {
      if (!ev.dataInicio) continue;
      if (!filtros[ev.status]) continue;
      const ini = new Date(ev.dataInicio);
      const fim = ev.dataFim ? new Date(ev.dataFim) : ini;
      const d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate());
      const end = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
      let guard = 0;
      while (d <= end && guard < 62) {
        const key = ymd(d);
        (map[key] = map[key] || []).push(ev);
        d.setDate(d.getDate() + 1);
        guard++;
      }
    }
    return map;
  }, [eventos, filtros]);

  // Grade do mês
  const dias = useMemo(() => {
    const first = new Date(ano, mes, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(ano, mes + 1, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ date: new Date(ano, mes, -i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(ano, mes, d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const lastDate = cells[cells.length - 1].date;
      cells.push({
        date: new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 1),
        inMonth: false,
      });
    }
    return cells;
  }, [ano, mes]);

  const hojeKey = ymd(new Date());

  return (
    <div>
      {/* Controles */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date(ano, mes - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-slate-900 min-w-44 text-center">
            {MESES[mes]} {ano}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date(ano, mes + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            Hoje
          </Button>
        </div>

        {/* Legenda / filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <label
              key={key}
              className="flex items-center gap-1.5 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={!!filtros[key]}
                onChange={(e) =>
                  setFiltros((p) => ({ ...p, [key]: e.target.checked }))
                }
                className="h-3.5 w-3.5 rounded"
              />
              <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
              <span className="text-xs text-slate-600">{cfg.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Calendário */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
              {DIAS_SEMANA.map((d) => (
                <div
                  key={d}
                  className="px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {dias.map(({ date, inMonth }, i) => {
                const key = ymd(date);
                const evts = eventosPorDia[key] || [];
                const isToday = key === hojeKey;
                return (
                  <div
                    key={i}
                    className={`min-h-24 border-b border-r border-slate-50 p-1.5 ${
                      inMonth ? "bg-white" : "bg-slate-50/60"
                    }`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        isToday
                          ? "bg-blue-600 text-white"
                          : inMonth
                          ? "text-slate-700"
                          : "text-slate-300"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <div className="mt-1 space-y-1">
                      {evts.slice(0, 3).map((ev) => {
                        const cfg = statusConfig[ev.status] || statusConfig.PENDENTE;
                        return (
                          <button
                            key={ev.id + key}
                            onClick={() => router.push(`/orcamentos/${ev.id}`)}
                            className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium truncate transition-colors ${cfg.chip}`}
                            title={`#${ev.numero} · ${ev.cliente?.nomeFantasia}${
                              ev.eventoNome ? ` · ${ev.eventoNome}` : ""
                            }`}
                          >
                            {ev.eventoNome || ev.cliente?.nomeFantasia || `#${ev.numero}`}
                          </button>
                        );
                      })}
                      {evts.length > 3 && (
                        <p className="text-[10px] text-slate-400 px-1">
                          +{evts.length - 3} mais
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {!loading && eventos.length === 0 && (
        <div className="flex flex-col items-center gap-2 text-slate-400 mt-6">
          <CalendarDays className="h-8 w-8" />
          <p className="text-sm">
            Nenhum evento com data cadastrada. Crie orçamentos com data de início
            para vê-los aqui.
          </p>
        </div>
      )}
    </div>
  );
}
