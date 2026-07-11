import { Header } from "@/components/layout/header";
import { FaturasList } from "@/components/faturas/faturas-list";

export const metadata = {
  title: "Faturas | LocadoraFácil",
};

export default function FaturasPage() {
  return (
    <>
      <Header breadcrumbs={[{ label: "Faturas" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Faturas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Emissão e controle de notas por cliente e orçamento
          </p>
        </div>
        <FaturasList />
      </main>
    </>
  );
}
