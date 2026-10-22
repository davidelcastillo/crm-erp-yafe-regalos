"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Acción de página como tarjeta de vidrio: la forma de tener las acciones a la
 * vista en mobile, donde el encabezado va en una sola fila (ver `PageHeader`).
 * Desde desktop las mismas acciones se pasan a `PageHeader` como botones.
 *
 * Con `href` la tarjeta es un link real (navegación); sin `href`, una acción.
 */
export interface ActionCardProps {
  label: string;
  hint?: string;
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
}

const CARD_CLASS =
  "flex flex-1 min-w-0 min-h-[72px] items-center gap-3 rounded-2xl glass px-4 py-3 text-left transition-colors hover:bg-white/80 touch-manipulation";

export const ActionCard = ({ label, hint, icon, onClick, href }: ActionCardProps) => {
  const contenido = (
    <>
      {icon && (
        <span className="text-ink" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-ink break-words">{label}</span>
        {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={CARD_CLASS}>
        {contenido}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={CARD_CLASS}>
      {contenido}
    </button>
  );
};
