import { Header } from "@/components/layout/header";
import { LocaisList } from "@/components/locais/locais-list";

export const metadata = {
  title: "Locais | LocadoraFácil",
};

export default function LocaisPage() {
  return (
    <>
      <Header breadcrumbs={[{ label: "Locais" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Locais</h1>
          <p className="text-sm text-slate-500 mt-1">
            Locais de eventos com endereço e localização no mapa
          </p>
        </div>
        <LocaisList />
      </main>
    </>
  );
}
