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
      <div className="inline-flex items-center px-3 py-2 text-sm text-[#6a6a6a]">
        Cargando sucursales...
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1" ref={ref}>
      {label && (
        <span className="text-xs text-[#6a6a6a] font-medium">{label}</span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-between gap-2 px-4 py-2 bg-[#f8f8f8] rounded-xl text-sm text-[#222222] hover:bg-[#f2f2f2] transition-colors min-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedName}</span>
        <svg
          className={`w-4 h-4 text-[#6a6a6a] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto min-w-[180px]"
          role="listbox"
        >
          {!hideAllOption && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-[#f8f8f8] transition-colors ${
                selectedBranchId === null ? "bg-[#3b82f6]/10 text-[#3b82f6] font-medium" : "text-[#222222]"
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
              className={`w-full text-left px-4 py-2 text-sm hover:bg-[#f8f8f8] transition-colors ${
                selectedBranchId === b.id ? "bg-[#3b82f6]/10 text-[#3b82f6] font-medium" : "text-[#222222]"
              }`}
              role="option"
              aria-selected={selectedBranchId === b.id}
            >
              {b.name}
            </button>
          ))}
          {branches.length === 0 && (
            <div className="px-4 py-3 text-sm text-[#6a6a6a]">
              No hay sucursales activas
            </div>
          )}
        </div>
      )}
    </div>
  );
}