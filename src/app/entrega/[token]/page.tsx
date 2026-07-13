"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { PackageCheck, Check, Printer, Eraser } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

function fmtData(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}

// Assinatura desenhada com o dedo/mouse — devolve o dataURL (PNG).
function CanvasAssinatura({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const vazio = useRef(true);

  const pos = (e: React.PointerEvent) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };

  function start(e: React.PointerEvent) {
    e.preventDefault();
    desenhando.current = true;
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent) {
    if (!desenhando.current) return;
    e.preventDefault();
    const ctx = ref.current!.getContext("2d")!;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    vazio.current = false;
  }
  function end() {
    if (!desenhando.current) return;
    desenhando.current = false;
    onChange(vazio.current ? null : ref.current!.toDataURL("image/png"));
  }
  function limpar() {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    vazio.current = true;
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={ref}
        width={600}
        height={180}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full h-40 rounded-lg border-2 border-dashed border-slate-300 bg-white touch-none"
      />
      <button
        type="button"
        onClick={limpar}
        className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <Eraser className="h-3.5 w-3.5" /> Limpar assinatura
      </button>
    </div>
  );
}

export default function EntregaPublicaPage() {
  const params = useParams<{ token: string }>();
  const [dados, setDados] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  const [doc, setDoc] = useState("");
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aceito, setAceito] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/entrega/${params.token}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDados(d);
      if (d.aceite) setAceito(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Termo não encontrado.");
    } finally {
      setLoading(false);
    }
  }, [params.token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function darDeAcordo() {
    if (nome.trim().length < 3) return setErro("Informe seu nome completo.");
    if (!assinatura) return setErro("Assine no quadro acima.");
    setErro("");
    setEnviando(true);
    try {
      const res = await fetch(`/api/entrega/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteNome: nome, clienteDoc: doc, assinatura }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAceito(true);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar.");
    } finally {
      setEnviando(false);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );

  if (erro && !dados)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-4xl mb-3">🔍</p>
          <h1 className="text-lg font-semibold text-slate-800">{erro}</h1>
        </div>
      </div>
    );

  const ev = dados.evento;
  const itens = dados.itens || [];
  const aceite = dados.aceite;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 print:bg-white">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Cabeçalho */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
          {dados.empresa?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dados.empresa.logoUrl} alt="" className="max-h-12 mx-auto mb-2 object-contain" />
          ) : (
            <p className="text-sm font-semibold text-slate-700 mb-1">{dados.empresa?.name}</p>
          )}
          <h1 className="text-lg font-bold text-slate-900">Termo de Permanência</h1>
          <p className="text-xs text-slate-500 mt-1">
            OS #{ev?.numero} · {ev?.nome || "Evento"} · {fmtData(ev?.data)}
          </p>
          {ev?.cliente && <p className="text-sm text-slate-600 mt-1">{ev.cliente}</p>}
        </div>

        {/* Itens que ficaram */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <PackageCheck className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Equipamentos que ficaram com você
            </h2>
          </div>
          {itens.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum item permaneceu no evento.</p>
          ) : (
            <ul className="text-sm divide-y divide-slate-50">
              {itens.map((i: any) => (
                <li key={i.itemId} className="flex justify-between py-1.5">
                  <span className="text-slate-700">
                    {i.codigo && <span className="font-mono text-slate-400 mr-1">{i.codigo}</span>}
                    {i.nome}
                  </span>
                  <span className="font-bold text-slate-800">{i.ficou}x</span>
                </li>
              ))}
            </ul>
          )}
          {dados.observacoes && (
            <p className="text-xs text-slate-500 mt-3 border-t border-slate-50 pt-2 whitespace-pre-wrap">
              {dados.observacoes}
            </p>
          )}
        </div>

        {/* Aceite */}
        {aceito || aceite ? (
          <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 text-center">
            <Check className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-emerald-800">Recebimento confirmado!</p>
            <p className="text-xs text-emerald-700 mt-1">
              {aceite?.clienteNome ? `Por ${aceite.clienteNome}` : ""}
              {aceite?.em ? ` em ${new Date(aceite.em).toLocaleString("pt-BR")}` : ""}
            </p>
            {aceite?.assinatura && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={aceite.assinatura}
                alt="assinatura"
                className="max-h-20 mx-auto mt-3 object-contain"
              />
            )}
            <button
              onClick={() => window.print()}
              className="print:hidden mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-emerald-200 bg-white text-sm font-medium text-emerald-700"
            >
              <Printer className="h-4 w-4" /> Salvar comprovante (PDF)
            </button>
          </div>
        ) : itens.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <p className="text-sm text-slate-600">
              Confirmo que recebi e fico responsável pelos equipamentos listados acima.
            </p>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo *"
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              placeholder="CPF / RG (opcional)"
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1">Assinatura *</p>
              <CanvasAssinatura onChange={setAssinatura} />
            </div>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            <button
              onClick={darDeAcordo}
              disabled={enviando}
              className="w-full h-11 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4" />
              {enviando ? "Registrando..." : "Dou de acordo e recebi"}
            </button>
          </div>
        ) : null}

        <p className="text-center text-xs text-slate-400 pb-4">
          {dados.empresa?.name}
          {dados.empresa?.telefone ? ` · ${dados.empresa.telefone}` : ""}
        </p>
      </div>
    </div>
  );
}
