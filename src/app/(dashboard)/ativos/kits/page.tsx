"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ExportarCsv } from "@/components/ui/exportar-csv";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, Boxes } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LinhaKit {
  itemId: string;
  quantidade: number;
  valorUnitario: string;
}

export default function KitsPage() {
  const { toast } = useToast();
  const [kits, setKits] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [linhas, setLinhas] = useState<LinhaKit[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kits");
      const d = await res.json();
      setKits(d.kits || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    fetch("/api/itens?limit=500")
      .then((r) => r.json())
      .then((d) => setItens(d.itens || []))
      .catch(() => {});
  }, [carregar]);

  function abrirNovo() {
    setEditId(null);
    setNome("");
    setDescricao("");
    setLinhas([{ itemId: "", quantidade: 1, valorUnitario: "" }]);
    setModalOpen(true);
  }

  function abrirEdicao(kit: any) {
    setEditId(kit.id);
    setNome(kit.nome);
    setDescricao(kit.descricao || "");
    setLinhas(
      (kit.itens || []).map((i: any) => ({ itemId: i.itemId, quantidade: i.quantidade, valorUnitario: i.valorUnitario != null ? String(i.valorUnitario) : "" }))
    );
    setModalOpen(true);
  }

  async function salvar() {
    const validas = linhas.filter((l) => l.itemId);
    if (!nome.trim() || validas.length === 0) {
      toast("Informe o nome e ao menos um item.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editId ? `/api/kits/${editId}` : "/api/kits", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          descricao,
          itens: validas.map((l) => ({
            itemId: l.itemId,
            quantidade: l.quantidade,
            valorUnitario: l.valorUnitario.trim()
              ? parseFloat(l.valorUnitario.replace(/\./g, "").replace(",", "."))
              : null,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Erro ao salvar.", "error");
        return;
      }
      toast(editId ? "Kit atualizado!" : "Kit criado!", "success");
      setModalOpen(false);
      carregar();
    } catch {
      toast("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function excluir() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/kits/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Kit excluído.", "success");
      setDeleteId(null);
      carregar();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  const itemOptions = itens.map((i: any) => ({
    value: i.id,
    label: `${i.codigo ? i.codigo + " — " : ""}${i.nome}${i.natureza === "SERVICO" ? " 🛠" : ""}`,
    keywords: i.apelidos || "",
  }));

  function valorKit(kit: any) {
    return (kit.itens || []).reduce(
      (a: number, i: any) => a + ((i.valorUnitario ?? i.item?.valorAluguel) || 0) * i.quantidade,
      0
    );
  }

  return (
    <>
      <Header breadcrumbs={[{ label: "Ativos" }, { label: "Kits" }]} />
      <main className="pt-14 p-6">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Kits / Pacotes</h1>
            <p className="text-sm text-slate-500 mt-1">
              Conjuntos de itens adicionados de uma vez no orçamento (ex.: Kit Palco P)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportarCsv tipo="kits" />
            <Button onClick={abrirNovo}>
              <Plus className="h-4 w-4" />
              Novo Kit
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : kits.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
            <Boxes className="h-8 w-8" />
            <p className="text-sm">Nenhum kit criado ainda</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {kits.map((kit: any) => (
              <div
                key={kit.id}
                className="bg-white rounded-xl border border-slate-100 shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{kit.nome}</p>
                    {kit.descricao && (
                      <p className="text-xs text-slate-400">{kit.descricao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => abrirEdicao(kit)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(kit.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                  {(kit.itens || []).map((i: any) => (
                    <li key={i.id}>
                      {i.quantidade}x {i.item?.nome}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-400">
                  Valor de referência (diárias):{" "}
                  <span className="font-semibold text-slate-700">
                    {formatCurrency(valorKit(kit))}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editId ? "Editar Kit" : "Novo Kit"}
          size="lg"
        >
          <ModalBody>
            <div className="space-y-3">
              <Input
                label="Nome do Kit *"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Kit Palco P"
              />
              <Input
                label="Descrição"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Estrutura básica para eventos até 100 pessoas"
              />
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Itens do kit *</p>
                <p className="text-xs text-slate-400 mb-2">Item · quantidade · preço manual (vazio = usa a diária do item)</p>
                <div className="space-y-2">
                  {linhas.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-6">
                        <Select
                          searchable
                          value={l.itemId}
                          onChange={(e) => {
                            const arr = [...linhas];
                            const it = itens.find((x: any) => x.id === e.target.value);
                            arr[i] = {
                              ...arr[i],
                              itemId: e.target.value,
                              // sugere a diária do item como ponto de partida (editável)
                              valorUnitario:
                                arr[i].valorUnitario ||
                                (it?.valorAluguel != null ? String(it.valorAluguel).replace(".", ",") : ""),
                            };
                            setLinhas(arr);
                          }}
                          options={itemOptions}
                          placeholder="Digite para buscar o item"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min={1}
                          value={l.quantidade}
                          onChange={(e) => {
                            const arr = [...linhas];
                            arr[i] = {
                              ...arr[i],
                              quantidade: Math.max(1, parseInt(e.target.value) || 1),
                            };
                            setLinhas(arr);
                          }}
                          className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title="Quantidade"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          value={l.valorUnitario}
                          onChange={(e) => {
                            const arr = [...linhas];
                            arr[i] = { ...arr[i], valorUnitario: e.target.value };
                            setLinhas(arr);
                          }}
                          placeholder="Preço manual"
                          className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title="Valor unitário no kit (deixe vazio para usar a diária do item)"
                        />
                      </div>
                      <div className="col-span-1 pb-1.5 text-right">
                        <button
                          onClick={() => setLinhas(linhas.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setLinhas([...linhas, { itemId: "", quantidade: 1, valorUnitario: "" }])}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar item
                </Button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={salvar} loading={saving}>
              {editId ? "Salvar" : "Criar Kit"}
            </Button>
          </ModalFooter>
        </Modal>

        <ConfirmDialog
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={excluir}
          loading={deleteLoading}
          message="Excluir este kit? Os itens do catálogo não são afetados."
        />
      </main>
    </>
  );
}
