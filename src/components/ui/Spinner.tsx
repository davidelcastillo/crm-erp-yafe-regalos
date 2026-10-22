"use client";

/**
 * Ruedita de carga: un anillo rosa girando con su etiqueta. Reemplaza al spinner
 * que cada página armaba a mano (mismo dibujo, tamaños y colores distintos).
 *
 * Va acompañada de esqueletos (`CardSkeleton`) cuando lo que se espera es una
 * lista, así la página no salta al terminar la carga.
 */
export interface SpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const TAMANOS = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-4",
} as const;

export const Spinner = ({ label = "Cargando...", size = "md", className = "" }: SpinnerProps) => (
  <div
    className={`flex flex-col items-center gap-3 ${className}`}
    role="status"
    aria-label={label}
  >
    <span
      className={`${TAMANOS[size]} animate-spin rounded-full border-[#fbcfe8] border-t-[#ec4899]`}
    />
    <span className="text-sm text-ink-muted">{label}</span>
  </div>
);
