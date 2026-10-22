"use client";

/**
 * Selector de sucursal en **cards**: reemplaza a los `<select>` de sucursal en los
 * modales que la piden (venta, mover stock, cerrar caja, movimientos de caja,
 * exportar, entrada/salida). En un celular es más fácil de tocar y se ve de un
 * vistazo cuál está elegida.
 *
 * El elegido se marca con el anillo de marca y `aria-pressed`; los excluidos (por
 * ejemplo el origen, al elegir el destino) van deshabilitados.
 */
export interface BranchPickerProps {
  branches: Array<{ id: number; name: string }>;
  value: number | null;
  onChange: (id: number) => void;
  /** Sucursales que no se pueden elegir en este paso. */
  disabledIds?: number[];
  /** Etiqueta accesible del grupo. */
  label: string;
  /** Aviso cuando no hay ninguna sucursal para mostrar. */
  emptyLabel?: string;
  /** Dos columnas desde mobile chico (para listas largas). */
  columns?: 1 | 2;
}

export const BranchPicker = ({
  branches,
  value,
  onChange,
  disabledIds = [],
  label,
  emptyLabel = "No hay sucursales activas",
  columns = 1,
}: BranchPickerProps) => {
  if (branches.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">{emptyLabel}</p>;
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={`grid gap-2 ${columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}
    >
      {branches.map((branch) => {
        const elegida = value === branch.id;
        const excluida = disabledIds.includes(branch.id);

        return (
          <button
            key={branch.id}
            type="button"
            aria-pressed={elegida}
            disabled={excluida}
            onClick={() => onChange(branch.id)}
            className={`w-full min-h-[44px] rounded-2xl bg-surface px-4 py-3 text-left font-medium text-ink transition-all touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed ${
              elegida
                ? "border-2 border-accent ring-2 ring-[#ec4899]/40"
                : "border border-hairline"
            }`}
          >
            {branch.name}
          </button>
        );
      })}
    </div>
  );
};
