"use client";

import type { ProductSortMode } from "@/lib/product-order";

interface ProductSortToggleProps {
  value: ProductSortMode;
  onChange: (mode: ProductSortMode) => void;
  className?: string;
}

const OPTIONS: Array<{ value: ProductSortMode; label: string }> = [
  { value: "code", label: "Código" },
  { value: "updated", label: "Última modificación" },
];

/**
 * Control segmentado compartido por las listas de productos (S4): código por
 * defecto y cambio a última fecha de modificación. El segmento activo usa el
 * mismo rosa que el selector de sucursal (S18/U3), no una caja propia.
 */
export function ProductSortToggle({ value, onChange, className = "" }: ProductSortToggleProps) {
  return (
    <div
      role="group"
      aria-label="Ordenar por"
      className={`inline-flex rounded-xl bg-surface-soft p-1 ${className}`}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`min-h-[44px] rounded-lg px-3 text-sm font-medium transition-colors touch-manipulation ${
            value === option.value
              ? "bg-accent/10 text-brand-rosa-texto"
              : "text-ink-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
