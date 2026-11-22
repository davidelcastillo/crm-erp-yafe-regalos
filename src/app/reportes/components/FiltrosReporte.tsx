"use client";

import { useRouter } from "next/navigation";
import { BranchSelector } from "@/components/ui/BranchSelector";

import { PERIODOS, type Periodo } from "@/lib/periodos-reporte";

export type { Periodo };

/**
 * Los dos filtros de `/reportes` viven en la URL (`?periodo=&sucursal=`): la
 * página es un Server Component y cada cambio vuelve a pedir los datos.
 *
 * Los tabs son botones —y no links— para poder marcar el elegido con
 * `aria-pressed`, como el mockup: sobre un `<a>` ese atributo es ARIA inválida.
 */
export function FiltrosReporte({
  periodo,
  sucursal,
}: {
  periodo: Periodo;
  sucursal: number | null;
}) {
  const router = useRouter();

  const ir = (siguiente: Periodo, branchId: number | null) => {
    const query = new URLSearchParams({ periodo: siguiente });
    if (branchId !== null) query.set("sucursal", String(branchId));
    router.push(`/reportes?${query.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <BranchSelector
        value={sucursal}
        label="Filtrar por sucursal"
        onChange={(id) => ir(periodo, id)}
      />
      {PERIODOS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => ir(opt.value, sucursal)}
          aria-pressed={periodo === opt.value}
          className={`btn whitespace-nowrap ${periodo === opt.value ? "btn-active" : "btn-secondary"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
