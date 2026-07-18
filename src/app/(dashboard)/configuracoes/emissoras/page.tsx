"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ImageUpload } from "@/components/ui/image-upload";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { formatCNPJ, formatPhone } from "@/lib/utils";
import { Landmark, Plus, Pencil, Trash2 } from "lucide-react";

// Empresas emissoras: outros CNPJs do grupo que podem assinar faturas/recibos.
// O orçamento continua na empresa principal — muda só quem emite e a conta
// que recebe (vinculada a um banco do financeiro).

interface Emissora {
  id: string;
  nome: string;
  razaoSocial: string | null;
  cnpj: string | null;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  email: string | null;
  logoUrl: string | null;
  naturezaOperacao: string | null;
  observacaoFatura: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix: string | null;
  bancoId: string | null;
  ativo: boolean;
  bancoRef?: { nome: string } | null;
  _count?: { faturas: number };
}

type FormT = Partial<Emissora>;

export default function EmissorasPage() {
  const { toast } = useToast();
  const [emissoras, setEmissoras] = useState<Emissora[]>([]);
  const [bancos, setBancos] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormT>({});
  const [saving, setSaving] = useState(false);
  const [excluir, setExcluir] = useState<Emissora | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/empresa/emissoras");
      if (r.status === 401 || r.status === 403) {
        setSemAcesso(true);
        return;
      }
      const d = await r.json();
      setEmissoras(d.emissoras || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    fetch("/api/bancos")
      .then((r) => (r.ok ? r.json() : { bancos: [] }))
      .then((d) => setBancos(d.bancos || []))
      .catch(() => {});
  }, [carregar]);

  function abrir(e?: Emissora) {
    setForm(e ? { ...e } : { ativo: true });
    setModal(true);
  }

  function setF(k: keyof Emissora, v: unknown) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function salvar() {
    if (!form.nome?.trim()) {
      toast("Dê um nome à empresa (ex.: o nome fantasia).", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        form.id ? `/api/empresa/emissoras/${form.id}` : "/api/empresa/emissoras",
        {
          method: form.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast("Empresa emissora salva!", "success");
      setModal(false);
      await carregar();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    try {
      const res = await fetch(`/api/empresa/emissoras/${excluir.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast("Excluída.", "success");
      await carregar();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao excluir.", "error");
    } finally {
      setExcluir(null);
    }
  }

  if (semAcesso)
    return (
      <p className="text-sm text-slate-500">
        Apenas o superadmin pode gerenciar as empresas emissoras.
      </p>
    );

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
            <Landmark className="h-5 w-5 text-violet-700" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Empresas Emissoras</h1>
            <p className="text-xs text-slate-500">
              Outros CNPJs do grupo que podem assinar faturas e recibos. O recebimento entra na
              conta vinculada, dentro do mesmo fluxo de caixa.
            </p>
          </div>
        </div>
        <Button onClick={() => abrir()}>
          <Plus className="h-4 w-4" />
          Nova
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-6 w-6 border-2 border-violet-600 border-t-transparent rounded-full" />
        </div>
      ) : emissoras.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-sm text-slate-400">
          Nenhuma empresa emissora cadastrada. As faturas saem sempre pela empresa principal.
        </div>
      ) : (
        <div className="space-y-2">
          {emissoras.map((e) => (
            <div
              key={e.id}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {e.nome}
                  {!e.ativo && (
                    <span className="ml-2 text-[10px] uppercase bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">
                      inativa
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {[e.cnpj, e.bancoRef ? `Conta: ${e.bancoRef.nome}` : null, e._count ? `${e._count.faturas} fatura(s)` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <button onClick={() => abrir(e)} className="p-2 text-slate-400 hover:text-violet-600">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => setExcluir(e)} className="p-2 text-slate-400 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={form.id ? `Editar ${form.nome}` : "Nova empresa emissora"}
        size="2xl"
      >
        <ModalBody>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nome (aparece no seletor) *"
                value={form.nome || ""}
                onChange={(e) => setF("nome", e.target.value)}
                placeholder="Ex.: Neostore Locações"
              />
              <Input
                label="Razão social"
                value={form.razaoSocial || ""}
                onChange={(e) => setF("razaoSocial", e.target.value)}
              />
              <Input
                label="CNPJ"
                value={form.cnpj || ""}
                onChange={(e) => setF("cnpj", formatCNPJ(e.target.value))}
                placeholder="XX.XXX.XXX/XXXX-XX"
              />
              <Input
                label="Telefone"
                value={form.telefone || ""}
                onChange={(e) => setF("telefone", formatPhone(e.target.value))}
              />
              <Input
                label="Inscrição estadual"
                value={form.inscricaoEstadual || ""}
                onChange={(e) => setF("inscricaoEstadual", e.target.value)}
              />
              <Input
                label="Inscrição municipal"
                value={form.inscricaoMunicipal || ""}
                onChange={(e) => setF("inscricaoMunicipal", e.target.value)}
              />
              <Input label="E-mail" value={form.email || ""} onChange={(e) => setF("email", e.target.value)} />
              <Input
                label="Natureza da operação"
                value={form.naturezaOperacao || ""}
                onChange={(e) => setF("naturezaOperacao", e.target.value)}
                placeholder="LOCAÇÃO DE BENS MÓVEIS"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="CEP" value={form.cep || ""} onChange={(e) => setF("cep", e.target.value)} />
              <div className="col-span-1 sm:col-span-2">
                <Input label="Rua" value={form.rua || ""} onChange={(e) => setF("rua", e.target.value)} />
              </div>
              <Input label="Número" value={form.numero || ""} onChange={(e) => setF("numero", e.target.value)} />
              <Input label="Bairro" value={form.bairro || ""} onChange={(e) => setF("bairro", e.target.value)} />
              <Input label="Cidade" value={form.cidade || ""} onChange={(e) => setF("cidade", e.target.value)} />
              <Input label="Estado" value={form.estado || ""} onChange={(e) => setF("estado", e.target.value)} />
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-3">
              <p className="text-xs font-semibold text-slate-600">
                Dados bancários (saem no recibo) e conta do fluxo de caixa
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input label="Banco" value={form.banco || ""} onChange={(e) => setF("banco", e.target.value)} />
                <Input label="Agência" value={form.agencia || ""} onChange={(e) => setF("agencia", e.target.value)} />
                <Input label="Conta" value={form.conta || ""} onChange={(e) => setF("conta", e.target.value)} />
                <Input label="PIX" value={form.pix || ""} onChange={(e) => setF("pix", e.target.value)} />
              </div>
              <Select
                label="Conta no financeiro (o recebimento entra nela)"
                value={form.bancoId || ""}
                onChange={(e) => setF("bancoId", e.target.value)}
                options={[
                  { value: "", label: "— sem vínculo —" },
                  ...bancos.map((b) => ({ value: b.id, label: b.nome })),
                ]}
              />
              <p className="text-[11px] text-slate-400">
                Cadastre a conta em Configurações → Bancos e vincule aqui: as receitas das faturas
                dessa emissora entram nessa conta no fluxo de caixa.
              </p>
            </div>

            <ImageUpload
              label="Logo (cabeçalho da fatura/recibo)"
              value={form.logoUrl || ""}
              onChange={(url) => setF("logoUrl", url)}
            />
            <Textarea
              label="Observação padrão da fatura"
              value={form.observacaoFatura || ""}
              onChange={(e) => setF("observacaoFatura", e.target.value)}
              rows={2}
            />
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.ativo !== false}
                onChange={(e) => setF("ativo", e.target.checked)}
              />
              Ativa (aparece no seletor da fatura)
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setModal(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={saving}>
            Salvar
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        open={!!excluir}
        onClose={() => setExcluir(null)}
        onConfirm={confirmarExclusao}
        title="Excluir empresa emissora"
        message={`Excluir "${excluir?.nome}"? Faturas já emitidas por ela impedem a exclusão (use Inativa).`}
      />
    </div>
  );
}
