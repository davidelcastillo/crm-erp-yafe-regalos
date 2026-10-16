// src/app/inventario/page.tsx
'use client';

import { getProductsWithBranchStock } from "../actions/inventory";
import { getBranchOptions } from "../actions/branch";
import { getCategoryOptions, createCategory } from "../actions/category";
import { InventarioList } from "./components/InventarioList";
import { InventoryFilters } from "./components/InventoryFilters";
import { MoveStockModal } from "./components/MoveStockModal";
import { StockAdjustmentModal } from "./components/StockAdjustmentModal";
import { ExportWizard } from "./components/ExportWizard";
import { LabelSelector } from "@/components/ui/LabelSelector";
import { MovementsModal } from "@/components/ui/MovementsModal";
import { BranchFilterDropdown } from "@/components/ui/BranchFilterDropdown";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionCard } from "@/components/ui/ActionCard";
import { AddProductButton } from "../productos/components/AddProductButton";
import { ProductForm } from "../productos/components/ProductForm";
import { useEffect, useState, useCallback } from 'react';
import { Product } from "@prisma/client";
import Swal from "sweetalert2";

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
  const [stockAdjustmentOpen, setStockAdjustmentOpen] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);

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

  // Refetch tras crear un producto desde el FAB: respeta los filtros AND
  // activos (sucursal + categoría + búsqueda) SIN resetearlos (spec
  // inventory-ui). Si el producto nuevo no matchea los filtros, no aparece
  // en la lista — comportamiento correcto del AND.
  const handleProductCreated = async (_created: Product) => {
    try {
      const data = await fetchProducts(branchId, selectedCategoryId, debouncedSearch);
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar productos');
    }
  };

  // "Nueva categoría" del header — patrón Swal exacto de CategorySelector
  // (input text, maxlength 100, validación vacío/>100). Ante éxito refresca
  // getCategoryOptions → setCategories (alimenta InventoryFilters); ante
  // error (incluido P2002) muestra Swal error y NO muta la lista local.
  const handleCreateCategory = async () => {
    const modal = await Swal.fire({
      title: "Nueva categoría",
      input: "text",
      inputLabel: "Nombre",
      inputPlaceholder: "Ej: Limpieza, Alimentos…",
      inputAttributes: { maxlength: "100", autocapitalize: "on" },
      showCancelButton: true,
      confirmButtonText: "Crear",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ff385c",
      cancelButtonColor: "#6a6a6a",
      background: "#ffffff",
      color: "#222222",
      inputValidator: (value) => {
        if (!value || !value.trim()) return "El nombre es requerido";
        if (value.length > 100) return "Máximo 100 caracteres";
        return null;
      },
    });

    if (!modal.isConfirmed) return;

    const result = await createCategory({ name: modal.value.trim() });
    if (result.success && result.data) {
      const categoryRes = await getCategoryOptions();
      if (categoryRes.success && categoryRes.data) {
        setCategories(categoryRes.data as CategoryOption[]);
      }
      await Swal.fire({
        title: "Categoría creada",
        text: `Se creó "${result.data.name}"`,
        icon: "success",
        confirmButtonColor: "#ff385c",
        confirmButtonText: "Aceptar",
        background: "#ffffff",
        color: "#222222",
      });
    } else {
      await Swal.fire({
        title: "Error",
        text: result.error ?? "No se pudo crear la categoría",
        icon: "error",
        confirmButtonColor: "#ff385c",
        confirmButtonText: "Aceptar",
        background: "#ffffff",
        color: "#222222",
      });
    }
  };

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
      <main>
        <div className="pb-8 brand-gradient">
          <PageHeader
            title="Inventario"
            right={
              <BranchFilterDropdown
                selectedId={branchId}
                onValueChange={setBranchId}
                label="Stock por sucursal"
              />
            }
            actions={
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMoveStockProductId(null);
                    setMoveStockOpen(true);
                  }}
                  className="px-4 min-h-[44px] rounded-xl brand-gradient brand-gradient-hover text-sm font-medium text-gray-800 touch-manipulation"
                >
                  Mover Stock
                </button>
                <button
                  type="button"
                  onClick={() => setStockAdjustmentOpen(true)}
                  className="px-4 min-h-[44px] rounded-xl brand-gradient brand-gradient-hover text-sm font-medium text-gray-800 touch-manipulation"
                >
                  Entrada / Salida
                </button>
                <button
                  type="button"
                  onClick={() => setExportWizardOpen(true)}
                  className="px-4 min-h-[44px] rounded-xl brand-gradient brand-gradient-hover text-sm font-medium text-gray-800 touch-manipulation"
                >
                  Exportar
                </button>
              </>
            }
            menuItems={[
              { label: "Inactivos", href: "/inventario/inactivos" },
              { label: "Categorías", href: "/categorias" },
              { label: "Nueva categoría", onClick: handleCreateCategory },
            ]}
          />

          {/* Acciones de la pagina en mobile: en su propio div, con el fondo a la vista. */}
          <div className="mt-4 px-3 md:hidden">
            <div className="grid grid-cols-2 gap-3">
              <ActionCard
                label="Mover Stock"
                hint="Entre sucursales"
                onClick={() => {
                  setMoveStockProductId(null);
                  setMoveStockOpen(true);
                }}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L4 7m3-3l3 3M17 8v12m0 0l3-3m-3 3l-3-3" />
                  </svg>
                }
              />
              <ActionCard
                label="Entrada / Salida"
                hint="Corregir stock"
                onClick={() => setStockAdjustmentOpen(true)}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v18m0-18L5 6m3-3l3 3M16 21V3m0 18l3-3m-3 3l-3-3" />
                  </svg>
                }
              />
              <ActionCard
                label="Exportar"
                hint="Lista en PDF"
                onClick={() => setExportWizardOpen(true)}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>

        <div className="glass border-t border-white/80 rounded-t-[2.5rem] -mt-6 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">

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
          searchActive={debouncedSearch !== ''}
          categories={categories}
          onViewMovements={(product) => {
            setSelectedProductForMovements(product);
            setMovementsModalOpen(true);
          }}
        />

        </div>

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

        {/* Entrada/salida de stock por lote: la forma auditable de corregir
            stock (hermana de Mover Stock, que mueve entre dos sucursales). */}
        {stockAdjustmentOpen && (
          <StockAdjustmentModal
            open={stockAdjustmentOpen}
            onClose={() => setStockAdjustmentOpen(false)}
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

        {/* FAB crear producto + ProductForm directo (Fase 1 unificar
            productos): scrim propio z-[60] de ProductForm, SIN wrapper z-[70].
            El FAB (z-40) queda cubierto por el scrim del modal. */}
        <AddProductButton
          open={productFormOpen}
          onOpenChange={setProductFormOpen}
          onSuccess={handleProductCreated}
        />
        {productFormOpen && (
          <ProductForm
            product={null}
            onSuccess={handleProductCreated}
            onClose={() => setProductFormOpen(false)}
          />
        )}
      </main>
    </div>
  );
}