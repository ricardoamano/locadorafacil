"use client";

import Link from "next/link";
import { SearchX, ArrowLeft } from "lucide-react";

// Estado "não encontrado" amigável, com ação de retorno
export function NaoEncontrado({
  mensagem,
  voltarHref,
  voltarLabel,
}: {
  mensagem: string;
  voltarHref: string;
  voltarLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 p-8 text-center">
      <SearchX className="h-10 w-10 text-slate-300" />
      <p className="text-sm text-slate-500">{mensagem}</p>
      <p className="text-xs text-slate-400">
        O registro pode ter sido excluído ou o link está incorreto.
      </p>
      <Link
        href={voltarHref}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {voltarLabel}
      </Link>
    </div>
  );
}
