"use client";

import { useState } from "react";
import type { StockMovementReceipt, StockMovementSide } from "@/lib/stock-movement-receipt";

type PrendaTamano = "grande" | "mediana";

/** Los dos tamaños de la etiqueta de prenda. */
const TAMANOS_PRENDA: Array<{ id: PrendaTamano; label: string }> = [
  { id: "grande", label: "Grande 50 × 80 mm" },
  { id: "mediana", label: "Mediana 35 × 58 mm" },
];

export function StockMovementReceiptPanel({
  receipt, onClose,
}: { receipt: StockMovementReceipt; onClose: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pasos extra del comprobante con etiquetas: qué es prenda, tamaño y peluches.
  const [showExtras, setShowExtras] = useState(false);
  const [prendaIds, setPrendaIds] = useState<number[]>([]);
  const [tamano, setTamano] = useState<PrendaTamano | null>(null);
  const [pelucheIds, setPelucheIds] = useState<number[]>([]);
  const label = { ENTRY: "Ingreso", EXIT: "Egreso", TRANSFER: "Movimiento de sucursal" }[receipt.movementType];
  const isTransfer = receipt.movementType === "TRANSFER";
  const isEntry = receipt.movementType === "ENTRY";
  // El traslado lleva etiquetas del lado que recibe: es el que ingresa mercadería.
  const labelsButtonLabel = isTransfer
    ? "Comprobante de la sucursal que recibe + etiquetas"
    : "Comprobante + etiquetas";
  const downloadError = "El movimiento ya se registró, pero no se pudo generar el PDF. Reintentá la descarga sin repetir la operación.";

  /** Único lugar que crea el Blob y el enlace de descarga. */
  const savePdf = (bytes: Uint8Array, filename: string) => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const download = async (side: StockMovementSide) => {
    setGenerating(true);
    setError(null);
    try {
      const { generateStockMovementPdf } = await import("@/lib/utils/stock-movement-pdf");
      const sanitize = (value: string) => value.replace(/[^a-z0-9_-]/gi, "_");
      const stamp = receipt.date.replace(/[^0-9TZ]/g, "");
      const kind = isTransfer
        ? `traslado-${side === "SOURCE" ? "origen" : "destino"}-${sanitize(side === "SOURCE" ? receipt.sourceBranchCode ?? "" : receipt.branchCode)}`
        : `${isEntry ? "ingreso" : "egreso"}-${sanitize(receipt.branchCode)}`;
      savePdf(await generateStockMovementPdf(receipt, side), `comprobante-${kind}-${stamp}.pdf`);
    } catch {
      setError(downloadError);
    } finally {
      setGenerating(false);
    }
  };

  /** S2: el comprobante y las etiquetas de lo movido salen en un solo PDF. */
  const runWithLabels = async (extra: {
    prendaTamano?: PrendaTamano;
    pelucheIds?: number[];
  } = {}) => {
    setGenerating(true);
    setError(null);
    try {
      const { generateEntryReceiptWithLabels } = await import("@/actions/label-print");
      const result = await generateEntryReceiptWithLabels({
        ...receipt,
        ...(extra.prendaTamano ? { prendaTamano: extra.prendaTamano } : {}),
        ...(extra.pelucheIds?.length ? { pelucheIds: extra.pelucheIds } : {}),
      });
      if (!result.success) throw new Error(result.error);
      const bytes = Uint8Array.from(atob(result.data.pdfBase64), (char) => char.charCodeAt(0));
      savePdf(bytes, result.data.filename);
    } catch {
      setError(downloadError);
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Antes de imprimir pregunta lo mismo que el wizard de etiquetas: si el
   * movimiento trae prendas, el tamaño de su etiqueta y cuáles son peluches. Sin
   * prendas va derecho al PDF combinado, como siempre.
   */
  const requestLabels = async () => {
    setGenerating(true);
    setError(null);

    let prendas: number[];
    try {
      const { detectPrendaProducts } = await import("@/actions/label-print");
      const deteccion = await detectPrendaProducts({
        productIds: receipt.rows.map((row) => row.productId),
      });
      if (!deteccion.success) throw new Error(deteccion.error);
      prendas = deteccion.data.prendaIds;
    } catch {
      setGenerating(false);
      setError(downloadError);
      return;
    }

    if (prendas.length === 0) {
      await runWithLabels();
      return;
    }

    setPrendaIds(prendas);
    setTamano(null);
    setPelucheIds([]);
    setShowExtras(true);
    setGenerating(false);
  };

  const togglePeluche = (id: number) => {
    setPelucheIds((prev) =>
      prev.includes(id) ? prev.filter((marcado) => marcado !== id) : [...prev, id]
    );
  };

  // Las prendas ya se imprimen con su etiqueta: no se ofrecen como peluche.
  const pelucheCandidatos = receipt.rows.filter((row) => !prendaIds.includes(row.productId));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim px-4 backdrop-blur-md">
      <section role="dialog" aria-modal="true" aria-labelledby="stock-receipt-title" aria-busy={generating}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !generating) onClose();
          if (event.key !== "Tab") return;
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        className="w-full max-w-xl rounded-2xl bg-surface p-6 max-h-[90vh] overflow-y-auto">
        <h2 id="stock-receipt-title" className="text-xl font-semibold text-ink">{label} registrado</h2>
        <p className="mt-3 text-base text-ink-body">
          {isTransfer ? `${receipt.sourceBranchName} → ${receipt.branchName}` : receipt.branchName}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          El stock ya se actualizó. Podés descargar el comprobante, con o sin etiquetas,
          antes de cerrar. Descargarlo no vuelve a registrar el movimiento.
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}

        {/* Pasos extra: la ropa lleva su etiqueta y los peluches la chica. */}
        {showExtras && (
          <div className="mt-6">
            <h3 className="text-base font-semibold text-ink">Tamaño de la etiqueta de prenda</h3>
            <p className="mt-1 mb-3 text-sm text-ink-muted">
              Las prendas del movimiento salen con la etiqueta de ropa, una por talle y variante
              según la cantidad.
            </p>
            <div role="group" aria-label="Tamaño de la etiqueta de prenda" className="space-y-2">
              {TAMANOS_PRENDA.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => setTamano(id)} aria-pressed={tamano === id}
                  className={`w-full min-h-12 rounded-xl border px-4 py-3 text-left text-sm transition-colors touch-manipulation ${
                    tamano === id
                      ? "border-accent bg-surface-soft font-semibold text-ink"
                      : "border-hairline text-ink-body"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <h3 className="mt-5 text-base font-semibold text-ink">¿Lleva peluches?</h3>
            <p className="mt-1 mb-3 text-sm text-ink-muted">
              Marcá cuáles de los productos son peluches: salen con la etiqueta chica.
            </p>
            {pelucheCandidatos.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pelucheCandidatos.map((row) => (
                  <label key={row.productId}
                    className="flex items-center gap-3 p-3 min-h-11 rounded-xl bg-surface-soft cursor-pointer touch-manipulation">
                    <input type="checkbox" checked={pelucheIds.includes(row.productId)}
                      onChange={() => togglePeluche(row.productId)}
                      aria-label={`Marcar ${row.name} como peluche`}
                      className="w-5 h-5 accent-accent" />
                    <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{row.name}</span>
                    <span className="text-xs text-ink-muted">{row.code}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-ink-muted">
                No hay productos para marcar como peluche
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-center md:flex-wrap">
              <button type="button" className="btn btn-primary min-h-12" autoFocus
                onClick={() => runWithLabels({ prendaTamano: tamano ?? undefined, pelucheIds })}
                disabled={generating || tamano === null}>
                {generating ? "Generando PDF…" : "Generar PDF con etiquetas"}
              </button>
              <button type="button" className="btn btn-secondary min-h-12"
                onClick={() => setShowExtras(false)} disabled={generating}>
                Volver
              </button>
            </div>
          </div>
        )}

        <div className={`mt-6 flex flex-col gap-3 md:flex-row md:justify-center md:flex-wrap ${showExtras ? "hidden" : ""}`}>
          {/* S16: con etiquetas disponibles el combinado es el principal y va primero. */}
          <button type="button" className="btn btn-primary min-h-12" autoFocus
            onClick={requestLabels} disabled={generating}>
            {generating ? "Generando PDF…" : labelsButtonLabel}
          </button>
          {isTransfer && (
            <>
              <button type="button" className="btn btn-secondary min-h-12"
                onClick={() => download("DESTINATION")} disabled={generating}>
                {generating ? "Generando PDF…" : "Comprobante de la sucursal que recibe"}
              </button>
              <button type="button" className="btn btn-secondary min-h-12"
                onClick={() => download("SOURCE")} disabled={generating}>
                {generating ? "Generando PDF…" : "Comprobante de la sucursal que envía"}
              </button>
            </>
          )}
          {!isTransfer && (
            <button type="button" className="btn btn-secondary min-h-12"
              onClick={() => download("DESTINATION")} disabled={generating}>
              {generating ? "Generando PDF…" : "Descargar comprobante"}
            </button>
          )}
          <button type="button" className="btn btn-secondary min-h-12" onClick={onClose} disabled={generating}>
            Cerrar comprobante
          </button>
        </div>
      </section>
    </div>
  );
}
