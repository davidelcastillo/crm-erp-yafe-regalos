"use client";

import { useEffect } from "react";

export type CashStep = "movimientos" | "cierre";

export interface CashMenuModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (step: CashStep) => void;
}

const OPCIONES: Array<{ step: CashStep; label: string; hint: string }> = [
  { step: "movimientos", label: "Movimientos de caja", hint: "Ingresos y egresos de una sucursal" },
  { step: "cierre", label: "Cerrar caja", hint: "Corte del turno por sucursal" },
];

/**
 * Primer paso del acceso único a la caja (S4): «Caja» era dos botones que abrían
 * dos modales parecidos, cada uno con su propio paso de sucursal. Acá se elige
 * qué se va a hacer y el paso siguiente es el modal que ya existía, sin
 * duplicar el formulario ni la lista.
 *
 * El ✕ y el Escape cierran; el fondo también, como el resto de los modales.
 */
export const CashMenuModal = ({ open, onClose, onPick }: CashMenuModalProps) => {
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 backdrop-blur-md md:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-menu-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-t-3xl bg-surface p-6 animate-scale-in md:max-w-lg md:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="cash-menu-title" className="text-xl font-semibold text-ink">
              Caja
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Elegí qué querés hacer</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-icon btn-round text-ink-muted hover:bg-surface-strong"
            aria-label="Cerrar"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {OPCIONES.map((opcion) => (
            <button
              key={opcion.step}
              type="button"
              onClick={() => onPick(opcion.step)}
              className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface-soft px-4 py-3 text-left transition-colors hover:bg-surface-strong touch-manipulation"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-base font-medium text-ink">{opcion.label}</span>
                <span className="text-xs text-ink-muted">{opcion.hint}</span>
              </span>
              <svg
                className="h-5 w-5 shrink-0 text-ink-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
