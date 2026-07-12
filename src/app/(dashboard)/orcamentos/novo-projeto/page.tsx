import { Header } from "@/components/layout/header";
import { ProjetoForm } from "@/components/orcamentos/projeto-form";

export const metadata = {
  title: "Novo Projeto Especial | LocadoraFácil",
};

export default function NovoProjetoPage() {
  return (
    <>
      <Header
        breadcrumbs={[
          { label: "Orçamentos", href: "/orcamentos" },
          { label: "Novo Projeto Especial" },
        ]}
      />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Novo Projeto Especial</h1>
          <p className="text-sm text-slate-500 mt-1">
            Cole a proposta em texto/Markdown e o sistema gera o PDF no padrão da empresa
          </p>
        </div>
        <ProjetoForm />
      </main>
    </>
  );
}
