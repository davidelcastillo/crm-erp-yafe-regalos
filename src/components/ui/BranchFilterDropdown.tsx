// src/components/ui/BranchFilterDropdown.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { getBranchOptions } from "@/app/actions/branch";

export interface BranchOption {
  id: number;
  name: string;
}

export interface BranchFilterDropdownProps {
  /** Currently selected branch id. null = "Todas las sucursales". */
  selectedId?: number | null;
  /** Called whenever the selection changes. Receives null for "Todas". */
  onValueChange?: (id: number | null) => void;
  /**
   * Legacy alias for `onValueChange`. Kept for backward compatibility with
   * any caller still using the old prop name.
   */
  onChange?: (id: number | null) => void;
  /** Optional label rendered above the dropdown. */
  label?: string;
  /** Disable the whole control. */
  disabled?: boolean;
}

/**
 * BranchFilterDropdown
 *
 * Controlled branch dropdown used to filter inventory by branch. Loads the
 * active branches itself via `getBranchOptions` on mount (it does NOT read or
 * write BranchContext, so the source of truth lives in the caller's state).
 * The "Todas las sucursales" option maps to `null`.
 *
 * Design tokens (Airbnb-inspired, see STYLE.md):
 *  - Acento de marca: la fila elegida usa #ec4899 al 10 % de fondo y el rosa de
 *    texto (`text-brand-rosa-texto`, AA) en el texto.
 *  - surface-soft (#f8f8f8) trigger, 44px minimum tap target.
 */
export function BranchFilterDropdown({
  selectedId = null,
  label,
  disabled = false,
  onChange,
  onValueChange,
}: BranchFilterDropdownProps) {
  const [options, setOptions] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load branch options once on mount (own fetch, no BranchContext).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await getBranchOptions();
        if (!cancelled && result.success && result.data) {
          setOptions(result.data as BranchOption[]);
        }
      } catch (err) {
        console.error("Error loading branch options:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = options.find((o) => o.id === selectedId) ?? null;
  const handleClick = (id: number | null) => {
    onChange?.(id);
    onValueChange?.(id);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      {label && (
        <span className="text-xs text-ink-muted font-medium">{label}</span>
      )}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-between gap-2 px-4 py-3 min-h-[44px] bg-surface-soft rounded-xl text-sm text-ink hover:bg-surface-strong transition-colors min-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">
          {loading
            ? "Cargando…"
            : selected
              ? selected.name
              : "Todas las sucursales"}
        </span>
        <svg
          className={`w-4 h-4 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !loading && (
        <div
          className="absolute z-50 mt-1 bg-surface border border-hairline-soft rounded-xl shadow-lg max-h-60 overflow-y-auto min-w-[200px]"
          role="listbox"
        >
          <button
            type="button"
            onClick={() => handleClick(null)}
            className={`w-full text-left px-4 py-3 min-h-[44px] text-sm hover:bg-surface-soft transition-colors ${
              selectedId === null ? "bg-accent/10 text-brand-rosa-texto font-medium" : "text-ink"
            }`}
            role="option"
            aria-selected={selectedId === null}
          >
            Todas las sucursales
          </button>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => handleClick(o.id)}
              className={`w-full text-left px-4 py-3 min-h-[44px] text-sm hover:bg-surface-soft transition-colors ${
                o.id === selectedId ? "bg-accent/10 text-brand-rosa-texto font-medium" : "text-ink"
              }`}
              role="option"
              aria-selected={o.id === selectedId}
            >
              {o.name}
            </button>
          ))}
          {options.length === 0 && (
            <div className="px-4 py-3 text-sm text-ink-muted">
              No hay sucursales activas
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BranchFilterDropdown;
