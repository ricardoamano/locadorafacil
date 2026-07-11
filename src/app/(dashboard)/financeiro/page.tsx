import { Header } from "@/components/layout/header";
import { TransacoesList } from "@/components/financeiro/transacoes-list";

export const metadata = {
  title: "Financeiro | LocadoraFácil",
};

export default function FinanceiroPage() {
  return (
    <>
      <Header breadcrumbs={[{ label: "Financeiro" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-sm text-slate-500 mt-1">
            Controle de receitas, despesas e saldo
          </p>
        </div>
        <TransacoesList />
      </main>
    </>
  );
}
