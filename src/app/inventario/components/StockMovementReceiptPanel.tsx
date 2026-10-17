"use client";

import { useState } from "react";
import type { StockMovementReceipt } from "@/lib/stock-movement-receipt";

export function StockMovementReceiptPanel({
  receipt, onClose,
}: { receipt: StockMovementReceipt; onClose: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = { ENTRY: "Ingreso", EXIT: "Egreso", TRANSFER: "Movimiento de sucursal" }[receipt.movementType];

  const download = async () => {
    setGenerating(true);
    setError(null);
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const { generateStockMovementPdf } = await import("@/lib/utils/stock-movement-pdf");
      const bytes = await generateStockMovementPdf(receipt);
      url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      link = document.createElement("a");
      link.href = url;
      const branch = receipt.branchCode.replace(/[^a-z0-9_-]/gi, "_");
      const stamp = receipt.date.replace(/[^0-9TZ]/g, "");
      link.download = `comprobante-${{ ENTRY: "ingreso", EXIT: "egreso", TRANSFER: "traslado" }[receipt.movementType]}-${branch}-${stamp}.pdf`;
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4 backdrop-blur-md">
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
        className="w-full max-w-xl rounded-2xl bg-white p-6 max-h-[90vh] overflow-y-auto">
        <h2 id="stock-receipt-title" className="text-xl font-semibold text-[#222222]">{label} registrado</h2>
        <p className="mt-3 text-base text-[#3f3f3f]">{receipt.branchName}</p>
        <p className="mt-2 text-sm text-[#6a6a6a]">
          El stock ya se actualizó. Podés descargar el comprobante antes de cerrar.
          Descargarlo no vuelve a registrar el movimiento.
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-[#c13515]">{error}</p>}
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-end">
          <button type="button" className="btn btn-primary min-h-12" autoFocus onClick={download} disabled={generating}>
            {generating ? "Generando PDF…" : "Descargar comprobante"}
          </button>
          <button type="button" className="btn btn-secondary min-h-12" onClick={onClose} disabled={generating}>
            Cerrar comprobante
          </button>
        </div>
      </section>
    </div>
  );
}
