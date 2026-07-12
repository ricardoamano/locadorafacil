import React from "react";
import { Download } from "lucide-react";

// Botão de exportação CSV dos cadastros (abre no Excel/Google Sheets)
export function ExportarCsv({ tipo }: { tipo: string }) {
  return (
    <a
      href={`/api/exportar?tipo=${tipo}`}
      className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
      title="Baixar todos os registros em CSV (Excel/Google Sheets)"
    >
      <Download className="h-4 w-4" />
      Exportar CSV
    </a>
  );
}
