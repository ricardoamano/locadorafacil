import { Header } from "@/components/layout/header";
import { ContactsList } from "@/components/contacts/contacts-list";

export const metadata = {
  title: "Fornecedores | LocadoraFácil",
};

export default function FornecedoresPage() {
  return (
    <>
      <Header breadcrumbs={[{ label: "Fornecedores" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Fornecedores</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie seus fornecedores e contatos
          </p>
        </div>
        <ContactsList type="FORNECEDOR" />
      </main>
    </>
  );
}
