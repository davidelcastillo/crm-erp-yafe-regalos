"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Product } from "@prisma/client";

interface ProductAutocompleteProps {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  /** When true, renders a "+ Nuevo producto" button to the right of the input. */
  renderCreateButton?: boolean;
  /** Callback when the create button is clicked. */
  onCreateClick?: () => void;
}

export function ProductAutocomplete({
  products,
  value,
  onChange,
  renderCreateButton = true,
  onCreateClick,
}: ProductAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products.slice(0, 20); // Show max 20 initially
    const lower = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(lower)).slice(0, 20);
  }, [products, search]);

  // Find selected product
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id.toString() === value);
  }, [products, value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (product: Product) => {
    onChange(product.id.toString());
    setSearch(product.name);
    setIsOpen(false);
  };

const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setIsOpen(true);

    // Update input to what user typed
    setSearch(newValue);

    // Auto-select if exact match
    const match = products.find(p => p.name.toLowerCase() === newValue.toLowerCase());
    if (match) {
      onChange(match.id.toString());
      // Optionally, correct the casing of the input
      setSearch(match.name);
    } else {
      // Clear selection if no match
      onChange("");
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={search}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder="Buscar producto..."
        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all bg-white"
      />
      
      {renderCreateButton && (
        <button
          type="button"
          onClick={onCreateClick}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center bg-[#ff385c] text-white rounded-full hover:bg-[#e00b41] transition-colors text-sm"
          aria-label="Crear nuevo producto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
      
      {isOpen && filteredProducts.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelect(product)}
              className="w-full px-4 py-3 text-left hover:bg-[#f9f9f9] flex justify-between items-center transition-colors"
            >
              <span className="font-medium text-[#222222]">{product.name}</span>
              <span className="text-sm text-[#6a6a6a]">Stock: {product.stock}</span>
            </button>
          ))}
        </div>
      )}
      
      {selectedProduct && (
        <p className="mt-1 text-xs text-[#6a6a6a]">
          Stock actual: {selectedProduct.stock} unidades
        </p>
      )}
    </div>
  );
}