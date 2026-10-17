// src/app/compras/page.tsx
'use client';

import { getProducts } from '../actions/product';
import { getPurchases } from '../actions/purchase';
import { PurchasesList } from './components/PurchasesList';
import { AddPurchaseButton } from './components/AddPurchaseButton';
import { BranchSelector } from '@/components/ui/BranchSelector';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useReloadKey } from '@/lib/hooks/useReloadKey';
import { useEffect, useState } from 'react';

export default function ComprasPage() {
  const [reloadKey, bump] = useReloadKey();
  const [products, setProducts] = useState<never[]>([]);
  const [purchases, setPurchases] = useState<never[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const branchParam = branchId ?? undefined;
    (async () => {
      const [productsResult, purchasesResult] = await Promise.all([
        // Para cargar una compra se ofrecen todos los productos activos: la compra
        // es la que crea el stock en la sucursal, no al revés (bug 2 del usuario).
        getProducts(),
        getPurchases({ branchId: branchParam }),
      ]);
      if (cancelled) return;
      setProducts(productsResult.success && productsResult.data ? productsResult.data as never[] : []);
      setPurchases(purchasesResult.success && purchasesResult.data ? purchasesResult.data as never[] : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, reloadKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <div className="h-28 brand-gradient" />
        <div className="glass rounded-t-[2.5rem] -mt-12 px-5 pt-8">
          <Spinner label="Cargando compras..." />
          <div className="mt-6 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

 return (
    <div className="min-h-screen bg-white pb-20 relative">
      <main className="">
        <div className="pb-16 brand-gradient">
        <PageHeader
          title="Compras"
          right={
            <BranchSelector
              block
              onChange={(id) => setBranchId(id)}
              label="Filtrar por sucursal"
            />
          }
        />
      </div>

        <div className="glass border-t border-white/80 rounded-t-[2.5rem] -mt-12 px-5 pt-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {purchases.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-[#6a6a6a]">No hay compras registradas</p>
              <p className="text-sm text-[#6a6a6a] mt-1">Toca el botón + para registrar una compra</p>
            </div>
          ) : (
            <PurchasesList purchases={purchases} />
          )}
        </div>
      </main>

      <AddPurchaseButton products={products} onSuccess={bump} />

    </div>
  );
}
