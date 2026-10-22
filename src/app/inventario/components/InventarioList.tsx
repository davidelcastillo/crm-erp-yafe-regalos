"use client";

import { useState, useMemo } from "react";
import { Product } from "@prisma/client";
import { InventarioCard } from "./InventarioCard";
import { Reveal } from "@/components/ui/Reveal";
import { ValueChange } from "@/components/ui/ValueChange";
import { sumStock, type StockSource } from "@/lib/inventory-stock";
import { sortProducts } from "@/lib/product-order";
import type { InventorySortOption } from "./InventoryFilters";

interface InventarioListProps {
  products: Product[];
  onViewMovements?: (product: Product) => void;
  /** True when the unified (server-side) search is active, to tweak empty states. */
  searchActive?: boolean;
  /** Category options hoisted from the page (shared by all cards, avoids N+1). */
  categories?: Array<{ id: number; name: string }>;
  /** El orden vive en la página, junto al filtro de categoría (mismo control). */
  sortBy: InventorySortOption;
}

/** Sum stock across every branch row (inventory[0] alone is wrong for "Todas"). */
function readStock(p: Product): number {
  return sumStock(p as unknown as StockSource);
}

export function InventarioList({ products, onViewMovements, searchActive = false, categories = [], sortBy }: InventarioListProps) {
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);

  // Filter (low stock only) and sort products. Search is handled server-side.
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filter by low stock (uses branch stock when available)
    if (showOnlyLowStock) {
      result = result.filter((p) => readStock(p) <= 5);
    }

    // Sort. Por código es el default de todas las listas de productos (S4).
    switch (sortBy) {
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "stock-asc":
        result.sort((a, b) => readStock(a) - readStock(b));
        break;
      case "stock-desc":
        result.sort((a, b) => readStock(b) - readStock(a));
        break;
      case "updated":
        return sortProducts(result, "updated");
      case "code":
      default:
        return sortProducts(result, "code");
    }

    return result;
  }, [products, sortBy, showOnlyLowStock]);

  // Summary stats
  const stats = useMemo(() => {
    const total = products.length;
    const lowStock = products.filter((p) => readStock(p) <= 5).length;
    const outOfStock = products.filter((p) => readStock(p) === 0).length;
    const totalUnits = products.reduce((sum, p) => sum + readStock(p), 0);
    return { total, lowStock, outOfStock, totalUnits };
  }, [products]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro de stock bajo. El select de orden vive en `InventoryFilters`,
          junto al de categoría: así los dos selectores comparten contenedor
          y tamaño (S2). */}
      <div className="glass rounded-2xl border border-black/5 p-4">
        {/* Control segmentado: la opción elegida va `btn-active`, la otra `btn-secondary`. */}
        <button
          onClick={() => setShowOnlyLowStock(!showOnlyLowStock)}
          aria-pressed={showOnlyLowStock}
          className={`btn ${showOnlyLowStock ? "btn-active" : "btn-secondary"} w-full whitespace-nowrap sm:w-auto`}
        >
          Stock bajo ({stats.lowStock})
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass rounded-xl border border-black/5 p-3 text-center">
          {/* Un valor que cambia entra animado (S9): un solo nodo de texto. */}
          <ValueChange key={stats.total} className="block text-xl font-bold text-ink">
            {stats.total}
          </ValueChange>
          <div className="text-xs text-ink-muted">Productos</div>
        </div>
        <div className="glass rounded-xl border border-black/5 p-3 text-center">
          {/* #b45309 es el ámbar que llega a 4.5:1 sobre estas superficies. */}
          <ValueChange key={stats.lowStock} className="block text-xl font-bold text-[#b45309]">
            {stats.lowStock}
          </ValueChange>
          <div className="text-xs text-ink-muted">Stock bajo</div>
        </div>
        <div className="glass rounded-xl border border-black/5 p-3 text-center">
          <ValueChange key={stats.totalUnits} className="block text-xl font-bold text-ink">
            {stats.totalUnits}
          </ValueChange>
          <div className="text-xs text-ink-muted">Total uds</div>
        </div>
      </div>

      {/* Products List */}
      <div className="flex flex-col gap-3">
{filteredProducts.length === 0 ? (
         <div className="text-center py-8 text-ink-muted">
           {searchActive || showOnlyLowStock
             ? "No se encontraron productos"
             : "No hay productos en el inventario"}
         </div>
       ) : (
          filteredProducts.map((product, index) => (
            <Reveal key={product.id} index={index}>
              <InventarioCard 
                product={product} 
                data-product-id={product.id}
                onViewMovements={onViewMovements}
                categories={categories}
              />
            </Reveal>
          ))
       )}
      </div>
    </div>
  );
}
