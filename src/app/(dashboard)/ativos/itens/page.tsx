import { Header } from "@/components/layout/header";
import { ItensList } from "@/components/itens/itens-list";

export const metadata = {
  title: "Itens | LocadoraFácil",
};

export default function ItensPage() {
  return (
    <>
      <Header
        breadcrumbs={[{ label: "Ativos" }, { label: "Itens" }]}
      />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Itens</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie seu estoque de equipamentos e catálogo
          </p>
        </div>
        <ItensList />
      </main>
    </>
  );
}
