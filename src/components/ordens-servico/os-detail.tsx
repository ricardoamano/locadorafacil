"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { OsConferencia } from "./os-conferencia";
import { OsNestor } from "./os-nestor";
import {
  User,
  CalendarDays,
  MapPin,
  Package,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

const statusOptions = [
  { value: "ABERTA", label: "Aberta" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "CONCLUIDA", label: "Concluída" },
  { value: "CANCELADA", label: "Cancelada" },
];

interface MembroOpt {
  id: string;
  nome: string;
  tipo: string;
  cache?: number | null;
}

interface EscalaRow {
  membroId: string;
  horarioEntrada: string;
  horarioSaida: string;
  funcao: string;
  cache: string;
}

function toLocalInput(dt?: string | null): string {
  if (!dt) return "";
  return dt.slice(0, 16);
}

export function OsDetail({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  os,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  os: any;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState(os.status || "ABERTA");
  const [horarioMontagem, setHorarioMontagem] = useState(toLocalInput(os.horarioMontagem));
  const [horarioDesmontagem, setHorarioDesmontagem] = useState(
    toLocalInput(os.horarioDesmontagem)
  );
  const [observacoes, setObservacoes] = useState(os.observacoes || "");
  const [escala, setEscala] = useState<EscalaRow[]>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (os.escala || []).map((e: any) => ({
      membroId: e.membroId,
      horarioEntrada: toLocalInput(e.horarioEntrada),
      horarioSaida: toLocalInput(e.horarioSaida),
      funcao: e.funcao || "",
      cache: e.cache != null ? String(e.cache) : "",
    }))
  );
  const [membros, setMembros] = useState<MembroOpt[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/membros")
      .then((r) => r.json())
      .then((d) => setMembros(d.membros || []))
      .catch(() => setMembros([]));
  }, []);

  const orc = os.orcamento;

  function addEscala() {
    setEscala((p) => [
      ...p,
      { membroId: "", horarioEntrada: "", horarioSaida: "", funcao: "", cache: "" },
    ]);
  }
  function removeEscala(i: number) {
    setEscala((p) => p.filter((_, idx) => idx !== i));
  }
  function setEscalaField(i: number, patch: Partial<EscalaRow>) {
    setEscala((p) => {
      const arr = [...p];
      arr[i] = { ...arr[i], ...patch };
      return arr;
    });
  }

  async function handleSave() {
    // Ao concluir, confere se ainda há unidades não devolvidas ao estoque
    if (status === "CONCLUIDA" && os.status !== "CONCLUIDA") {
      try {
        const res = await fetch(`/api/ordens-servico/${os.id}/conferencia`);
        if (res.ok) {
          const d = await res.json();
          const pendentes = (d.unidades || []).filter(
            (u: { status: string; osAtualId: string | null }) =>
              u.status === "NO_EVENTO" && u.osAtualId === os.id
          );
          if (pendentes.length > 0) {
            const lista = pendentes
              .slice(0, 5)
              .map((u: { codigo: string }) => u.codigo)
              .join(", ");
            const ok = window.confirm(
              `⚠ Ainda há ${pendentes.length} unidade(s) não devolvida(s) ao estoque (${lista}${
                pendentes.length > 5 ? "..." : ""
              }).\n\nConcluir a OS mesmo assim? Elas continuarão marcadas como "No evento" até a entrada ser registrada.`
            );
            if (!ok) return;
          }
        }
      } catch {}
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/ordens-servico/${os.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          horarioMontagem: horarioMontagem || null,
          horarioDesmontagem: horarioDesmontagem || null,
          observacoes,
          escala,
        }),
      });
      if (!res.ok) throw new Error();
      toast("OS atualizada com sucesso!", "success");
      router.push("/ordens-servico");
    } catch {
      toast("Erro ao salvar. Tente novamente.", "error");
    } finally {
      setSaving(false);
    }
  }

  const membroOptions = membros.map((m) => ({
    value: m.id,
    label: `${m.nome} (${m.tipo === "FUNCIONARIO" ? "Funcionário" : m.tipo === "TECNICO" ? "Técnico" : "Freelancer"})`,
  }));

  return (
    <div className="max-w-4xl space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            OS #{orc.numero} — {orc.cliente?.nomeFantasia}
          </p>
          <p className="text-xs text-slate-400">
            Gerada do orçamento #{orc.numero} ·{" "}
            <a
              href={`/ordens-servico/${os.id}/romaneio`}
              className="text-blue-600 hover:underline"
            >
              🖨 Romaneio de carga
            </a>
          </p>
        </div>
        <div className="w-48">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions} />
        </div>
      </div>

      {/* Herdado: Cliente + Evento */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Cliente</h3>
          </div>
          <p className="text-sm font-medium text-slate-900">{orc.cliente?.nomeFantasia}</p>
          <p className="text-xs text-slate-400">{orc.cliente?.razaoSocial}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Evento</h3>
          </div>
          <p className="text-sm font-medium text-slate-900">{orc.eventoNome || "—"}</p>
          <p className="text-xs text-slate-400">
            {orc.dataInicio ? new Date(orc.dataInicio).toLocaleDateString("pt-BR") : "—"}
            {orc.dataFim ? ` até ${new Date(orc.dataFim).toLocaleDateString("pt-BR")}` : ""}
          </p>
          {orc.local && (
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {orc.local.nome}
            </p>
          )}
        </div>
      </div>

      {/* Horários */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Horários de Montagem e Desmontagem
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Montagem"
            type="datetime-local"
            value={horarioMontagem}
            onChange={(e) => setHorarioMontagem(e.target.value)}
          />
          <Input
            label="Desmontagem"
            type="datetime-local"
            value={horarioDesmontagem}
            onChange={(e) => setHorarioDesmontagem(e.target.value)}
          />
        </div>
      </div>

      {/* Equipamentos (herdados) */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Equipamentos Confirmados
          </h3>
        </div>
        {(orc.salas || []).length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum equipamento no orçamento.</p>
        ) : (
          <div className="space-y-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {orc.salas.map((sala: any) => (
              <div key={sala.id}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  {sala.nome}
                </p>
                <ul className="space-y-1">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {sala.itens.map((it: any) => (
                    <li
                      key={it.id}
                      className="flex items-center justify-between text-sm text-slate-700 border-b border-slate-50 pb-1"
                    >
                      <span>
                        {it.quantidade}x {it.item?.nome}
                        {it.item?.codigo ? (
                          <span className="text-slate-400"> ({it.item.codigo})</span>
                        ) : null}
                        {(it.descricaoComercial || it.item?.descricaoComercial) ? (
                          <span className="text-slate-500 italic">
                            {" — "}
                            {it.descricaoComercial || it.item?.descricaoComercial}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-slate-400 text-xs">{it.quantidade} un.</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conferência de estoque (saída/entrada por QR ou busca) */}
      <OsConferencia osId={os.id} />

      {/* Escala de Equipe */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">Escala de Equipe</h3>
        </div>

        {membros.length === 0 && (
          <p className="text-xs text-amber-600 mb-3">
            Nenhum membro cadastrado ainda. Cadastre a equipe em Equipe → Membros.
          </p>
        )}

        <div className="space-y-3">
          {escala.map((e, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end border-b border-slate-50 pb-3">
              <div className="col-span-4">
                <Select
                  label={i === 0 ? "Membro" : undefined}
                  value={e.membroId}
                  onChange={(ev) => {
                    const m = membros.find((x) => x.id === ev.target.value);
                    setEscalaField(i, {
                      membroId: ev.target.value,
                      cache: e.cache || (m?.cache != null ? String(m.cache) : ""),
                    });
                  }}
                  options={membroOptions}
                  placeholder="Selecione"
                />
              </div>
              <div className="col-span-3">
                <Input
                  label={i === 0 ? "Entrada" : undefined}
                  type="datetime-local"
                  value={e.horarioEntrada}
                  onChange={(ev) => setEscalaField(i, { horarioEntrada: ev.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Input
                  label={i === 0 ? "Função" : undefined}
                  value={e.funcao}
                  onChange={(ev) => setEscalaField(i, { funcao: ev.target.value })}
                  placeholder="Ex: Técnico som"
                />
              </div>
              <div className="col-span-2">
                <Input
                  label={i === 0 ? "Cachê (R$)" : undefined}
                  type="number"
                  step="0.01"
                  value={e.cache}
                  onChange={(ev) => setEscalaField(i, { cache: ev.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="col-span-1 pb-1.5 text-right">
                <button
                  onClick={() => removeEscala(i)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addEscala} className="mt-3">
          <Plus className="h-4 w-4" />
          Escalar Membro
        </Button>
      </div>

      {/* NESTOR — comunicação com a equipe via WhatsApp */}
      <OsNestor osId={os.id} />

      {/* Observações */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Observações Operacionais
        </h3>
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Instruções de montagem, acesso ao local, contatos..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/ordens-servico")} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} loading={saving}>
          Salvar OS
        </Button>
      </div>
    </div>
  );
}
