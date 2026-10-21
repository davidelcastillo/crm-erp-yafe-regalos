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

// Botón secundario gris del encabezado: no compite con la acción principal.
const VOLVER_CLASS =
  'btn btn-secondary whitespace-nowrap';

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
    <div className="min-h-screen bg-white pb-20">
      <main>
        <div className="pb-16 brand-gradient">
          <PageHeader
            title="Productos inactivos"
            actions={
              <Link href="/inventario" className={VOLVER_CLASS}>
                Volver a inventario
              </Link>
            }
            menuItems={[
              // El slot `actions` solo se ve desde desktop: el volver va también acá.
              { label: 'Volver a inventario', href: '/inventario' },
            ]}
          />
        </div>

        <div className="glass rounded-t-[2.5rem] border-t border-white/80 -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {/* Buscador: la tarjeta lo separa de las cards de la lista. */}
          <div className="glass rounded-2xl border border-black/5 p-4">
            <label
              htmlFor="inactivos-search"
              className="mb-2 block text-sm font-medium text-[#222222]"
            >
              Buscar producto
            </label>
            <div className="relative">
              <svg
                className="w-5 h-5 text-[#6a6a6a] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                id="inactivos-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                /* 16px de fuente: por debajo de eso iOS hace zoom al enfocar el input. */
                className="block w-full min-h-[44px] pl-11 pr-4 py-2.5 bg-[#f8f8f8] rounded-xl text-base text-[#222222] placeholder-[#6a6a6a] focus:outline-none focus:ring-2 focus:ring-[#ec4899]/30 touch-manipulation"
                placeholder="Buscar por nombre o código..."
                autoComplete="off"
              />
            </div>
            <div className="mt-3 flex justify-center">
              <ProductSortToggle value={sortMode} onChange={setSortMode} />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-black/5 bg-[#ffe4ea] px-4 py-3 text-sm text-[#8f0020]"
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
            <p className="py-12 text-center text-[#6a6a6a]">No hay productos inactivos</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {visibleProducts.map((product) => (
                <li key={product.id} className="glass rounded-2xl border border-black/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-[#222222] break-words">
                        {product.name}
                      </h2>
                      <p className="mt-0.5 text-sm text-[#6a6a6a] break-words">
                        Código: {product.code ?? '-'}
                      </p>
                      <p className="mt-1 text-base font-semibold text-[#222222]">
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
