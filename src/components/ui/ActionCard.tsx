"use client";

import type { ReactNode } from "react";

/**
 * Acción de página como tarjeta de vidrio: la forma de tener las acciones a la
 * vista en mobile, donde el encabezado va en una sola fila (ver `PageHeader`).
 * Desde desktop las mismas acciones se pasan a `PageHeader` como botones.
 */
export interface ActionCardProps {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  hint?: string;
}

export const ActionCard = ({ label, onClick, icon, hint }: ActionCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-1 min-h-[72px] items-center gap-3 rounded-2xl glass px-4 py-3 text-left transition-colors hover:bg-white/80 touch-manipulation"
  >
    {icon && (
      <span className="text-[#222222]" aria-hidden="true">
        {icon}
      </span>
    )}
    <span className="flex flex-col">
      <span className="text-sm font-medium text-[#222222]">{label}</span>
      {hint && <span className="text-xs text-[#6a6a6a]">{hint}</span>}
    </span>
  </button>
);
