'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBranchMovements } from '@/app/actions/inventory';
import type { BranchMovement } from '@prisma/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionCard } from '@/components/ui/ActionCard';
import { Spinner } from '@/components/ui/Spinner';
import { CardSkeleton } from '@/components/ui/Skeleton';

type MovementRow = BranchMovement & {
  branch: { id: number; name: string } | null;
  product: { id: number; name: string } | null;
};

export default function MovementsPage() {
  const router = useRouter();
  const [movements, setMovements] = useState<MovementRow[]>([]);
  // Arranca en carga para mostrar los esqueletos en el primer render, en vez de
  // un "No hay movimientos" que aparece y desaparece.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadMovements = async () => {
    setLoading(true);
    try {
      const result = await getBranchMovements({});
      if (result.success) {
        setMovements(result.data as MovementRow[]);
      } else {
        setError(result.error || 'Error loading movements');
      }
    } catch (err) {
      setError('Error loading movements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, []);

  return (
    <div className="min-h-screen bg-white pb-20">
      <main>
        <div className="pb-16 brand-gradient">
          <PageHeader
            title="Movimientos de Stock"
            actions={
              <Link
                href="/inventario"
                className="btn btn-primary"
              >
                Ir a Inventario
              </Link>
            }
            menuItems={[{ label: 'Ir a Inventario', href: '/inventario' }]}
          />

          {/* Acción de la página en mobile: en su propio div, con el fondo de marca a la vista. */}
          <div className="mt-4 px-3 md:hidden">
            <div className="flex gap-3">
              <ActionCard
                label="Ir a Inventario"
                hint="Stock por sucursal"
                href="/inventario"
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                }
              />
            </div>
          </div>
        </div>

        <div className="glass rounded-t-[2.5rem] border-t border-white/80 -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-black/5 bg-[#ffe4ea] px-4 py-3 text-sm text-[#8f0020]"
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="pt-2">
              <Spinner label="Cargando movimientos..." />
              <div className="mt-6 space-y-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#6a6a6a]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16V4m0 0L4 7m3-3l3 3M17 8v12m0 0l3-3m-3 3l-3-3"
                  />
                </svg>
              </div>
              <p className="text-[#6a6a6a]">No hay movimientos</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {movements.map((m) => (
                <li key={m.id} className="glass rounded-2xl border border-black/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[#6a6a6a]">Producto</p>
                      <p className="mt-0.5 text-base font-semibold text-[#222222] break-words">
                        {m.product?.name ?? 'Desconocido'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-[#6a6a6a]">Cantidad</p>
                      <p className="mt-0.5 text-base font-semibold text-[#222222]">{m.quantity}</p>
                      {/* El signo y el tipo salen del movimiento tal cual vienen. */}
                      <p className="mt-0.5 text-xs text-[#6a6a6a]">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-black/5 pt-3 text-xs">
                    <div className="min-w-0">
                      <dt className="text-[#6a6a6a]">Sucursal</dt>
                      <dd className="mt-0.5 text-[#222222] break-words">
                        {m.branch?.name ?? 'Desconocido'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[#6a6a6a]">Tipo</dt>
                      <dd className="mt-0.5 text-[#222222] break-words capitalize">
                        {m.movementType}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[#6a6a6a]">Referencia</dt>
                      <dd className="mt-0.5 text-[#222222] break-words">{m.reference ?? '-'}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[#6a6a6a]">Responsable</dt>
                      <dd className="mt-0.5 text-[#222222] break-words">{m.performedBy ?? '-'}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
