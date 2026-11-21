import type { EstadoVidriera } from "@/app/actions/vidriera";

/**
 * Estado del ítem en la vidriera (spec visual §5): aviso sobre la foto, con
 * fondo opaco para que se lea sobre cualquier imagen y con el nombre escrito,
 * así no depende solo del color. Como `web/catalogo.html`: disponible es una
 * píldora chica y reservada/vendida/agotado son la banda del ancho de la foto.
 */
const ESTADOS: Record<EstadoVidriera, { texto: string; clases: string }> = {
  DISPONIBLE: { texto: "Disponible", clases: "bg-surface text-positive" },
  RESERVADA: { texto: "Reservada · consultá", clases: "w-full bg-col-reservado text-warning" },
  VENDIDA: { texto: "Vendida", clases: "w-full bg-ink text-background" },
  AGOTADO: { texto: "Agotado", clases: "w-full bg-error-surface text-error-ink" },
};

/** Candado: segunda señal de «no disponible», además del color y el texto. */
const Candado = () => (
  <svg
    aria-hidden="true"
    className="size-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

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
      className={`inline-flex items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-center text-[13px] font-semibold ${clases} ${className}`}
    >
      {estado === "VENDIDA" && <Candado />}
      {texto}
    </span>
  );
}
