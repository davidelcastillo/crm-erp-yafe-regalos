"use client";

import { useState, useMemo } from "react";
import { Product } from "@prisma/client";
import { InventarioCard } from "./InventarioCard";
import { sumStock, type StockSource } from "@/lib/inventory-stock";

interface InventarioListProps {
  products: Product[];
  onViewMovements?: (product: Product) => void;
  branchId?: number | null;
  /** True when the unified (server-side) search is active, to tweak empty states. */
  searchActive?: boolean;
  /** Category options hoisted from the page (shared by all cards, avoids N+1). */
  categories?: Array<{ id: number; name: string }>;
}

type SortOption = "name" | "stock-asc" | "stock-desc" | "recent";

/** Sum stock across every branch row (inventory[0] alone is wrong for "Todas"). */
function readStock(p: Product): number {
  return sumStock(p as unknown as StockSource);
}

export function InventarioList({ products, onViewMovements, branchId, searchActive = false, categories = [] }: InventarioListProps) {
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);

  // Filter (low stock only) and sort products. Search is handled server-side.
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filter by low stock (uses branch stock when available)
    if (showOnlyLowStock) {
      result = result.filter((p) => readStock(p) <= 5);
    }

    // Sort
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
      case "recent":
      default:
        result.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
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
      {/* Sort and low-stock filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 text-sm bg-[#f2f2f2] rounded-lg text-[#222222] focus:outline-none"
          >
            <option value="recent">Más recientes</option>
            <option value="name">Por nombre</option>
            <option value="stock-asc">Stock: menor a mayor</option>
            <option value="stock-desc">Stock: mayor a menor</option>
          </select>

          <button
            onClick={() => setShowOnlyLowStock(!showOnlyLowStock)}
            className={`px-3 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
              showOnlyLowStock
                ? "bg-[#ef4444] text-white"
                : "bg-[#f2f2f2] text-[#222222]"
            }`}
          >
            Stock bajo ({stats.lowStock})
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-[#222222]">{stats.total}</div>
          <div className="text-xs text-[#6a6a6a]">Productos</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-[#f59e0b]">{stats.lowStock}</div>
          <div className="text-xs text-[#6a6a6a]">Stock bajo</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-[#222222]">{stats.totalUnits}</div>
          <div className="text-xs text-[#6a6a6a]">Total uds</div>
        </div>
      </div>

      {/* Products List */}
      <div className="flex flex-col gap-3">
{filteredProducts.length === 0 ? (
         <div className="text-center py-8 text-[#6a6a6a]">
           {searchActive || showOnlyLowStock
             ? "No se encontraron productos"
             : "No hay productos en el inventario"}
         </div>
       ) : (
          filteredProducts.map((product) => (
            <InventarioCard 
              key={product.id} 
              product={product} 
              data-product-id={product.id}
              onViewMovements={onViewMovements}
              branchId={branchId}
              categories={categories}
            />
          ))
       )}
      </div>
    </div>
  );
}
