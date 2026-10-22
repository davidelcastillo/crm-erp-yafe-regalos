"use client";

/**
 * Esqueletos de carga: bloques con la forma del contenido que va a llegar, para
 * que la página no salte cuando termina la carga.
 *
 * Son decorativos (`aria-hidden`): el estado de carga lo anuncia el `Spinner`.
 */
export const Skeleton = ({ className = "" }: { className?: string }) => (
  <span className={`block animate-pulse rounded-lg bg-black/5 ${className}`} aria-hidden="true" />
);

/** Placeholder con la forma de una card de lista: título, detalle y pie. */
export const CardSkeleton = () => (
  <div className="rounded-2xl border border-hairline-soft bg-surface/70 p-4" aria-hidden="true">
    <Skeleton className="h-4 w-2/5" />
    <Skeleton className="mt-3 h-3 w-4/5" />
    <Skeleton className="mt-4 h-3 w-1/3" />
  </div>
);
