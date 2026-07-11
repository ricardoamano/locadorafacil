import { Header } from "@/components/layout/header";
import { OrcamentoForm } from "@/components/orcamentos/orcamento-form";

export const metadata = {
  title: "Novo Orçamento | LocadoraFácil",
};

export default function NovoOrcamentoPage() {
  return (
    <>
      <Header
        breadcrumbs={[
          { label: "Orçamentos", href: "/orcamentos" },
          { label: "Novo" },
        ]}
      />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Novo Orçamento</h1>
          <p className="text-sm text-slate-500 mt-1">
            Preencha as seções abaixo para montar a proposta
          </p>
        </div>
        <OrcamentoForm />
      </main>
    </>
  );
}
