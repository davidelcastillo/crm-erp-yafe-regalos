"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { searchProducts } from "@/app/actions/product";

export interface ProductSearchResult {
  id: number;
  code: string;
  name: string;
  price: number;
  stock: number;
}

type ProductSearchModalProps = {
  mode: "modal";
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: ProductSearchResult) => void;
  placeholder?: string;
};

type ProductSearchInlineProps = {
  mode: "inline";
  onSelect: (product: ProductSearchResult) => void;
  placeholder?: string;
};

type ProductSearchProps = ProductSearchModalProps | ProductSearchInlineProps;

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 10;

export function ProductSearch(props: ProductSearchProps) {
  const { mode, onSelect, placeholder = "Buscar producto por código o nombre..." } = props;
  
  // Modal-specific props
  const isOpen = mode === "modal" ? props.isOpen : true;
  const onClose = mode === "modal" ? props.onClose : () => {};

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search effect
  useEffect(() => {
    if (mode === "modal" && !isOpen) {
      setQuery("");
      setResults([]);
      setError(null);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      const trimmedQuery = query.trim();
      
      if (!trimmedQuery) {
        setResults([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await searchProducts({ query: trimmedQuery });
        if (result.success) {
          // Convert Decimal price to number for ProductSearchResult
          const converted = result.data?.slice(0, MAX_RESULTS).map(p => ({
            ...p,
            price: Number(p.price)
          })) ?? [];
          setResults(converted);
        } else {
          setError(result.error ?? "Error al buscar productos");
          setResults([]);
        }
      } catch {
        setError("Error de conexión");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, mode, isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (mode === "modal" && isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode, isOpen]);

  const handleSelect = (product: ProductSearchResult) => {
    onSelect(product);
    if (mode === "modal") {
      onClose();
    }
    setQuery("");
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mode === "modal" && e.key === "Escape") {
      onClose();
    }
  };

  if (mode === "inline") {
    return (
      <div className="w-full">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-3 bg-[#f8f8f8] rounded-xl text-base text-[#222222] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20"
          aria-label="Buscar producto"
          autoComplete="off"
        />
        {error && (
          <p className="mt-2 text-sm text-red-500" role="alert">{error}</p>
        )}
        {loading && (
          <div className="mt-2 flex items-center gap-2 text-sm text-[#6a6a6a]">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Buscando...
          </div>
        )}
        {!loading && !error && query.trim() && results.length === 0 && (
          <p className="mt-2 text-sm text-[#6a6a6a]">No se encontraron productos</p>
        )}
        {!loading && results.length > 0 && (
          <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto" role="listbox">
            {results.map((product) => (
              <li
                key={product.id}
                onClick={() => handleSelect(product)}
                className="px-3 py-2 bg-white rounded-lg border border-gray-100 hover:bg-[#f8f8f8] transition-colors cursor-pointer flex items-center justify-between"
                role="option"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleSelect(product)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#222222] truncate">{product.name}</p>
                  <div className="flex items-center gap-2 text-xs text-[#6a6a6a] mt-0.5">
                    <span className="px-2 py-0.5 bg-[#f2f2f2] rounded">{product.code}</span>
                    <span>${product.price.toFixed(2)}</span>
                    <span className={product.stock <= 5 ? "text-red-500" : ""}>
                      Stock: {product.stock}
                    </span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-[#6a6a6a] flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Modal mode
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-search-title"
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="product-search-title" className="text-xl font-semibold text-[#222222]">
            Buscar Producto
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#f2f2f2] transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-3 bg-[#f8f8f8] rounded-xl text-base text-[#222222] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 mb-4"
          aria-label="Buscar producto por código o nombre"
          autoComplete="off"
        />

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-[#6a6a6a]">
            <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Buscando productos...
          </div>
        ) : query.trim() && results.length === 0 ? (
          <div className="text-center py-8 text-[#6a6a6a]">
            <p className="font-medium">No se encontraron productos</p>
            <p className="text-sm mt-1">Probá con otro código o nombre</p>
          </div>
        ) : results.length > 0 ? (
          <ul className="space-y-1 max-h-[60vh] overflow-y-auto" role="listbox">
            {results.map((product) => (
              <li
                key={product.id}
                onClick={() => handleSelect(product)}
                className="px-4 py-3 bg-white rounded-lg border border-gray-100 hover:bg-[#f8f8f8] transition-colors cursor-pointer flex items-center justify-between"
                role="option"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleSelect(product)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-[#222222] truncate">{product.name}</p>
                  <div className="flex items-center gap-2 text-sm text-[#6a6a6a] mt-1">
                    <span className="px-2 py-0.5 bg-[#f2f2f2] rounded font-mono text-xs">{product.code}</span>
                    <span className="font-medium">${product.price.toFixed(2)}</span>
                    <span className={product.stock <= 5 ? "text-red-500 font-medium" : ""}>
                      Stock: {product.stock}
                    </span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#6a6a6a] flex-shrink-0 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8 text-[#6a6a6a]">
            <p className="font-medium">Escribí para buscar productos</p>
            <p className="text-sm mt-1">Busca por código (ej: AA001) o nombre</p>
          </div>
        )}
      </div>
    </div>
  );
}