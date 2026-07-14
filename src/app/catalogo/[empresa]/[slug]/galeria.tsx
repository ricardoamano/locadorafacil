"use client";

import React, { useState } from "react";
import { Package } from "lucide-react";

// Galeria estilo e-commerce: foto grande em destaque + miniaturas clicáveis.
export function GaleriaCatalogo({ fotos, nome }: { fotos: string[]; nome: string }) {
  const [sel, setSel] = useState(0);

  if (fotos.length === 0) {
    return (
      <div className="w-full aspect-square rounded-2xl border border-slate-100 bg-white flex items-center justify-center">
        <Package className="h-20 w-20 text-slate-200" />
      </div>
    );
  }

  const atual = fotos[Math.min(sel, fotos.length - 1)];

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={atual}
        alt={nome}
        className="w-full rounded-2xl border border-slate-100 bg-white object-contain aspect-square"
      />
      {fotos.length > 1 && (
        <div className="grid grid-cols-5 gap-2 mt-2">
          {fotos.slice(0, 10).map((foto, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSel(i)}
              className={`rounded-lg border-2 overflow-hidden bg-white transition-colors ${
                i === sel ? "border-blue-500" : "border-slate-100 hover:border-slate-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto}
                alt={`${nome} — foto ${i + 1}`}
                className="w-full aspect-square object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
