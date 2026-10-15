'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getInactiveProducts, reactivateProduct } from '@/app/actions/product';
import type { Product } from '@prisma/client';
import Swal from 'sweetalert2';

type InactiveProduct = Product & { category: { id: number; name: string } | null };

const DEBOUNCE_MS = 300;

export default function InactivosPage() {
  const [products, setProducts] = useState<InactiveProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

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
    } catch (err) {
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
      confirmButtonColor: '#ff385c',
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
        confirmButtonColor: '#ff385c',
      });
      await loadProducts();
    } else {
      await Swal.fire({
        title: 'Error',
        text: result.error || 'Error al reactivar el producto',
        icon: 'error',
        confirmButtonColor: '#ff385c',
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

  const visibleProducts = debouncedSearch
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(debouncedSearch) ||
          (p.code && p.code.toLowerCase().includes(debouncedSearch))
      )
    : products;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] pb-20 pt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="flex items-center gap-2 animate-spin">
              <svg className="w-8 h-8 text-[#ff385c]" viewBox="0 0 24 24" stroke="currentColor">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-[#6a6a6a]">Cargando inactivos...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-20 pt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Productos Inactivos</h1>
          <Link href="/inventario" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
            Volver a inventario
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-800 rounded">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="inactivos-search" className="block mb-2 text-sm font-medium text-gray-700">
            Buscar producto
          </label>
          <div className="relative">
            <input
              id="inactivos-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
              placeholder="Buscar por nombre o código..."
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6a] text-sm">$</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visibleProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    No hay productos inactivos
                  </td>
                </tr>
              ) : (
                visibleProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.code ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${Number(product.price ?? 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex space-x-2">
                      <button
                        onClick={() => handleReactivate(product.id)}
                        className="px-3 py-1 text-sm font-medium text-white bg-[#ff385c] rounded hover:bg-[#e00b41] transition-colors"
                      >
                        Activar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}