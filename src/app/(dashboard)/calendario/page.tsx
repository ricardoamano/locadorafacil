import { Header } from "@/components/layout/header";
import { CalendarioView } from "@/components/calendario/calendario-view";

export const metadata = {
  title: "Calendário | LocadoraFácil",
};

export default function CalendarioPage() {
  return (
    <>
      <Header breadcrumbs={[{ label: "Calendário" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Calendário</h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualize seus eventos por mês — clique em um evento para abrir o orçamento
          </p>
        </div>
        <CalendarioView />
      </main>
    </>
  );
}
