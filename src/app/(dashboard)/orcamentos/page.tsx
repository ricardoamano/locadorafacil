import { Header } from "@/components/layout/header";
import { OrcamentosList } from "@/components/orcamentos/orcamentos-list";

export const metadata = {
  title: "Orçamentos | LocadoraFácil",
};

export default function OrcamentosPage() {
  return (
    <>
      <Header breadcrumbs={[{ label: "Orçamentos" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Orçamentos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Crie e acompanhe propostas para seus clientes
          </p>
        </div>
        <OrcamentosList />
      </main>
    </>
  );
}
