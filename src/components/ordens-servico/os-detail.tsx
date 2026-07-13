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
import { OsAnexos } from "./os-anexos";
import { OsEscalaIa } from "./os-escala-ia";
import {
  User,
  CalendarDays,
  MapPin,
  Package,
  Plus,
  Trash2,
  Users,
  Phone,
  MessageCircle,
  Truck,
  AlertTriangle,
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

interface VeiculoRow {
  veiculoId: string;
  motorista: string;
  observacao: string;
}

const NOME_DIA: Record<number, string> = {
  1: "segunda-feira", 2: "terça-feira", 3: "quarta-feira", 4: "quinta-feira", 5: "sexta-feira",
};

interface ProdutorRow {
  nome: string;
  telefone: string;
  funcao: string;
  observacao: string;
}

function waMeLink(telefone: string): string | null {
  let d = telefone.replace(/\D/g, "");
  if (!d) return null;
  if (!d.startsWith("55")) d = `55${d}`;
  return `https://wa.me/${d}`;
}

function toLocalInput(dt?: string | null): string {
  if (!dt) return "";
  return dt.slice(0, 16);
}

// Cachê da equipe cobre 12 horas de trabalho; além disso são horas extras.
const HORAS_CACHE = 12;

function horasTrabalhadas(entrada: string, saida: string): number | null {
  if (!entrada || !saida) return null;
  const ms = new Date(saida).getTime() - new Date(entrada).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms / 3_600_000;
}

function fmtHoras(h: number): string {
  const horas = Math.floor(h);
  const min = Math.round((h - horas) * 60);
  return min > 0 ? `${horas}h${String(min).padStart(2, "0")}` : `${horas}h`;
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
  const [infoEvento, setInfoEvento] = useState(os.infoEvento || "");
  const [obsMontagem, setObsMontagem] = useState(os.obsMontagem || "");
  const [obsDesmontagem, setObsDesmontagem] = useState(os.obsDesmontagem || "");
  const [obsLocal, setObsLocal] = useState(os.obsLocal || "");
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
  const [produtores, setProdutores] = useState<ProdutorRow[]>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (os.produtores || []).map((p: any) => ({
      nome: p.nome || "",
      telefone: p.telefone || "",
      funcao: p.funcao || "",
      observacao: p.observacao || "",
    }))
  );
  const [membros, setMembros] = useState<MembroOpt[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [veiculosDisp, setVeiculosDisp] = useState<any[]>([]);
  const [veiculosOs, setVeiculosOs] = useState<VeiculoRow[]>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (os.veiculos || []).map((v: any) => ({
      veiculoId: v.veiculoId,
      motorista: v.motorista || "",
      observacao: v.observacao || "",
    }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/membros")
      .then((r) => r.json())
      .then((d) => setMembros(d.membros || []))
      .catch(() => setMembros([]));
    fetch("/api/veiculos")
      .then((r) => r.json())
      .then((d) => setVeiculosDisp(d.veiculos || []))
      .catch(() => setVeiculosDisp([]));
  }, []);

  // Dias relevantes da OS (montagem + período do evento) para o alerta de rodízio
  function diasDaOs(): { data: Date; rotulo: string }[] {
    const dias: { data: Date; rotulo: string }[] = [];
    if (horarioMontagem) dias.push({ data: new Date(horarioMontagem), rotulo: "montagem" });
    if (os.orcamento?.dataInicio) {
      const ini = new Date(os.orcamento.dataInicio);
      const fim = os.orcamento?.dataFim ? new Date(os.orcamento.dataFim) : ini;
      for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
        dias.push({ data: new Date(d), rotulo: "evento" });
      }
    }
    return dias;
  }

  function alertaRodizio(veiculoId: string): string | null {
    const v = veiculosDisp.find((x) => x.id === veiculoId);
    if (!v?.rodizioDia) return null;
    const conflito = diasDaOs().find((d) => d.data.getDay() === v.rodizioDia);
    if (!conflito) return null;
    return `Rodízio na ${NOME_DIA[v.rodizioDia]} — dia de ${conflito.rotulo} (${conflito.data.toLocaleDateString("pt-BR")})`;
  }

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
          infoEvento,
          obsMontagem,
          obsDesmontagem,
          obsLocal,
          escala,
          produtores,
          veiculos: veiculosOs,
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
            </a>{" "}
            ·{" "}
            <a
              href={`/ordens-servico/${os.id}/recibo-entrega`}
              className="text-blue-600 hover:underline"
            >
              ✍️ Termo de entrega (cliente assina)
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
          <div className="mt-2">
            <Input
              value={obsLocal}
              onChange={(e) => setObsLocal(e.target.value)}
              placeholder='Obs. do local (ex: "entrada pelo portão 5")'
            />
          </div>
        </div>
      </div>

      {/* Horários */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Horários de Montagem e Desmontagem
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Input
              label="Montagem"
              type="datetime-local"
              value={horarioMontagem}
              onChange={(e) => setHorarioMontagem(e.target.value)}
            />
            <Input
              value={obsMontagem}
              onChange={(e) => setObsMontagem(e.target.value)}
              placeholder='Obs. da montagem (ex: "combinei de chegar às 13h")'
            />
          </div>
          <div className="space-y-2">
            <Input
              label="Desmontagem"
              type="datetime-local"
              value={horarioDesmontagem}
              onChange={(e) => setHorarioDesmontagem(e.target.value)}
            />
            <Input
              value={obsDesmontagem}
              onChange={(e) => setObsDesmontagem(e.target.value)}
              placeholder='Obs. da desmontagem (ex: "previsto terminar às 22h")'
            />
          </div>
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
          {escala.map((e, i) => {
            const horas = horasTrabalhadas(e.horarioEntrada, e.horarioSaida);
            return (
              <div key={i} className="border-b border-slate-50 pb-3">
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
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
                      label={i === 0 ? "Entrada (dia e hora)" : undefined}
                      type="datetime-local"
                      value={e.horarioEntrada}
                      onChange={(ev) => setEscalaField(i, { horarioEntrada: ev.target.value })}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      label={i === 0 ? "Saída (dia e hora)" : undefined}
                      type="datetime-local"
                      value={e.horarioSaida}
                      onChange={(ev) => setEscalaField(i, { horarioSaida: ev.target.value })}
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
                <div className="grid grid-cols-12 gap-2 mt-2 items-center">
                  <div className="col-span-3">
                    <Input
                      value={e.funcao}
                      onChange={(ev) => setEscalaField(i, { funcao: ev.target.value })}
                      placeholder="Função (ex.: Técnico som)"
                    />
                  </div>
                  <div className="col-span-9">
                    {horas !== null && (
                      <p
                        className={`text-xs ${
                          horas > HORAS_CACHE ? "text-red-600 font-medium" : "text-slate-500"
                        }`}
                      >
                        ⏱ {fmtHoras(horas)} trabalhadas
                        {horas > HORAS_CACHE ? (
                          <>
                            {" "}
                            — <strong>{fmtHoras(horas - HORAS_CACHE)} extras</strong> além das{" "}
                            {HORAS_CACHE}h do cachê
                          </>
                        ) : (
                          <> (dentro das {HORAS_CACHE}h do cachê)</>
                        )}
                      </p>
                    )}
                    {horas === null && e.horarioEntrada && !e.horarioSaida && (
                      <p className="text-xs text-slate-400">
                        Preencha a saída ao final do evento para calcular as horas.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Button variant="outline" size="sm" onClick={addEscala} className="mt-3">
          <Plus className="h-4 w-4" />
          Escalar Membro
        </Button>
      </div>

      {/* Escala de Veículos (com alerta de rodízio) */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">Escala de Veículos</h3>
        </div>
        {veiculosDisp.length === 0 && (
          <p className="text-xs text-amber-600 mb-3">
            Nenhum veículo cadastrado — cadastre em Equipe → Veículos.
          </p>
        )}
        <div className="space-y-3">
          {veiculosOs.map((v, i) => {
            const alerta = alertaRodizio(v.veiculoId);
            return (
              <div key={i}>
                <div className="grid grid-cols-12 gap-2 items-end border-b border-slate-50 pb-1">
                  <div className="col-span-5">
                    <Select
                      label={i === 0 ? "Veículo" : undefined}
                      value={v.veiculoId}
                      onChange={(ev) =>
                        setVeiculosOs((prev) => {
                          const arr = [...prev];
                          arr[i] = { ...arr[i], veiculoId: ev.target.value };
                          return arr;
                        })
                      }
                      options={veiculosDisp.map((vd) => ({
                        value: vd.id,
                        label: `${vd.modelo} — ${vd.placa}${vd.rodizioDia ? ` (rodízio ${NOME_DIA[vd.rodizioDia]?.slice(0, 3)})` : ""}`,
                      }))}
                      placeholder="Selecione"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      label={i === 0 ? "Motorista" : undefined}
                      value={v.motorista}
                      onChange={(ev) =>
                        setVeiculosOs((prev) => {
                          const arr = [...prev];
                          arr[i] = { ...arr[i], motorista: ev.target.value };
                          return arr;
                        })
                      }
                      placeholder="Quem dirige"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      label={i === 0 ? "Observação" : undefined}
                      value={v.observacao}
                      onChange={(ev) =>
                        setVeiculosOs((prev) => {
                          const arr = [...prev];
                          arr[i] = { ...arr[i], observacao: ev.target.value };
                          return arr;
                        })
                      }
                      placeholder="Ex: leva o palco"
                    />
                  </div>
                  <div className="col-span-1 pb-1.5 text-right">
                    <button
                      onClick={() => setVeiculosOs((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {alerta && (
                  <p className="mt-1 mb-2 inline-flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-2 py-1 text-xs font-medium text-red-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {alerta}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setVeiculosOs((prev) => [...prev, { veiculoId: "", motorista: "", observacao: "" }])
          }
          className="mt-3"
        >
          <Plus className="h-4 w-4" />
          Escalar Veículo
        </Button>
      </div>

      {/* Produtores / contatos no evento — clicáveis para abrir o WhatsApp */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Phone className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Produtores / Contatos no Evento
          </h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Quem a equipe procura no local. Os técnicos veem esses contatos no link público da
          OS e abrem o WhatsApp com um toque.
        </p>
        <div className="space-y-3">
          {produtores.map((p, i) => {
            const wa = p.telefone ? waMeLink(p.telefone) : null;
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border-b border-slate-50 pb-3">
                <div className="col-span-4">
                  <Input
                    label={i === 0 ? "Nome" : undefined}
                    value={p.nome}
                    onChange={(ev) =>
                      setProdutores((prev) => {
                        const arr = [...prev];
                        arr[i] = { ...arr[i], nome: ev.target.value };
                        return arr;
                      })
                    }
                    placeholder="Ex: Maria (produtora)"
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    label={i === 0 ? "WhatsApp" : undefined}
                    value={p.telefone}
                    onChange={(ev) =>
                      setProdutores((prev) => {
                        const arr = [...prev];
                        arr[i] = { ...arr[i], telefone: ev.target.value };
                        return arr;
                      })
                    }
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    label={i === 0 ? "Função" : undefined}
                    value={p.funcao}
                    onChange={(ev) =>
                      setProdutores((prev) => {
                        const arr = [...prev];
                        arr[i] = { ...arr[i], funcao: ev.target.value };
                        return arr;
                      })
                    }
                    placeholder="Ex: Produção da agência"
                  />
                </div>
                <div className="col-span-2 pb-1 flex items-center justify-end gap-2">
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir WhatsApp"
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={() => setProdutores((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="col-span-12">
                  <Input
                    value={p.observacao}
                    onChange={(ev) =>
                      setProdutores((prev) => {
                        const arr = [...prev];
                        arr[i] = { ...arr[i], observacao: ev.target.value };
                        return arr;
                      })
                    }
                    placeholder="Observação (ex: responsável pela cenografia, chegará às 12h)"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setProdutores((prev) => [
              ...prev,
              { nome: "", telefone: "", funcao: "", observacao: "" },
            ])
          }
          className="mt-3"
        >
          <Plus className="h-4 w-4" />
          Adicionar Contato
        </Button>
        {produtores.length > 0 && (
          <p className="text-xs text-slate-400 mt-2">
            Lembre de clicar em &quot;Salvar OS&quot; para gravar os contatos.
          </p>
        )}
      </div>

      {/* Arquivos e links para a equipe */}
      <OsAnexos osId={os.id} />

      {/* Assistente de escala e logística (IA, com contexto desta OS) */}
      <OsEscalaIa osId={os.id} />

      {/* Assistente — comunicação com a equipe via WhatsApp */}
      <OsNestor osId={os.id} />

      {/* Informações do evento — texto livre visível na OS pública */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          Informações do Evento
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Campo livre do responsável — aparece na OS pública para toda a equipe. Cada
          alteração fica carimbada com autor, data e hora.
        </p>
        <Textarea
          value={infoEvento}
          onChange={(e) => setInfoEvento(e.target.value)}
          placeholder="Escreva aqui tudo que a equipe precisa saber sobre o evento: dress code, credenciamento, estacionamento, horários de acesso, refeições..."
          rows={5}
        />
        {os.infoEventoEm && (
          <p className="text-xs text-slate-400 mt-2">
            🔄 Última atualização:{" "}
            {new Date(os.infoEventoEm).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {os.infoEventoPor ? ` por ${os.infoEventoPor}` : ""}
          </p>
        )}
      </div>

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
