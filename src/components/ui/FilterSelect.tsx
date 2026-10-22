"use client";

import { useEffect, useRef, useState } from "react";

export interface FilterSelectOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  /** Nombre visible del filtro; es también el nombre accesible del disparador. */
  label: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

/**
 * FilterSelect
 *
 * El desplegable de filtros del sistema (S18/U3). Imita al `BranchSelector`:
 * la opción activa se pinta con el rosa de la marca —fondo `accent` al 10 % y
 * `text-brand-rosa-texto`—, cosa que un `<select>` nativo no permite.
 *
 * Es para **filtros**. Los `<select>` que son campos de un formulario (cliente
 * en una venta, tipo de movimiento, sucursal de una línea de compra) siguen
 * nativos a propósito.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  className = "",
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  // Cierra al tocar afuera y con Escape, como el resto de los desplegables.
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleSelect = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={label}
        aria-expanded={open}
        className="inline-flex w-full items-center justify-between gap-2 px-4 py-3 min-h-[44px] bg-surface-soft rounded-xl text-sm text-ink hover:bg-surface-strong transition-colors touch-manipulation"
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <svg
          className={`w-4 h-4 shrink-0 text-ink-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-hairline bg-surface shadow-lg">
          {options.map((opcion) => (
            <button
              key={opcion.value}
              type="button"
              onClick={() => handleSelect(opcion.value)}
              aria-current={opcion.value === value ? "true" : undefined}
              className={`w-full min-h-[44px] truncate px-4 py-3 text-left text-sm transition-colors hover:bg-surface-soft ${
                opcion.value === value ? "bg-accent/10 text-brand-rosa-texto font-medium" : "text-ink"
              }`}
            >
              {opcion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default FilterSelect;
