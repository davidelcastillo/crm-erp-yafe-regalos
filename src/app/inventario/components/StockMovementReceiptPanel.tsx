"use client";

import { useState } from "react";
import type { StockMovementReceipt, StockMovementSide } from "@/lib/stock-movement-receipt";

export function StockMovementReceiptPanel({
  receipt, onClose,
}: { receipt: StockMovementReceipt; onClose: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = { ENTRY: "Ingreso", EXIT: "Egreso", TRANSFER: "Movimiento de sucursal" }[receipt.movementType];
  const isTransfer = receipt.movementType === "TRANSFER";

  const download = async (side: StockMovementSide) => {
    setGenerating(true);
    setError(null);
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const { generateStockMovementPdf } = await import("@/lib/utils/stock-movement-pdf");
      const bytes = await generateStockMovementPdf(receipt, side);
      url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      link = document.createElement("a");
      link.href = url;
      const sanitize = (value: string) => value.replace(/[^a-z0-9_-]/gi, "_");
      const stamp = receipt.date.replace(/[^0-9TZ]/g, "");
      const kind = isTransfer
        ? `traslado-${side === "SOURCE" ? "origen" : "destino"}-${sanitize(side === "SOURCE" ? receipt.sourceBranchCode ?? "" : receipt.branchCode)}`
        : `${receipt.movementType === "ENTRY" ? "ingreso" : "egreso"}-${sanitize(receipt.branchCode)}`;
      link.download = `comprobante-${kind}-${stamp}.pdf`;
      document.body.appendChild(link);
      link.click();
    } catch {
      setError("El movimiento ya se registró, pero no se pudo generar el PDF. Reintentá la descarga sin repetir la operación.");
    } finally {
      link?.remove();
      if (url) URL.revokeObjectURL(url);
      setGenerating(false);
    }
  };

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
          El stock ya se actualizó. Podés descargar el comprobante antes de cerrar.
          Descargarlo no vuelve a registrar el movimiento.
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-end md:flex-wrap">
          {isTransfer && (
            <>
              <button type="button" className="btn btn-primary min-h-12" autoFocus
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
            <button type="button" className="btn btn-primary min-h-12" autoFocus
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
