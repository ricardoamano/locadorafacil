"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { OsDetail } from "@/components/ordens-servico/os-detail";

export default function OsDetalhePage() {
  const params = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [os, setOs] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/ordens-servico/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setOs(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params?.id]);

  return (
    <>
      <Header
        breadcrumbs={[
          { label: "Ordens de Serviço", href: "/ordens-servico" },
          { label: os ? `OS #${os.orcamento?.numero}` : "Detalhe" },
        ]}
      />
      <main className="pt-14 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : notFound ? (
          <p className="text-sm text-slate-500">OS não encontrada.</p>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900">
                Ordem de Serviço #{os.orcamento?.numero}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Dados herdados do orçamento aprovado
              </p>
            </div>
            <OsDetail os={os} />
          </>
        )}
      </main>
    </>
  );
}
