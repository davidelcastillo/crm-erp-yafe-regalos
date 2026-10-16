import { Spinner } from "@/components/ui/Spinner";
import { CardSkeleton } from "@/components/ui/Skeleton";

/**
 * Carga de `/clientes`: la banda de marca, la hoja de vidrio y esqueletos con
 * la forma de la lista que va a llegar, igual que el estado de carga de las
 * demás páginas (ver `compras/page.tsx`).
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="h-28 brand-gradient" />
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
