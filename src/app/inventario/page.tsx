// src/app/inventario/page.tsx
// src/app/inventario/page.tsx
'use client';

import { getProducts } from "../actions/product";
import { InventarioList } from "./components/InventarioList";
import { LabelSelector } from "@/components/ui/LabelSelector";
import { MovementsModal } from "@/components/ui/MovementsModal";
import { useEffect, useState } from 'react';
import { Product } from "@prisma/client";

export default function InventarioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labelSelectorOpen, setLabelSelectorOpen] = useState(false);
  const [movementsModalOpen, setMovementsModalOpen] = useState(false);
  const [selectedProductForMovements, setSelectedProductForMovements] = useState<Product | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        const result = await getProducts();
        if (!cancelled) {
          if (result.success && result.data) {
            setProducts(result.data as Product[]);
            setError(null);
          } else {
            setError(result.error ?? 'Failed to load products');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError('Error al cargar productos');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <header className="sticky top-0 bg-white z-40 px-6 pt-6 pb-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#222222]">Inventario</h1>
              <p className="text-sm text-[#6a6a6a] mt-1">Gesti��n de stock en tiempo real</p>
            </div>
            <button
              onClick={() => setLabelSelectorOpen(true)}
              className="flex items-center px-3 py-2 bg-[#3b82f6] text-white rounded-md hover:bg-[#2563eb] transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Imprimir Etiquetas
            </button>
          </div>
        </header>
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
        <header className="sticky top-0 bg-white z-40 px-6 pt-6 pb-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#222222]">Inventario</h1>
              <p className="text-sm text-[#6a6a6a] mt-1">Gesti��n de stock en tiempo real</p>
            </div>
            <button
              onClick={() => setLabelSelectorOpen(true)}
              className="flex items-center px-3 py-2 bg-[#3b82f6] text-white rounded-md hover:bg-[#2563eb] transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Imprimir Etiquetas
            </button>
          </div>
        </header>
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
      <header className="sticky top-0 bg-white z-40 px-6 pt-6 pb-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-[#222222]">Inventario</h1>
            <p className="text-sm text-[#6a6a6a] mt-1">Gesti��n de stock en tiempo real</p>
          </div>
          <button
            onClick={() => setLabelSelectorOpen(true)}
            className="flex items-center px-3 py-2 bg-[#3b82f6] text-white rounded-md hover:bg-[#2563eb] transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Imprimir Etiquetas
          </button>
        </div>
      </header>
      <main className="px-6 py-8">
        <InventarioList 
          products={products} 
          onViewMovements={(product) => {
            setSelectedProductForMovements(product);
            setMovementsModalOpen(true);
          }}
        />
      </main>

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
    </div>
  );
}