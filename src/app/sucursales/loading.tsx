import { Spinner } from "@/components/ui/Spinner";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";

/**
 * Carga de `/sucursales` (S2): la ruta no tenía `loading.tsx`, así que la banda
 * de marca y la hoja de vidrio aparecían recién con los datos. Misma forma que
 * la página: píldora del encabezado, hoja, ruedita y esqueletos de la lista.
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
