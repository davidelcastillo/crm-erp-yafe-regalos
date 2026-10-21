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
 * defecto y cambio a última fecha de modificación.
 */
export function ProductSortToggle({ value, onChange, className = "" }: ProductSortToggleProps) {
  return (
    <div
      role="group"
      aria-label="Ordenar por"
      className={`inline-flex rounded-xl bg-[#f8f8f8] p-1 ${className}`}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`min-h-[44px] rounded-lg px-3 text-sm font-medium transition-colors touch-manipulation ${
            value === option.value ? "bg-white text-[#222222] shadow-sm" : "text-[#6a6a6a]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
