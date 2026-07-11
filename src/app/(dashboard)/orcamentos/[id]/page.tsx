"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { OrcamentoForm } from "@/components/orcamentos/orcamento-form";

export default function EditarOrcamentoPage() {
  const params = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orcamento, setOrcamento] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/orcamentos/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setOrcamento(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params?.id]);

  return (
    <>
      <Header
        breadcrumbs={[
          { label: "Orçamentos", href: "/orcamentos" },
          { label: orcamento ? `#${orcamento.numero}` : "Editar" },
        ]}
      />
      <main className="pt-14 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : notFound ? (
          <p className="text-sm text-slate-500">Orçamento não encontrado.</p>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900">
                Editar Orçamento #{orcamento.numero}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Atualize as seções e salve as alterações
              </p>
            </div>
            <OrcamentoForm initial={orcamento} />
          </>
        )}
      </main>
    </>
  );
}
