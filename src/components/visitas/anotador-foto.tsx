"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";

// Anotação colorida sobre a foto (desenho à mão livre) — funciona com dedo
// no celular. Ao salvar, devolve a imagem mesclada (JPEG) via onSalvar.

const CORES = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ffffff", "#000000"];

export function AnotadorFoto({
  url,
  open,
  onClose,
  onSalvar,
}: {
  url: string;
  open: boolean;
  onClose: () => void;
  onSalvar: (blob: Blob) => Promise<void> | void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const desenhando = useRef(false);
  const [cor, setCor] = useState(CORES[0]);
  const [espessura, setEspessura] = useState(6);
  const [tracos, setTracos] = useState<{ cor: string; espessura: number; pontos: { x: number; y: number }[] }[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Carrega a imagem e dimensiona o canvas
  useEffect(() => {
    if (!open) return;
    setTracos([]);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const c = canvasRef.current;
      if (!c) return;
      // Limita a 1600px no maior lado (arquivo final leve)
      const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      redesenhar([]);
    };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, url]);

  const redesenhar = useCallback(
    (lista: typeof tracos) => {
      const c = canvasRef.current;
      const img = imgRef.current;
      if (!c || !img) return;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      for (const t of lista) {
        ctx.strokeStyle = t.cor;
        ctx.lineWidth = t.espessura;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        t.pontos.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      }
    },
    []
  );

  useEffect(() => {
    redesenhar(tracos);
  }, [tracos, redesenhar]);

  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    };
  }

  function start(e: React.PointerEvent) {
    e.preventDefault();
    desenhando.current = true;
    setTracos((p) => [...p, { cor, espessura, pontos: [pos(e)] }]);
  }
  function move(e: React.PointerEvent) {
    if (!desenhando.current) return;
    e.preventDefault();
    const pt = pos(e);
    setTracos((p) => {
      const novo = [...p];
      novo[novo.length - 1] = {
        ...novo[novo.length - 1],
        pontos: [...novo[novo.length - 1].pontos, pt],
      };
      return novo;
    });
  }
  function end() {
    desenhando.current = false;
  }

  async function salvar() {
    const c = canvasRef.current;
    if (!c) return;
    setSalvando(true);
    c.toBlob(
      async (blob) => {
        if (blob) await onSalvar(blob);
        setSalvando(false);
        onClose();
      },
      "image/jpeg",
      0.88
    );
  }

  return (
    <Modal open={open} onClose={() => !salvando && onClose()} title="Anotar na foto" size="lg">
      <ModalBody>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {CORES.map((c) => (
            <button
              key={c}
              onClick={() => setCor(c)}
              className={`h-8 w-8 rounded-full border-2 ${
                cor === c ? "border-slate-800 scale-110" : "border-slate-200"
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <select
            value={espessura}
            onChange={(e) => setEspessura(Number(e.target.value))}
            className="h-8 rounded-lg border border-slate-200 px-2 text-sm"
          >
            <option value={4}>Fino</option>
            <option value={6}>Médio</option>
            <option value={12}>Grosso</option>
          </select>
          <button
            onClick={() => setTracos((p) => p.slice(0, -1))}
            disabled={tracos.length === 0}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-slate-200 text-sm text-slate-600 disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" /> Desfazer
          </button>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full rounded-lg border border-slate-200 touch-none"
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={salvando}>
          Cancelar
        </Button>
        <Button onClick={salvar} loading={salvando}>
          Salvar anotações
        </Button>
      </ModalFooter>
    </Modal>
  );
}
