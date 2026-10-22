// src/components/ui/BranchSelector.tsx
"use client";

import { useBranch } from "@/lib/context/BranchContext";
import { useState, useRef, useEffect } from "react";

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

/**
 * Reusable branch selector dropdown.
 * In uncontrolled mode (no value prop), reads/writes the global BranchContext so every consumer stays in sync.
 * In controlled mode (value prop provided), uses the prop as selected value and calls onChange on changes.
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

  // Determine selected branchId: controlled value overrides context
  const selectedBranchId = value !== undefined ? value : contextBranchId;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
          className={`w-4 h-4 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-hairline bg-surface shadow-lg ${
            block ? "w-full" : "min-w-[9.5rem]"
          }`}
          role="listbox"
        >
          {!hideAllOption && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-soft transition-colors ${
                selectedBranchId === null ? "bg-info/10 text-info font-medium" : "text-ink"
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
              className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-soft transition-colors ${
                selectedBranchId === b.id ? "bg-info/10 text-info font-medium" : "text-ink"
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
        </div>
      )}
    </div>
  );
}