import { Sidebar } from "@/components/layout/sidebar";
import { AuditoriaAcesso } from "@/components/layout/auditoria-acesso";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
      >
        Pular para o conteúdo
      </a>
      <AuditoriaAcesso />
      <Sidebar />
      <div id="conteudo" role="main" className="md:ml-60">
        {children}
      </div>
    </div>
  );
}
