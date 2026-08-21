// src/app/inventario/page.tsx
'use client';

import Link from "next/link";
import { getProductsWithBranchStock } from "../actions/inventory";
import { getBranchOptions } from "../actions/branch";
import { getCategoryOptions } from "../actions/category";
import { InventarioList } from "./components/InventarioList";
import { InventoryFilters } from "./components/InventoryFilters";
import { MoveStockModal } from "./components/MoveStockModal";
import { ExportWizard } from "./components/ExportWizard";
import { LabelSelector } from "@/components/ui/LabelSelector";
import { MovementsModal } from "@/components/ui/MovementsModal";
import { BranchSelector } from "@/components/ui/BranchSelector";
import { useEffect, useState, useCallback } from 'react';
import { Product } from "@prisma/client";

type BranchOption = { id: number; name: string };
type CategoryOption = { id: number; name: string };

const DEBOUNCE_MS = 300;

export default function InventarioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labelSelectorOpen, setLabelSelectorOpen] = useState(false);
  const [movementsModalOpen, setMovementsModalOpen] = useState(false);
  const [selectedProductForMovements, setSelectedProductForMovements] = useState<Product | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);

  // Phase 3: branch + category filters and Move Stock modal
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [moveStockOpen, setMoveStockOpen] = useState(false);
  const [moveStockProductId, setMoveStockProductId] = useState<number | null>(null);
  const [exportWizardOpen, setExportWizardOpen] = useState(false);

  // Task 4.6: unified search (debounce 300 ms) that drives the server-side
  // `search` param of getProductsWithBranchStock. The old client-side filtering
  // in InventarioList was removed in favor of this server-driven search.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = useCallback(async (bId: number | null, cId: number | null, term: string) => {
    const result = await getProductsWithBranchStock({
      branchId: bId ?? undefined,
      categoryId: cId ?? undefined,
      search: term.trim() || undefined,
      activeOnly: true,
    });
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to load products');
    }
    return result.data as Product[];
  }, []);

  // Load products whenever the branch, category or (debounced) search changes.
  // The cancelled-flag prevents a stale response from overwriting a newer one.
  useEffect(() => {
    let cancelled = false;
    fetchProducts(branchId, selectedCategoryId, debouncedSearch)
      .then((data) => {
        if (cancelled) return;
        setProducts(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar productos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, selectedCategoryId, debouncedSearch, fetchProducts]);

  // Load branch + category options once on mount (for the filters and the
  // Move Stock modal, which needs the branch list to choose origen/destino).
  useEffect(() => {
    (async () => {
      const [branchRes, categoryRes] = await Promise.all([
        getBranchOptions(),
        getCategoryOptions(),
      ]);
      if (branchRes.success && branchRes.data) setBranches(branchRes.data as BranchOption[]);
      if (categoryRes.success && categoryRes.data) setCategories(categoryRes.data as CategoryOption[]);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <main className="px-6 py-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="flex items-center gap-2 animate-spin">
              <svg className="w-8 h-8 text-[#3b82f6]" viewBox="0 0 24 24" stroke="currentColor">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-[#6a6a6a]">Cargando inventario...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <main className="px-6 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-3 py-1 bg-red-200 text-red-700 rounded hover:bg-red-300"
            >
              Reintentar
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <main className="px-6 pb-8">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-[#222222]">Inventario</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <BranchSelector
              onChange={(id) => setBranchId(id)}
              label="Stock por sucursal"
            />
            <button
              type="button"
              onClick={() => {
                setMoveStockProductId(null);
                setMoveStockOpen(true);
              }}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-[#ff385c] rounded-xl hover:bg-[#e00b41] transition-colors touch-manipulation"
            >
              Mover Stock
            </button>
            <button
              type="button"
              onClick={() => setExportWizardOpen(true)}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-[#ff385c] rounded-xl hover:bg-[#e00b41] transition-colors touch-manipulation"
            >
              Exportar productos
            </button>
            <Link
              href="/inventario/inactivos"
              className="inline-flex items-center px-4 py-2 min-h-[44px] text-sm font-medium text-[#222222] bg-white border border-gray-200 rounded-xl hover:bg-[#f2f2f2] transition-colors touch-manipulation"
            >
              Inactivos
            </Link>
          </div>
        </div>

        {/* Phase 3: branch + category filters (the BranchSelector above keeps the
            HU2 single-branch view; this adds the category filter and reflects the
            combined selection via getProductsWithBranchStock). */}
        <div className="mb-4">
          <InventoryFilters
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onFilterChange={(cId) => {
              setSelectedCategoryId(cId);
            }}
            search={search}
            onSearchChange={setSearch}
          />
        </div>

        <InventarioList 
          products={products} 
          branchId={branchId}
          searchActive={debouncedSearch !== ''}
          categories={categories}
          onViewMovements={(product) => {
            setSelectedProductForMovements(product);
            setMovementsModalOpen(true);
          }}
        />

        {/* Label Selector Modal */}
        <LabelSelector
          isOpen={labelSelectorOpen}
          onClose={() => setLabelSelectorOpen(false)}
        />
        
        {/* Movements Modal */}
        {selectedProductForMovements && (
          <MovementsModal
            product={selectedProductForMovements}
            isOpen={movementsModalOpen}
            onClose={() => {
              setMovementsModalOpen(false);
              setSelectedProductForMovements(null);
            }}
          />
        )}

        {/* Move Stock Modal (Phase 3) */}
        {moveStockOpen && (
          <MoveStockModal
            open={moveStockOpen}
            onClose={() => {
              setMoveStockOpen(false);
              setMoveStockProductId(null);
            }}
            productId={moveStockProductId ?? 0}
            branches={branches}
            onConfirm={() => {
              fetchProducts(branchId, selectedCategoryId, debouncedSearch)
                .then((data) => {
                  setProducts(data);
                  setError(null);
                })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : 'Error al cargar productos')
                );
            }}
          />
        )}

        {/* Export Wizard (Phase 3.5) */}
        {exportWizardOpen && (
          <ExportWizard
            open={exportWizardOpen}
            onClose={() => setExportWizardOpen(false)}
            branches={branches}
          />
        )}
      </main>
    </div>
  );
}