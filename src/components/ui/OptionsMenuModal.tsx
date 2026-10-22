"use client";

import { useEffect } from "react";

export interface MenuOption {
  id: string;
  label: string;
  hint?: string;
}

export interface OptionsMenuModalProps {
  open: boolean;
  /** Título del paso 1; es también el nombre accesible del diálogo. */
  title: string;
  subtitle?: string;
  options: MenuOption[];
  onClose: () => void;
  onPick: (id: string) => void;
}

/**
 * Paso 1 de un acceso único (S4): cuando dos o más botones abren variantes de lo
 * mismo —«Caja» y «Cerrar caja», «Exportar» y «Etiquetas»—, la página muestra un
 * solo acceso visible que abre este menú y **acá** se elige qué se va a hacer;
 * el paso 2 es el modal de siempre.
 *
 * El ✕, el Escape y el fondo cierran, como el resto de los modales del sistema.
 */
export const OptionsMenuModal = ({
  open,
  title,
  subtitle = "Elegí qué querés hacer",
  options,
  onClose,
  onPick,
}: OptionsMenuModalProps) => {
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const titleId = "options-menu-title";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 backdrop-blur-md md:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-t-3xl bg-surface p-6 animate-scale-in md:max-w-lg md:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-ink">
              {title}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
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
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onPick(option.id)}
              className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface-soft px-4 py-3 text-left transition-colors hover:bg-surface-strong touch-manipulation"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-base font-medium text-ink">{option.label}</span>
                {option.hint && <span className="text-xs text-ink-muted">{option.hint}</span>}
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
