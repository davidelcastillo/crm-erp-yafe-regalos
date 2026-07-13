"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Product } from "@prisma/client";
import { InventarioCard } from "./InventarioCard";
import { ProductSearch, ProductSearchResult } from "@/components/ProductSearch";

interface InventarioListProps {
  products: Product[];
  onViewMovements?: (product: Product) => void;
}

type SortOption = "name" | "stock-asc" | "stock-desc" | "recent";

export function InventarioList({ products, onViewMovements }: InventarioListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
  const [highlightedProductId, setHighlightedProductId] = useState<number | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // Scroll to highlighted product
  useEffect(() => {
    if (highlightedProductId && cardsRef.current) {
      const highlightedCard = cardsRef.current.querySelector(
        `[data-product-id="${highlightedProductId}"]`
      );
      if (highlightedCard) {
        highlightedCard.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        // Add temporary highlight effect
        highlightedCard.classList.add("ring-2", "ring-[#3b82f6]", "ring-offset-2");
        setTimeout(() => {
          highlightedCard.classList.remove("ring-2", "ring-[#3b82f6]", "ring-offset-2");
        }, 2000);
      }
    }
  }, [highlightedProductId]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.description && p.description.toLowerCase().includes(term))
      );
    }

    // Filter by low stock
    if (showOnlyLowStock) {
      result = result.filter((p) => p.stock <= 5);
    }

    // Sort
    switch (sortBy) {
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "stock-asc":
        result.sort((a, b) => a.stock - b.stock);
        break;
      case "stock-desc":
        result.sort((a, b) => b.stock - a.stock);
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
  }, [products, searchTerm, sortBy, showOnlyLowStock]);

  // Summary stats
  const stats = useMemo(() => {
    const total = products.length;
    const lowStock = products.filter((p) => p.stock <= 5).length;
    const outOfStock = products.filter((p) => p.stock === 0).length;
    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
    return { total, lowStock, outOfStock, totalUnits };
  }, [products]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <input
          type="text"
          placeholder="Buscar productos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 bg-[#f8f8f8] rounded-xl text-base text-[#222222] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20"
        />

        {/* Inline Product Search */}
        <div className="mt-3">
          <ProductSearch
            mode="inline"
            onSelect={(product) => setHighlightedProductId(product.id)}
            placeholder="Buscar producto por código o nombre..."
          />
        </div>

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
      <div ref={cardsRef} className="flex flex-col gap-3">
{filteredProducts.length === 0 ? (
         <div className="text-center py-8 text-[#6a6a6a]">
           {searchTerm || showOnlyLowStock
             ? "No se encontraron productos"
             : "No hay productos en el inventario"}
         </div>
       ) : (
         filteredProducts.map((product) => (
           <InventarioCard 
             key={product.id} 
             product={product} 
             data-product-id={product.id}
             isHighlighted={highlightedProductId === product.id}
             onViewMovements={onViewMovements}
           />
         ))
       )}
      </div>
    </div>
  );
}