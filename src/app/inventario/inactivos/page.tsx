'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getInactiveProducts, reactivateProduct } from '@/app/actions/product';
import type { Product } from '@prisma/client';
import Swal from 'sweetalert2';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProductSortToggle } from '@/components/ui/ProductSortToggle';
import { sortProducts, type ProductSortMode } from '@/lib/product-order';
import { Spinner } from '@/components/ui/Spinner';
import { CardSkeleton } from '@/components/ui/Skeleton';

type InactiveProduct = Product & { category: { id: number; name: string } | null };

const DEBOUNCE_MS = 300;

export default function InactivosPage() {
  const [products, setProducts] = useState<InactiveProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // S4: el default de todas las listas es por código.
  const [sortMode, setSortMode] = useState<ProductSortMode>('code');

  const loadProducts = async () => {
    setLoading(true);
    try {
      const result = await getInactiveProducts();
      if (result.success) {
        setProducts(result.data as InactiveProduct[]);
        setError(null);
      } else {
        setError(result.error || 'Error loading products');
      }
    } catch {
      setError('Error loading products');
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async (id: number) => {
    const confirm = await Swal.fire({
      title: 'Reactivar producto',
      text: 'El producto volverá a estar disponible en los selectores de compras y ventas.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: "#6d28d9",
      cancelButtonColor: '#6a6a6a',
      confirmButtonText: 'Sí, reactivar',
    });
    if (!confirm.isConfirmed) return;

    const result = await reactivateProduct({ id });
    if (result.success) {
      await Swal.fire({
        title: 'Producto reactivado',
        text: 'El producto ha sido reactivado correctamente.',
        icon: 'success',
        confirmButtonColor: "#6d28d9",
      });
      await loadProducts();
    } else {
      await Swal.fire({
        title: 'Error',
        text: result.error || 'Error al reactivar el producto',
        icon: 'error',
        confirmButtonColor: '#dc2626',
      });
    }
  };

  // La lista se carga una sola vez: el filtro es local, así que escribir no golpea el servidor.
  useEffect(() => {
    loadProducts();
  }, []);

  // Igual que en /ventas y /inventario: el filtro se aplica 300 ms después de la última tecla.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // El orden se aplica sobre la lista ya cargada, con el helper compartido (S4).
  const visibleProducts = sortProducts(
    debouncedSearch
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(debouncedSearch) ||
            (p.code && p.code.toLowerCase().includes(debouncedSearch))
        )
      : products,
    sortMode
  );

  return (
    <div className="min-h-screen bg-surface pb-20">
      <main>
        <div className="pb-16 brand-gradient">
          <PageHeader
            title="Productos inactivos"
            menuItems={[
              // El volver ya no vive solo acá: también está a la vista arriba de la
              // hoja. La fila queda para el que entra por el menú por costumbre.
              { label: 'Volver a inventario', href: '/inventario' },
            ]}
          />

          {/* Buscador en su propia tarjeta de vidrio, dentro de la banda y
              separado de la hoja de la lista (S16): mismo estilo que /ventas. */}
          <div className="mt-4 px-3">
            <div className="rounded-2xl glass-strong px-4 py-3">
              <div className="relative w-full">
                <svg
                  className="w-5 h-5 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  /* 16px de fuente: por debajo de eso iOS hace zoom al enfocar el input. */
                  className="w-full min-h-[44px] pl-12 pr-4 py-3 bg-surface-soft rounded-xl text-base text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-accent/30 touch-manipulation"
                  placeholder="Buscar por nombre o código..."
                  aria-label="Buscar producto"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-t-[2.5rem] border-t border-white/80 -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {/* El regreso estaba sólo en el menú ☰: ahora se ve, con target táctil
              del mismo alto que el de /inventario/control. */}
          <Link
            href="/inventario"
            className="mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong touch-manipulation"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a inventario
          </Link>

          {/* El orden se queda en la hoja: es un filtro de la lista, no la búsqueda. */}
          <div className="flex justify-center">
            <ProductSortToggle value={sortMode} onChange={setSortMode} />
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-hairline-soft bg-error-surface px-4 py-3 text-sm text-error-ink"
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="pt-6">
              <Spinner label="Cargando inactivos..." />
              <div className="mt-6 space-y-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            </div>
          ) : visibleProducts.length === 0 ? (
            /* Mismo tono de vacío que el resto de las listas. */
            <p className="py-12 text-center text-ink-muted">No hay productos inactivos</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {visibleProducts.map((product) => (
                <li key={product.id} className="glass rounded-2xl border border-hairline-soft p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-ink break-words">
                        {product.name}
                      </h2>
                      <p className="mt-0.5 text-sm text-ink-muted break-words">
                        Código: {product.code ?? '-'}
                      </p>
                      <p className="mt-1 text-base font-semibold text-ink">
                        ${Number(product.price ?? 0).toFixed(2)}
                      </p>
                    </div>

                    {/* La columna de acción no se encoge: el nombre es el que envuelve. */}
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleReactivate(product.id)}
                        className="btn btn-primary whitespace-nowrap"
                      >
                        Activar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
