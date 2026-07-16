import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Destino do QR da etiqueta: /u/0012-03 → página da unidade (exige login; o
// middleware manda para /login e volta). Se o código não existir, orienta.

export default async function UnidadeQrPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const session = await auth();
  const companyId = (session?.user as { companyId?: string } | undefined)?.companyId;
  if (!companyId) redirect(`/login?callbackUrl=${encodeURIComponent(`/u/${codigo}`)}`);

  const unidade = await prisma.itemUnidade.findFirst({
    where: { companyId, codigo: { equals: decodeURIComponent(codigo), mode: "insensitive" } },
    select: { id: true },
  });
  if (unidade) redirect(`/ativos/unidades/${unidade.id}`);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-4xl mb-3">🔍</p>
        <h1 className="text-lg font-semibold text-slate-800">
          Unidade “{decodeURIComponent(codigo)}” não encontrada
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          A etiqueta pode ser de outro item ou a unidade foi removida.
        </p>
        <Link
          href="/ativos/itens"
          className="inline-block mt-4 text-sm font-medium text-blue-600 hover:underline"
        >
          Ir para Itens
        </Link>
      </div>
    </div>
  );
}
