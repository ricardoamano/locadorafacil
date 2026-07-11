"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

interface EtiquetaItem {
  id: string;
  codigo: string;
  nome: string;
  apelidos?: string | null;
}

interface EtiquetaQrModalProps {
  open: boolean;
  onClose: () => void;
  item: EtiquetaItem | null;
}

export function EtiquetaQrModal({ open, onClose, item }: EtiquetaQrModalProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [copias, setCopias] = useState(1);

  useEffect(() => {
    if (!open || !item) return;
    const url = `${window.location.origin}/ativos/itens?search=${encodeURIComponent(
      item.codigo || item.id
    )}`;
    QRCode.toDataURL(url, { width: 480, margin: 1 })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [open, item]);

  useEffect(() => {
    if (open) setCopias(1);
  }, [open]);

  if (!item) return null;

  function imprimir() {
    if (!dataUrl || !item) return;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return;
    const etiqueta = `
      <div class="etiqueta">
        <img src="${dataUrl}" alt="QR" />
        <div class="info">
          <p class="codigo">${item.codigo || ""}</p>
          <p class="nome">${item.nome}</p>
          ${item.apelidos ? `<p class="apelido">${item.apelidos}</p>` : ""}
        </div>
      </div>`;
    w.document.write(`<!doctype html>
<html><head><title>Etiqueta ${item.codigo || item.nome}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 8mm; }
  .etiqueta {
    display: flex; align-items: center; gap: 6mm;
    border: 1px dashed #999; border-radius: 3mm;
    padding: 5mm; margin-bottom: 5mm;
    width: 90mm; height: 40mm; overflow: hidden;
    page-break-inside: avoid;
  }
  .etiqueta img { width: 28mm; height: 28mm; }
  .codigo { font-size: 14pt; font-weight: bold; }
  .nome { font-size: 10pt; margin-top: 2mm; }
  .apelido { font-size: 8pt; font-style: italic; color: #555; margin-top: 1mm; }
  @media print { body { padding: 0; } }
</style></head>
<body>${etiqueta.repeat(Math.max(1, Math.min(20, copias)))}
<script>window.onload = function(){ window.print(); }</script>
</body></html>`);
    w.document.close();
  }

  return (
    <Modal open={open} onClose={onClose} title="Etiqueta do Item (QR Code)">
      <ModalBody>
        <div className="flex flex-col items-center gap-3">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="QR Code do item" className="h-48 w-48" />
          ) : (
            <div className="h-48 w-48 flex items-center justify-center text-slate-400 text-sm">
              Gerando QR code...
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-mono font-bold text-slate-900">
              {item.codigo || "—"}
            </p>
            <p className="text-sm text-slate-700">{item.nome}</p>
            {item.apelidos && (
              <p className="text-xs text-slate-400 italic">{item.apelidos}</p>
            )}
          </div>
          <p className="text-xs text-slate-400 text-center max-w-xs">
            Escaneando o QR code com a câmera do celular, o sistema abre já filtrado
            neste item — útil para conferência de entrada e saída na OS.
          </p>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Cópias:</label>
            <input
              type="number"
              min={1}
              max={20}
              value={copias}
              onChange={(e) => setCopias(parseInt(e.target.value) || 1)}
              className="h-8 w-16 rounded-md border border-slate-200 px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
        {dataUrl && (
          <a
            href={dataUrl}
            download={`etiqueta-${item.codigo || item.id}.png`}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Baixar PNG
          </a>
        )}
        <Button onClick={imprimir} disabled={!dataUrl}>
          <Printer className="h-4 w-4" />
          Imprimir etiqueta
        </Button>
      </ModalFooter>
    </Modal>
  );
}
