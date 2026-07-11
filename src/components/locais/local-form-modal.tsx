"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { fetchAddressByCEP, formatCEP } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LocalFormData {
  id?: string;
  nome: string;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  complemento: string;
  cidade: string;
  estado: string;
  lat: string;
  lng: string;
  observacoes: string;
}

const estadoOptions = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
].map((e) => ({ value: e, label: e }));

function emptyForm(): LocalFormData {
  return {
    nome: "",
    cep: "",
    rua: "",
    numero: "",
    bairro: "",
    complemento: "",
    cidade: "",
    estado: "",
    lat: "",
    lng: "",
    observacoes: "",
  };
}

interface LocalFormModalProps {
  open: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (created?: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial?: any;
}

export function LocalFormModal({
  open,
  onClose,
  onSuccess,
  initial,
}: LocalFormModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<LocalFormData>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof LocalFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setErrors({});
      if (initial) {
        setForm({
          ...emptyForm(),
          ...initial,
          lat: initial.lat != null ? String(initial.lat) : "",
          lng: initial.lng != null ? String(initial.lng) : "",
          cep: initial.cep || "",
          rua: initial.rua || "",
          numero: initial.numero || "",
          bairro: initial.bairro || "",
          complemento: initial.complemento || "",
          cidade: initial.cidade || "",
          estado: initial.estado || "",
          observacoes: initial.observacoes || "",
        });
      } else {
        setForm(emptyForm());
      }
    }
  }, [open, initial]);

  function setField<K extends keyof LocalFormData>(key: K, value: LocalFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleCEP(value: string) {
    const formatted = formatCEP(value);
    setField("cep", formatted);
    const digits = value.replace(/\D/g, "");
    if (digits.length === 8) {
      setCepLoading(true);
      const addr = await fetchAddressByCEP(digits);
      setCepLoading(false);
      if (addr) {
        setForm((prev) => ({
          ...prev,
          rua: addr.rua || prev.rua,
          bairro: addr.bairro || prev.bairro,
          cidade: addr.cidade || prev.cidade,
          estado: addr.estado || prev.estado,
        }));
      }
    }
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.nome.trim()) errs.nome = "Campo obrigatório";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const url = form.id ? `/api/locais/${form.id}` : "/api/locais";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      const data = await res.json();
      toast(
        form.id ? "Local atualizado com sucesso!" : "Local criado com sucesso!",
        "success"
      );
      onSuccess(data);
      onClose();
    } catch {
      toast("Erro ao salvar. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? "Editar Local" : "Novo Local"}
      size="2xl"
    >
      <ModalBody>
        <div className="space-y-4">
          <Input
            label="Nome da Localidade *"
            value={form.nome}
            onChange={(e) => setField("nome", e.target.value)}
            error={errors.nome}
            placeholder="Ex: Expo Center Norte"
          />

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Endereço
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-1">
                <div className="relative">
                  <Input
                    label="CEP"
                    value={form.cep}
                    onChange={(e) => handleCEP(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-3 top-8 h-4 w-4 animate-spin text-blue-500" />
                  )}
                </div>
              </div>
              <div className="col-span-3">
                <Input
                  label="Rua"
                  value={form.rua}
                  onChange={(e) => setField("rua", e.target.value)}
                  placeholder="Nome da rua"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <Input
                label="Número"
                value={form.numero}
                onChange={(e) => setField("numero", e.target.value)}
                placeholder="123"
              />
              <Input
                label="Bairro"
                value={form.bairro}
                onChange={(e) => setField("bairro", e.target.value)}
              />
              <Input
                label="Complemento"
                value={form.complemento}
                onChange={(e) => setField("complemento", e.target.value)}
                placeholder="Pavilhão, Sala..."
              />
              <Input
                label="Cidade"
                value={form.cidade}
                onChange={(e) => setField("cidade", e.target.value)}
              />
            </div>

            <div className="mt-3 w-32">
              <Select
                label="Estado"
                value={form.estado}
                onChange={(e) => setField("estado", e.target.value)}
                options={estadoOptions}
                placeholder="UF"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Coordenadas GPS (opcional)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Latitude"
                value={form.lat}
                onChange={(e) => setField("lat", e.target.value)}
                placeholder="-23.5121"
              />
              <Input
                label="Longitude"
                value={form.lng}
                onChange={(e) => setField("lng", e.target.value)}
                placeholder="-46.6196"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <Textarea
              label="Observações"
              value={form.observacoes}
              onChange={(e) => setField("observacoes", e.target.value)}
              placeholder="Informações úteis sobre o local (acesso, docas, horários...)"
              rows={2}
            />
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          {form.id ? "Salvar Alterações" : "Criar"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
