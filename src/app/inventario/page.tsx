// src/app/inventario/page.tsx
'use client';

import { getProductsWithBranchStock } from "../actions/inventory";
import { getBranchOptions } from "../actions/branch";
import { getCategoryOptions, createCategory } from "../actions/category";
import { InventarioList } from "./components/InventarioList";
import { InventoryFilters, type InventorySortOption } from "./components/InventoryFilters";
import { MoveStockModal } from "./components/MoveStockModal";
import { StockAdjustmentModal } from "./components/StockAdjustmentModal";
import { ExportWizard } from "./components/ExportWizard";
import { LabelSelector } from "@/components/ui/LabelSelector";
import { MovementsModal } from "@/components/ui/MovementsModal";
import { BranchFilterDropdown } from "@/components/ui/BranchFilterDropdown";
import { PageHeader } from "@/components/ui/PageHeader";
import { OptionsMenuModal, type MenuOption } from "@/components/ui/OptionsMenuModal";
import { ActionCard } from "@/components/ui/ActionCard";
import { Spinner } from "@/components/ui/Spinner";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { AddProductButton } from "../productos/components/AddProductButton";
import { ProductForm } from "../productos/components/ProductForm";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Product } from "@prisma/client";
import Swal from "sweetalert2";
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';

type BranchOption = { id: number; name: string };
type CategoryOption = { id: number; name: string };

const DEBOUNCE_MS = 300;

/** Paso del acceso único al stock (S4): el menú o ya una de sus acciones. */
type StockStep = 'menu' | 'mover' | 'ajuste';
/** Paso del acceso único a impresión: el menú o ya una de sus acciones. */
type PrintStep = 'menu' | 'exportar' | 'etiquetas';

/** Opciones del paso 1 del stock; «control» navega a su página. */
const OPCIONES_STOCK: MenuOption[] = [
  { id: 'mover', label: 'Mover stock', hint: 'Entre dos sucursales' },
  { id: 'ajuste', label: 'Entrada / Salida', hint: 'Corregir el stock por lote' },
  { id: 'control', label: 'Control de stock', hint: 'Contar y ajustar contra el sistema' },
];

/** Opciones del paso 1 de impresión; los ids son los modales de abajo. */
const OPCIONES_IMPRIMIR: MenuOption[] = [
  { id: 'exportar', label: 'Exportar lista', hint: 'PDF o Excel de la sucursal' },
  { id: 'etiquetas', label: 'Etiquetas de precio', hint: 'Etiquetas para imprimir' },
];

/**
 * Carga: la banda de marca, la forma del encabezado y la hoja con la forma de
 * la lista que va a llegar, en el mismo orden y con las mismas medidas que la
 * página, para que no salte al terminar (S2).
 */
const InventarioLoading = () => (
  <div className="min-h-screen bg-surface pb-20">
    <div className="pb-16 brand-gradient">
      <div className="px-3 pt-6">
        <Skeleton className="h-[60px] rounded-2xl" />
      </div>
      <div className="mt-4 px-3">
        <Skeleton className="h-[72px] rounded-2xl" />
      </div>
    </div>
    <div className="glass rounded-t-[2.5rem] -mt-12 px-5 pt-6">
      <Spinner label="Cargando inventario..." />
      <div className="mt-4">
        <Skeleton className="h-[44px] rounded-xl" />
        <Skeleton className="mt-3 h-[44px] rounded-xl" />
      </div>
      <div className="mt-6 space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  </div>
);

