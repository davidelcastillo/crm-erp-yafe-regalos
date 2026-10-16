// src/app/ventas/page.tsx
'use client';

import { getProducts } from '../actions/product';
import { getSales } from '../actions/sale';
import { getBranchOptions } from '../actions/branch';
import { SalesList } from './components/SalesList';
import { AddSaleButton } from './components/AddSaleButton';
import { CashMovementsModal } from './components/CashMovementsModal';
import { BranchSelector } from '@/components/ui/BranchSelector';
import { useReloadKey } from '@/lib/hooks/useReloadKey';
import { useEffect, useState } from 'react';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

type BranchOption = { id: number; name: string };

export default function VentasPage() {
  const [reloadKey, bump] = useReloadKey();
  const [products, setProducts] = useState<never[]>([]);
  const [sales, setSales] = useState<never[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Sucursales y acceso a la caja (plata), pedidos en S14.
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [cashModalOpen, setCashModalOpen] = useState(false);

  // Las sucursales se cargan una vez: las necesita el modal de caja.
  useEffect(() => {
    let cancelled = false;
    getBranchOptions().then((result) => {
      if (!cancelled && result.success && result.data) {
        setBranches(result.data as BranchOption[]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Debounce the search input (300 ms) before hitting getSales.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Initial load + reload whenever the branch or (debounced) search changes.
  useEffect(() => {
    let cancelled = false;
    const branchParam = branchId ?? undefined;
    (async () => {
      const [productsResult, salesResult] = await Promise.all([
        getProducts(branchParam),
        getSales({
          branchId: branchParam,
          search: debouncedSearch || undefined,
          take: PAGE_SIZE,
          skip: 0,
        }),
      ]);
      if (cancelled) return;
      setProducts(productsResult.success && productsResult.data ? productsResult.data as never[] : []);
      setSales(
        salesResult.success && salesResult.data
          ? salesResult.data.items as never[]
          : []
      );
      setTotal(salesResult.success && salesResult.data ? salesResult.data.total : 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, debouncedSearch, reloadKey]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const branchParam = branchId ?? undefined;
    const salesResult = await getSales({
      branchId: branchParam,
      search: debouncedSearch || undefined,
      take: PAGE_SIZE,
      skip: sales.length,
    });
    if (salesResult.success && salesResult.data) {
      setSales((prev) => [...prev, ...(salesResult.data?.items as never[])]);
      setTotal(salesResult.data.total);
    }
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#ffffff] pb-20">
        <main className="px-6 py-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="flex items-center gap-2 animate-spin">
              <svg className="w-8 h-8 text-[#ff385c]" viewBox="0 0 24 24" stroke="currentColor">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-[#6a6a6a]">Cargando ventas...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ffffff] pb-20">
      <main className="px-6">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-[#222222]">Ventas</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCashModalOpen(true)}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-[#ff385c] rounded-xl hover:bg-[#e00b41] transition-colors touch-manipulation"
            >
              Caja
            </button>
            <BranchSelector
              onChange={(id) => setBranchId(id)}
              label="Filtrar por sucursal"
            />
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <svg className="w-5 h-5 text-[#6a6a6a] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-[44px] pl-12 pr-4 py-3 bg-[#f8f8f8] rounded-xl text-base text-[#222222] placeholder-[#929292] focus:outline-none focus:ring-2 focus:ring-[#ff385c]/20 touch-manipulation"
              aria-label="Buscar producto"
              autoComplete="off"
            />
          </div>
        </div>

        {sales.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f2f2f2] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 3s1.343 3 3 3 3 .895 3 3-1.343 3-3 3-3 .895-3 3zm0 8c1.11 0 2.08-.402 2.599-1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[#6a6a6a]">
              {debouncedSearch ? 'No se encontraron ventas' : 'No hay ventas registradas'}
            </p>
            <p className="text-sm text-[#6a6a6a] mt-1">
              {debouncedSearch
                ? 'Probá con otro producto o código'
                : 'Toca el botón + para registrar una venta'}
            </p>
          </div>
        ) : (
          <>
            <SalesList sales={sales} />
            {sales.length < total && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full sm:w-auto px-6 min-h-[44px] text-sm font-medium text-white bg-[#ff385c] rounded-xl hover:bg-[#e00b41] transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? 'Cargando...' : 'Cargar más'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <AddSaleButton products={products} onSuccess={bump} />
      <CashMovementsModal
        open={cashModalOpen}
        onClose={() => setCashModalOpen(false)}
        branches={branches}
        onConfirm={bump}
      />
    </div>
  );
}
