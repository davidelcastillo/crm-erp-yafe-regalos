import { Spinner } from "@/components/ui/Spinner";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";

/**
 * Carga del detalle de sucursal (S2). La página reusa el mismo
 * `BranchManager` que `/sucursales`, así que el esqueleto tiene la misma forma
 * que el de esa ruta: píldora del encabezado, hoja, ruedita y cards.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="pb-16 brand-gradient">
        <div className="px-3 pt-6" aria-hidden="true">
          <Skeleton className="h-[60px] rounded-2xl" />
        </div>
      </div>
      <div className="glass rounded-t-[2.5rem] -mt-12 px-5 pt-8">
        <Spinner label="Cargando sucursales..." />
        <div className="mt-6 space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}