export default function InventarioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movementsModalOpen, setMovementsModalOpen] = useState(false);
  const [selectedProductForMovements, setSelectedProductForMovements] = useState<Product | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);

  // Phase 3: branch + category filters and Move Stock modal
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  // Un solo acceso por tema (S4): el menú de pasos y, adentro, el modal de siempre.
  const [stockStep, setStockStep] = useState<StockStep | null>(null);
  const [printStep, setPrintStep] = useState<PrintStep | null>(null);
  const [productFormOpen, setProductFormOpen] = useState(false);

  const router = useRouter();

  // Task 4.6: unified search (debounce 300 ms) that drives the server-side
  // `search` param of getProductsWithBranchStock. The old client-side filtering
  // in InventarioList was removed in favor of this server-driven search.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // El orden vive acá, junto a la categoría: los dos selectores de la lista
  // comparten contenedor y control (S2).
  const [sortBy, setSortBy] = useState<InventorySortOption>('code');

  // Movimiento de la página: el encabezado se mueve solo y el degradé de marca
  // se retira cuando la hoja lo tapa (S10, S11). Con movimiento reducido queda quieto.
  const { scrollY } = useScroll();
  const headerY = useTransform(scrollY, [0, 160], [0, 16]);
  const brandOpacity = useTransform(scrollY, [0, 140], [1, 0.45]);
  const reduceMotion = useReducedMotion();

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
      confirmButtonColor: "#6d28d9",
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
        confirmButtonColor: "#6d28d9",
        confirmButtonText: "Aceptar",
        background: "#ffffff",
        color: "#222222",
      });
    } else {
      await Swal.fire({
        title: "Error",
        text: result.error ?? "No se pudo crear la categoría",
        icon: "error",
        confirmButtonColor: "#dc2626",
        confirmButtonText: "Aceptar",
        background: "#ffffff",
        color: "#222222",
      });
    }
  };

  // Paso 1 → paso 2: «control» no tiene modal propio, navega a su página.
  const handleStockPick = (id: string) => {
    if (id === 'control') {
      setStockStep(null);
      router.push('/inventario/control');
      return;
    }
    setStockStep(id as StockStep);
  };

  if (loading) {
    return <InventarioLoading />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <main className="px-6 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-secondary mt-2"
            >
              Reintentar
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <main>
        <div className="relative isolate pb-16">
          {/* El degradé de marca es una capa de fondo: se retira al hacer scroll
              (S10), pero la banda de acciones y la hoja no se tocan. */}
          <motion.div
            className="brand-gradient pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={reduceMotion ? undefined : { opacity: brandOpacity }}
          />

          <motion.div style={reduceMotion ? undefined : { y: headerY }}>
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
                  onClick={() => setStockStep('menu')}
                  className="btn btn-primary"
                >
                  Stock
                </button>
                <button
                  type="button"
                  onClick={() => setPrintStep('menu')}
                  className="btn btn-primary"
                >
                  Imprimir
                </button>
                {/* En celular «Inactivos» vive en el menú ☰: es una vista
                    secundaria, no una acción principal (S3). */}
                <Link href="/inventario/inactivos" className="btn btn-primary">
                  Inactivos
                </Link>
              </>
            }
            menuItems={[
              { label: "Control de stock", href: "/inventario/control" },
              { label: "Inactivos", href: "/inventario/inactivos" },
              { label: "Categorías", href: "/categorias" },
              { label: "Nueva categoría", onClick: handleCreateCategory },
            ]}
            />
          </motion.div>

          {/* Acciones de la pagina en mobile: en su propio div, con el fondo a la vista.
              Dos accesos, un tema cada uno; los pasos van adentro (S4). */}
          <div className="mt-4 px-3 md:hidden" role="group" aria-label="Acciones de la página">
            <div className="grid grid-cols-2 gap-3">
              <ActionCard
                label="Stock"
                hint="Mover, entrada/salida y control"
                onClick={() => setStockStep('menu')}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L4 7m3-3l3 3M17 8v12m0 0l3-3m-3 3l-3-3" />
                  </svg>
                }
              />
              <ActionCard
                label="Imprimir"
                hint="Lista y etiquetas"
                onClick={() => setPrintStep('menu')}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M3 5.5A2.5 2.5 0 015.5 3h4.379a2 2 0 011.414.586l8.621 8.621a2 2 0 010 2.828l-4.879 4.879a2 2 0 01-2.828 0L3.586 11.293A2 2 0 013 9.879V5.5z" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Buscador en su propia tarjeta de vidrio, separado de la hoja de la
              lista (S16): es el mismo estilo que el de /ventas. */}
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

        <div className="glass border-t border-white/80 rounded-t-[2.5rem] -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">

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
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        </div>

        <InventarioList 
          products={products} 
          searchActive={debouncedSearch !== ''}
          categories={categories}
          sortBy={sortBy}
          onViewMovements={(product) => {
            setSelectedProductForMovements(product);
            setMovementsModalOpen(true);
          }}
        />

        </div>

        {/* Paso 1 de los dos accesos (S4): acá se elige qué se va a hacer. */}
        <OptionsMenuModal
          open={stockStep === 'menu'}
          title="Stock"
          options={OPCIONES_STOCK}
          onClose={() => setStockStep(null)}
          onPick={handleStockPick}
        />
        <OptionsMenuModal
          open={printStep === 'menu'}
          title="Imprimir"
          options={OPCIONES_IMPRIMIR}
          onClose={() => setPrintStep(null)}
          onPick={(id) => setPrintStep(id as PrintStep)}
        />

        {/* Wizard de etiquetas de precio (S3/S6) */}
        <LabelSelector
          isOpen={printStep === 'etiquetas'}
          onClose={() => setPrintStep(null)}
          branches={branches}
        />
        
        {/* Movements Modal */}
        {selectedProductForMovements && (
          <MovementsModal
            product={selectedProductForMovements}
            branchId={branchId}
            isOpen={movementsModalOpen}
            onClose={() => {
              setMovementsModalOpen(false);
              setSelectedProductForMovements(null);
            }}
          />
        )}

        {/* Move Stock Modal (Phase 3) */}
        {stockStep === 'mover' && (
          <MoveStockModal
            open
            onClose={() => setStockStep(null)}
            productId={0}
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
        {stockStep === 'ajuste' && (
          <StockAdjustmentModal
            open
            onClose={() => setStockStep(null)}
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
        {printStep === 'exportar' && (
          <ExportWizard
            open
            onClose={() => setPrintStep(null)}
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