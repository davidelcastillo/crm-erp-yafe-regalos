// src/components/ui/BranchSelector.tsx
"use client";

import { useBranch } from "@/lib/context/BranchContext";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

type BranchSelectorProps = {
  /** Called whenever the selection changes. */
  onChange?: (branchId: number | null) => void;
  /** Hide the "All Branches" aggregate option. */
  hideAllOption?: boolean;
  /** Disable the selector. */
  disabled?: boolean;
  /** Optional label rendered above the dropdown. */
  label?: string;
  /** Controlled value (branchId). If provided, the component does not write to BranchContext. */
  value?: number | null;
  /** Ocupa todo el ancho en mobile (su propia línea); en desktop se ajusta al contenido. */
  block?: boolean;
};

/** Ancho mínimo del desplegable (9.5rem), como el trigger histórico. */
const ANCHO_MINIMO = 152;
/** Aire a los costados para que el panel nunca toque el borde de la pantalla. */
const MARGEN = 8;

/** Fila del desplegable: la elegida va en rosa de texto, nunca en bloque azul. */
const OPCION_BASE =
  "block w-full min-h-[44px] truncate text-left px-4 py-3 text-sm hover:bg-surface-soft transition-colors";
const OPCION_ELEGIDA = "bg-accent/10 text-brand-rosa-texto font-medium";
const OPCION_NORMAL = "text-ink";

/**
 * Reusable branch selector dropdown.
 * In uncontrolled mode (no value prop), reads/writes the global BranchContext so every consumer stays in sync.
 * In controlled mode (value prop provided), uses the prop as selected value and calls onChange on changes.
 *
 * El desplegable vive en un **portal al `body`** con posición `fixed` calculada
 * desde el trigger: dentro del árbol de la página cualquier ancestro con
 * `transform` (el parallax del encabezado), `filter`, `backdrop-filter` o
 * `isolation` lo encierra en su contexto de apilado, y su `z-50` deja de valer
 * frente a los gráficos y las cards que vienen después en el documento.
 */
export function BranchSelector({
  onChange,
  hideAllOption = false,
  disabled = false,
  label,
  value,
  block = false,
}: BranchSelectorProps) {
  const { branchId: contextBranchId, branches, ready, setBranchId } = useBranch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);

  // Determine selected branchId: controlled value overrides context
  const selectedBranchId = value !== undefined ? value : contextBranchId;

  // Medida del panel a partir del trigger, siempre dentro de la pantalla: con un
  // nombre de sucursal largo el desplegable se salía por el costado.
  const medir = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const medida = trigger.getBoundingClientRect();
    const disponible = window.innerWidth - MARGEN * 2;
    const width = Math.min(Math.max(medida.width, ANCHO_MINIMO), disponible);
    const left = Math.min(Math.max(medida.left, MARGEN), window.innerWidth - width - MARGEN);
    setRect({ left, top: medida.bottom + 4, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    medir();
    window.addEventListener("resize", medir);
    // `capture`: cualquier contenedor que scrollee mueve el trigger con el panel abierto.
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [open, medir]);

  // Close dropdown when clicking outside (fuera del trigger o del panel portado)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedName =
    selectedBranchId === null
      ? "Todas las sucursales"
      : branches.find((b) => b.id === selectedBranchId)?.name ?? "Sucursal no encontrada";

  function handleSelect(id: number | null) {
    // In controlled mode, we do not call setBranchId (avoid writing to context)
    if (value === undefined) {
      // uncontrolled: update context
      setBranchId(id);
    }
    onChange?.(id);
    setOpen(false);
  }

  if (!ready) {
    return (
      <div className="inline-flex items-center px-3 py-2 text-sm text-ink-muted">
        Cargando sucursales...
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex min-w-0 flex-col gap-1 ${
        block ? "w-full md:w-auto" : "max-w-full"
      }`}
      ref={ref}
    >
      {label && (
        <span
          className={`text-xs text-ink-muted font-medium ${
            block ? "block md:hidden" : "hidden sm:block"
          }`}
        >
          {label}
        </span>
      )}
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={
          block
            ? "inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl bg-surface-soft px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-strong disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            : "inline-flex min-h-[44px] max-w-[9.5rem] items-center justify-between gap-2 rounded-xl bg-surface-soft px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-strong disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation sm:max-w-none sm:px-4"
        }
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedName}</span>
        <svg
          className={`w-4 h-4 shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{ position: "fixed", left: rect.left, top: rect.top, width: rect.width }}
            className="z-[60] max-h-60 overflow-y-auto rounded-xl border border-hairline bg-surface shadow-lg"
          >
            {!hideAllOption && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`${OPCION_BASE} ${
                  selectedBranchId === null ? OPCION_ELEGIDA : OPCION_NORMAL
                }`}
                role="option"
                aria-selected={selectedBranchId === null}
              >
                Todas las sucursales
              </button>
            )}
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSelect(b.id)}
                className={`${OPCION_BASE} ${
                  selectedBranchId === b.id ? OPCION_ELEGIDA : OPCION_NORMAL
                }`}
                role="option"
                aria-selected={selectedBranchId === b.id}
              >
                {b.name}
              </button>
            ))}
            {branches.length === 0 && (
              <div className="px-4 py-3 text-sm text-ink-muted">
                No hay sucursales activas
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
