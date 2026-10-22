import { Spinner } from "@/components/ui/Spinner";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";

/**
 * Carga de `/clientes`: la banda de marca con la **forma del encabezado** (la
 * píldora de 60 px), la hoja de vidrio y esqueletos con la forma de la lista que
 * va a llegar, igual que `compras/page.tsx` (S2). Sin la píldora la página
 * arrancaba con un bloque vacío de otra altura y saltaba al terminar la carga.
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
        <Spinner label="Cargando clientes..." />
        <div className="mt-6 space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}
