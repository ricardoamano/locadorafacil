import { Header } from "@/components/layout/header";
import { OsList } from "@/components/ordens-servico/os-list";

export const metadata = {
  title: "Ordens de Serviço | LocadoraFácil",
};

export default function OrdensServicoPage() {
  return (
    <>
      <Header breadcrumbs={[{ label: "Ordens de Serviço" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Ordens de Serviço</h1>
          <p className="text-sm text-slate-500 mt-1">
            Operação dos eventos aprovados: horários, equipamentos e escala de equipe
          </p>
        </div>
        <OsList />
      </main>
    </>
  );
}
