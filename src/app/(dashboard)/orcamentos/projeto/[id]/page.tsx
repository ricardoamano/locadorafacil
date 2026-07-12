"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ProjetoForm } from "@/components/orcamentos/projeto-form";
import { NaoEncontrado } from "@/components/ui/nao-encontrado";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EditarProjetoPage() {
  const params = useParams<{ id: string }>();
  const [orcamento, setOrcamento] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/orcamentos/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setOrcamento(d?.id ? d : null))
      .finally(() => setLoading(false));
  }, [params?.id]);

  return (
    <>
      <Header
        breadcrumbs={[
          { label: "Orçamentos", href: "/orcamentos" },
          { label: orcamento ? `Projeto #${orcamento.numero}` : "Projeto" },
        ]}
      />
      <main className="pt-14 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : !orcamento ? (
          <NaoEncontrado
            mensagem="Projeto não encontrado."
            voltarHref="/orcamentos"
            voltarLabel="Voltar para Orçamentos"
          />
        ) : (
          <ProjetoForm orcamento={orcamento} />
        )}
      </main>
    </>
  );
}
