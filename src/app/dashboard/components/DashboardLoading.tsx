import { Spinner } from "@/components/ui/Spinner";
import { CardSkeleton } from "@/components/ui/Skeleton";

/**
 * Esqueleto del tablero: la misma banda de marca y la misma hoja glass que la
 * página ya cargada (y que /ventas, /compras e inventario).
 */
export const DashboardLoading = () => (
  <div className="min-h-screen bg-surface pb-24">
    <div className="relative isolate pb-16">
      <div className="brand-gradient pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="px-4 pt-6">
        <Spinner label="Cargando dashboard..." />
      </div>
    </div>

    <div className="glass -mt-12 rounded-t-[2.5rem] px-4 pt-6 pb-8 md:px-8 md:pt-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  </div>
);
