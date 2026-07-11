"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { calcularPrecos } from "@/lib/precos";
import { formatCurrency } from "@/lib/utils";
import { Percent, Calculator } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function PrecosConfigPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [afetados, setAfetados] = useState(0);
  const [manuais, setManuais] = useState(0);
  const [diariaExemplo, setDiariaExemplo] = useState("10");
  const [form, setForm] = useState({
    diasSemana: "7",
    diasQuinzena: "15",
    diasMes: "30",
    descontoSemana: "0",
    descontoQuinzena: "0",
    descontoMes: "0",
    permitirPrecoManual: true,
  });

  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => r.json())
      .then((d: any) => {
        setForm({
          diasSemana: String(d.diasSemana ?? 7),
          diasQuinzena: String(d.diasQuinzena ?? 15),
          diasMes: String(d.diasMes ?? 30),
          descontoSemana: String(d.descontoSemana ?? 0),
          descontoQuinzena: String(d.descontoQuinzena ?? 0),
          descontoMes: String(d.descontoMes ?? 0),
          permitirPrecoManual: d.permitirPrecoManual ?? true,
        });
      })
      .finally(() => setLoading(false));
    fetch("/api/politica-precos/recalcular")
      .then((r) => r.json())
      .then((d: any) => {
        setAfetados(d.afetados || 0);
        setManuais(d.manuais || 0);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const politica = {
    diasSemana: parseInt(form.diasSemana) || 7,
    diasQuinzena: parseInt(form.diasQuinzena) || 15,
    diasMes: parseInt(form.diasMes) || 30,
    descontoSemana: parseFloat(form.descontoSemana) || 0,
    descontoQuinzena: parseFloat(form.descontoQuinzena) || 0,
    descontoMes: parseFloat(form.descontoMes) || 0,
  };
  const exemplo = calcularPrecos(parseFloat(diariaExemplo) || 0, politica);

  async function salvar(recalcular: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/empresa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      if (res.status === 403) {
        toast("Apenas administradores podem alterar a política de preços.", "error");
        return;
      }
      if (!res.ok) throw new Error();

      if (recalcular) {
        const rec = await fetch("/api/politica-precos/recalcular", { method: "POST" });
        const d = await rec.json();
        toast(
          `Política salva! ${d.recalculados} produto(s) com preço automático foram recalculados. Documentos já emitidos não foram alterados.`,
          "success"
        );
      } else {
        toast("Política de preços salva! Os preços atuais não foram alterados.", "success");
      }
      setConfirmOpen(false);
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Configurações" }, { label: "Política de Preços" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Política de Preços</h1>
          <p className="text-sm text-slate-500 mt-1">
            A diária é o preço base. Semana, quinzena e mês são calculados com desconto
            sobre o total das diárias.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="max-w-3xl space-y-4">
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Percent className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Períodos e Descontos
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Input
                  label="Dias da semana"
                  type="number"
                  value={form.diasSemana}
                  onChange={(e) => setForm((p) => ({ ...p, diasSemana: e.target.value }))}
                />
                <Input
                  label="Dias da quinzena"
                  type="number"
                  value={form.diasQuinzena}
                  onChange={(e) => setForm((p) => ({ ...p, diasQuinzena: e.target.value }))}
                />
                <Input
                  label="Dias do mês"
                  type="number"
                  value={form.diasMes}
                  onChange={(e) => setForm((p) => ({ ...p, diasMes: e.target.value }))}
                />
                <Input
                  label="Desconto semanal (%)"
                  type="number"
                  step="0.1"
                  value={form.descontoSemana}
                  onChange={(e) => setForm((p) => ({ ...p, descontoSemana: e.target.value }))}
                />
                <Input
                  label="Desconto quinzenal (%)"
                  type="number"
                  step="0.1"
                  value={form.descontoQuinzena}
                  onChange={(e) => setForm((p) => ({ ...p, descontoQuinzena: e.target.value }))}
                />
                <Input
                  label="Desconto mensal (%)"
                  type="number"
                  step="0.1"
                  value={form.descontoMes}
                  onChange={(e) => setForm((p) => ({ ...p, descontoMes: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-4">
                <input
                  type="checkbox"
                  checked={form.permitirPrecoManual}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, permitirPrecoManual: e.target.checked }))
                  }
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm text-slate-700">
                  Permitir substituir o valor calculado manualmente no cadastro do item
                </span>
              </label>
            </section>

            {/* Memória de cálculo */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Memória de Cálculo (simulação ao vivo)
                </h2>
              </div>
              <div className="w-40 mb-4">
                <Input
                  label="Diária de exemplo (R$)"
                  type="number"
                  step="0.01"
                  value={diariaExemplo}
                  onChange={(e) => setDiariaExemplo(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                {(
                  [
                    ["Semana", exemplo.valorSemana, exemplo.memoria.semana],
                    ["Quinzena", exemplo.valorQuinzena, exemplo.memoria.quinzena],
                    ["Mês", exemplo.valorMes, exemplo.memoria.mes],
                  ] as const
                ).map(([titulo, valor, memoria]) => (
                  <div key={titulo} className="border border-slate-100 rounded-lg p-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">{titulo}</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(valor)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{memoria}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-slate-500">
                {afetados} produto(s) com preço automático · {manuais} com preço manual
                (não serão alterados). Documentos já emitidos permanecem intactos.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => salvar(false)} loading={saving}>
                  Salvar sem recalcular
                </Button>
                <Button onClick={() => setConfirmOpen(true)} disabled={saving}>
                  Salvar e recalcular preços
                </Button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => salvar(true)}
          loading={saving}
          message={`Salvar a política e recalcular os preços de ${afetados} produto(s) com preço automático? Produtos com preço manual e documentos já emitidos não serão alterados.`}
        />
      </main>
    </>
  );
}
