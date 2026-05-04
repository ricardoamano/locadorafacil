import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Users,
  FileText,
  DollarSign,
  CheckSquare,
  TrendingUp,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

async function getDashboardData(companyId: string) {
  const [
    totalClientes,
    totalOrcamentos,
    orcamentosAprovados,
    orcamentosAguardando,
    totalReceitas,
    totalDespesas,
    tarefasPendentes,
  ] = await Promise.all([
    prisma.contact.count({ where: { companyId, type: "CLIENTE" } }),
    prisma.orcamento.count({ where: { companyId } }),
    prisma.orcamento.count({ where: { companyId, status: "APROVADO" } }),
    prisma.orcamento.count({ where: { companyId, status: "AGUARDANDO" } }),
    prisma.transacao.aggregate({
      where: { companyId, tipo: "RECEITA", status: "PAGO" },
      _sum: { valor: true },
    }),
    prisma.transacao.aggregate({
      where: { companyId, tipo: "DESPESA", status: "PAGO" },
      _sum: { valor: true },
    }),
    prisma.tarefa.count({
      where: {
        companyId,
        status: { in: ["NAO_INICIADA", "EM_ANDAMENTO", "ATRASADA"] },
      },
    }),
  ]);

  return {
    totalClientes,
    totalOrcamentos,
    orcamentosAprovados,
    orcamentosAguardando,
    totalReceitas: totalReceitas._sum.valor || 0,
    totalDespesas: totalDespesas._sum.valor || 0,
    tarefasPendentes,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) redirect("/login");

  const data = await getDashboardData(companyId);
  const saldo = data.totalReceitas - data.totalDespesas;

  const stats = [
    {
      label: "Total de Clientes",
      value: data.totalClientes,
      icon: Users,
      color: "blue",
    },
    {
      label: "Orçamentos",
      value: data.totalOrcamentos,
      icon: FileText,
      color: "indigo",
    },
    {
      label: "Aprovados",
      value: data.orcamentosAprovados,
      icon: TrendingUp,
      color: "green",
    },
    {
      label: "Aguardando",
      value: data.orcamentosAguardando,
      icon: Clock,
      color: "yellow",
    },
    {
      label: "Saldo Financeiro",
      value: formatCurrency(saldo),
      icon: DollarSign,
      color: saldo >= 0 ? "green" : "red",
    },
    {
      label: "Tarefas Pendentes",
      value: data.tarefasPendentes,
      icon: CheckSquare,
      color: data.tarefasPendentes > 0 ? "orange" : "green",
    },
  ];

  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <>
      <Header breadcrumbs={[{ label: "Dashboard" }]} />
      <main className="pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Visão geral do seu negócio
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    colorMap[stat.color as keyof typeof colorMap]
                  }`}
                >
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.tarefasPendentes > 0 && (
          <div className="mt-6 bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800">
              Você tem{" "}
              <strong>{data.tarefasPendentes} tarefa(s) pendente(s)</strong>.
              Acesse o módulo de tarefas para visualizá-las.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
