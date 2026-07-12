import { Header } from "@/components/layout/header";
import { CalendarioView } from "@/components/calendario/calendario-view";
import { IntegracaoAgenda } from "@/components/calendario/integracao-agenda";

export const metadata = {
  title: "Calendário | LocadoraFácil",
};

export default function CalendarioPage() {
  return (
    <>
      <Header breadcrumbs={[{ label: "Calendário" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Calendário</h1>
            <p className="text-sm text-slate-500 mt-1">
              Visualize seus eventos por mês — clique em um evento para abrir o orçamento
            </p>
          </div>
          <IntegracaoAgenda />
        </div>
        <CalendarioView />
      </main>
    </>
  );
}
