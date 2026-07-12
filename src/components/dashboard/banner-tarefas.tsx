"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

// Banner de tarefas pendentes com dismiss persistido por sessão
export function BannerTarefas({ quantidade }: { quantidade: number }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    setVisivel(sessionStorage.getItem("bannerTarefasDismiss") !== "1");
  }, []);

  if (!visivel) return null;

  return (
    <div className="mt-6 bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
      <p className="text-sm text-yellow-800 flex-1">
        Você tem <strong>{quantidade} tarefa(s) pendente(s)</strong>.{" "}
        <Link href="/tarefas" className="underline font-medium hover:text-yellow-900">
          Ver tarefas
        </Link>
      </p>
      <button
        onClick={() => {
          sessionStorage.setItem("bannerTarefasDismiss", "1");
          setVisivel(false);
        }}
        className="p-1 rounded-md text-yellow-600 hover:bg-yellow-100 transition-colors shrink-0"
        title="Dispensar até o próximo login"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
