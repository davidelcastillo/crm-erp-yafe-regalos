// src/app/ventas/page.tsx
'use client';

import { getProducts } from '../actions/product';
import { getSales } from '../actions/sale';
import { getBranchOptions } from '../actions/branch';
import { SalesList } from './components/SalesList';
import { AddSaleButton } from './components/AddSaleButton';
import { CashMovementsModal } from './components/CashMovementsModal';
import { CashCloseModal } from './components/CashCloseModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionCard } from '@/components/ui/ActionCard';
import { Spinner } from '@/components/ui/Spinner';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { BranchSelector } from '@/components/ui/BranchSelector';
import { useReloadKey } from '@/lib/hooks/useReloadKey';
import { useEffect, useState } from 'react';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

/** Carga: la banda de marca y la hoja con la forma de la lista que va a llegar. */
const VentasLoading = () => (
  <div className="min-h-screen bg-white pb-20">
    <div className="h-28 brand-gradient" />
    <div className="glass rounded-t-[2.5rem] -mt-12 px-5 pt-8">
      <Spinner label="Cargando ventas..." />
      <div className="mt-6 space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  </div>
);

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
  const [closeModalOpen, setCloseModalOpen] = useState(false);

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
    return <VentasLoading />;
  }

  return (
    <div className="min-h-screen bg-white pb-20 relative">
      <main className="">
        <div className="pb-16 brand-gradient">
          <PageHeader
            title="Ventas"
            below={
              <BranchSelector
                block
                onChange={(id) => setBranchId(id)}
                label="Filtrar por sucursal"
              />
            }
            actions={
              <>
                <button
                  type="button"
                  onClick={() => setCashModalOpen(true)}
                  className="px-4 min-h-[44px] rounded-xl brand-gradient brand-gradient-hover text-sm font-medium text-gray-800 touch-manipulation"
                >
                  Caja
                </button>
                <button
                  type="button"
                  onClick={() => setCloseModalOpen(true)}
                  className="px-4 min-h-[44px] rounded-xl brand-gradient brand-gradient-hover text-sm font-medium text-gray-800 touch-manipulation"
                >
                  Cerrar caja
                </button>
              </>
            }
          />

          {/* Acciones de la pagina: en su propio div, como el del buscador, con el
              fondo de marca a la vista. En desktop pasan a la barra. */}
          <div className="mt-4 px-3 md:hidden">
            <div className="flex gap-3">
              <ActionCard
                label="Caja"
                hint="Ingresos y egresos"
                onClick={() => setCashModalOpen(true)}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="2.5" y="6.5" width="19" height="11" rx="2" strokeWidth={2} />
                    <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
                    <path strokeLinecap="round" strokeWidth={2} d="M6.5 12h.01M17.5 12h.01" />
                  </svg>
                }
              />
              <ActionCard
                label="Cerrar caja"
                hint="Corte por sucursal"
                onClick={() => setCloseModalOpen(true)}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="7" width="18" height="13" rx="2" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 11h18M9.5 15.5l1.75 1.75L15 13.5" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Buscador: su propio div, separado del encabezado. */}
          <div className="mt-4 px-3">
            <div className="rounded-2xl glass-strong px-4 py-3">
              <div className="relative w-full">
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
          </div>
        </div>

        <div className="glass border-t border-white/80 rounded-t-[2.5rem] -mt-12 px-5 pt-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {sales.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-[#6a6a6a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2.5" y="6.5" width="19" height="11" rx="2" strokeWidth={2} />
                  <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
                  <path strokeLinecap="round" strokeWidth={2} d="M6.5 12h.01M17.5 12h.01" />
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
        </div>
      </main>
      <AddSaleButton products={products} onSuccess={bump} />
      <CashMovementsModal
        open={cashModalOpen}
        onClose={() => setCashModalOpen(false)}
        branches={branches}
        onConfirm={bump}
      />
      <CashCloseModal
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        branches={branches}
        onConfirm={bump}
      />
    </div>
  );
}
