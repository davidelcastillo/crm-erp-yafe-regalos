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
import { OptionsMenuModal, type MenuOption } from '@/components/ui/OptionsMenuModal';
import { ActionCard } from '@/components/ui/ActionCard';
import { Spinner } from '@/components/ui/Spinner';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { BranchSelector } from '@/components/ui/BranchSelector';
import { useReloadKey } from '@/lib/hooks/useReloadKey';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';

/** Paso del acceso único a la caja (S4): el menú o ya una de sus acciones. */
type CashStep = 'menu' | 'movimientos' | 'cierre';

/** Opciones del paso 1; los ids son los pasos que abren los modales de abajo. */
const OPCIONES_CAJA: MenuOption[] = [
  { id: 'movimientos', label: 'Movimientos de caja', hint: 'Ingresos y egresos de una sucursal' },
  { id: 'cierre', label: 'Cerrar caja', hint: 'Corte del turno por sucursal' },
];

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

/**
 * Carga: la banda de marca, la forma del encabezado y la hoja con la forma de la
 * lista que va a llegar, en el mismo orden y con las mismas medidas que la
 * página, para que no salte al terminar (S2).
 */
const VentasLoading = () => (
  <div className="min-h-screen bg-surface pb-20">
    <div className="pb-16 brand-gradient">
      <div className="px-3 pt-6" aria-hidden="true">
        <Skeleton className="h-[60px] rounded-2xl" />
        <Skeleton className="mt-4 h-[72px] rounded-2xl" />
        <Skeleton className="mt-4 h-[68px] rounded-2xl" />
      </div>
    </div>
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
  // Un solo acceso a la caja (S4): abre el menú y desde ahí el paso elegido.
  const [cashStep, setCashStep] = useState<CashStep | null>(null);
  // Movimiento de la página: el encabezado se mueve solo, y el fondo de marca se
  // retira cuando la hoja lo tapa. Con movimiento reducido queda quieto.
  const { scrollY } = useScroll();
  const headerY = useTransform(scrollY, [0, 160], [0, 16]);
  const brandOpacity = useTransform(scrollY, [0, 140], [1, 0.45]);
  const reduceMotion = useReducedMotion();

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
    <div className="min-h-screen bg-surface pb-20 relative">
      <main className="">
        <div className="relative isolate pb-16">
          {/* El degradé de marca es una capa de fondo: se retira al hacer scroll
              (S10), pero los botones, el selector y el buscador no se tocan. */}
          <motion.div
            className="brand-gradient pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={reduceMotion ? undefined : { opacity: brandOpacity }}
          />

          <motion.div style={reduceMotion ? undefined : { y: headerY }}>
            <PageHeader
              title="Ventas"
              right={
                <BranchSelector
                  block
                  onChange={(id) => setBranchId(id)}
                  label="Filtrar por sucursal"
                />
              }
              actions={
                <button
                  type="button"
                  onClick={() => setCashStep('menu')}
                  className="btn btn-primary"
                >
                  Caja
                </button>
              }
            />
          </motion.div>

          {/* Acciones de la pagina: en su propio div, como el del buscador, con el
              fondo de marca a la vista. En desktop pasan a la barra. */}
          <div className="mt-4 px-3 md:hidden">
            <div className="flex gap-3">
              <ActionCard
                label="Caja"
                hint="Movimientos y cierre"
                onClick={() => setCashStep('menu')}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="2.5" y="6.5" width="19" height="11" rx="2" strokeWidth={2} />
                    <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
                    <path strokeLinecap="round" strokeWidth={2} d="M6.5 12h.01M17.5 12h.01" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Buscador: su propio div, separado del encabezado. */}
          <div className="mt-4 px-3">
            <div className="rounded-2xl glass-strong px-4 py-3">
              <div className="relative w-full">
                <svg className="w-5 h-5 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full min-h-[44px] pl-12 pr-4 py-3 bg-surface-soft rounded-xl text-base text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-accent/30 touch-manipulation"
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
                <svg className="w-8 h-8 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2.5" y="6.5" width="19" height="11" rx="2" strokeWidth={2} />
                  <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
                  <path strokeLinecap="round" strokeWidth={2} d="M6.5 12h.01M17.5 12h.01" />
                </svg>
              </div>
              <p className="text-ink-muted">
                {debouncedSearch ? 'No se encontraron ventas' : 'No hay ventas registradas'}
              </p>
              <p className="text-sm text-ink-muted mt-1">
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
                    className="btn btn-secondary w-full sm:w-auto"
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
      <OptionsMenuModal
        open={cashStep === 'menu'}
        title="Caja"
        options={OPCIONES_CAJA}
        onClose={() => setCashStep(null)}
        onPick={(step) => setCashStep(step as CashStep)}
      />
      <CashMovementsModal
        open={cashStep === 'movimientos'}
        onClose={() => setCashStep(null)}
        branches={branches}
        onConfirm={bump}
      />
      <CashCloseModal
        open={cashStep === 'cierre'}
        onClose={() => setCashStep(null)}
        branches={branches}
        onConfirm={bump}
      />
    </div>
  );
}
