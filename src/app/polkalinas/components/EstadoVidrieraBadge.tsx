import type { EstadoVidriera } from "@/app/actions/vidriera";

/**
 * Estado del ítem en la vidriera (spec visual §5): banda sobre la foto, con
 * fondo opaco para que se lea sobre cualquier imagen y con el nombre escrito,
 * así no depende solo del color.
 */
const ESTADOS: Record<EstadoVidriera, { texto: string; clases: string }> = {
  DISPONIBLE: { texto: "Disponible", clases: "bg-surface text-positive" },
  RESERVADA: { texto: "Reservada", clases: "bg-surface text-warning" },
  VENDIDA: { texto: "Vendida", clases: "bg-ink text-background" },
  AGOTADO: { texto: "Agotado", clases: "bg-error-surface text-error-ink" },
};

export function EstadoVidrieraBadge({
  estado,
  className = "",
}: {
  estado: EstadoVidriera;
  className?: string;
}) {
  const { texto, clases } = ESTADOS[estado];

  return (
    <span
      className={`block rounded-[10px] px-2.5 py-2 text-center text-[13px] font-semibold ${clases} ${className}`}
    >
      {texto}
    </span>
  );
}
