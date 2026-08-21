// src/app/productos/page.tsx
'use client';

import { getProducts } from '@/app/actions/product';
import { Product } from '@prisma/client';
import { AddProductButton } from './components/AddProductButton';
import { LabelSelector } from '@/components/ui/LabelSelector';
import { ProductCard } from './components/ProductCard';
import { ProductForm } from './components/ProductForm';
import { BranchSelector } from '@/components/ui/BranchSelector';
import { useEffect, useState, useCallback } from 'react';

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labelSelectorOpen, setLabelSelectorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [branchId, setBranchId] = useState<number | null>(null);

  const fetchProducts = useCallback(async (bId: number | null) => {
    try {
      setLoading(true);
      const result = await getProducts(bId ?? undefined);
      if (result.success && result.data) {
        setProducts(result.data as Product[]);
        setError(null);
      } else {
        setError(result.error ?? 'Failed to load products');
      }
    } catch {
      setError('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(branchId);
  }, [branchId, fetchProducts]);

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsEditing(true);
  };

  const handleProductCreated = () => {
    fetchProducts(branchId);
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
              <span className="text-sm text-[#6a6a6a]">Cargando productos...</span>
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
    <div className="min-h-screen bg-white pb-20 relative">
      {/* Floating Action Button for adding new products */}
      <div className="absolute bottom-6 right-6">
        <AddProductButton />
      </div>

      {/* Main Content */}
      <main className="px-6 pb-12">
        {/* Page Title + Branch Selector */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-[#222222]">Productos</h1>
          <BranchSelector
            onChange={(id) => setBranchId(id)}
            label="Stock por sucursal"
          />
        </div>

        {/* Products Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.length === 0 ? (
            <div className="col-span-full text-center py-12 text-[#6a6a6a]">
              <p>No hay productos registrados</p>
              <p className="mt-2 text-sm">Use el botón flotante + para agregar su primer producto</p>
            </div>
          ) : (
            products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={handleEditProduct}
                // The ProductCard already includes a DeleteButton that handles deletion
              />
            ))
          )}
        </div>
      </main>

      {/* Product Edit Modal */}
      {selectedProduct && isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#222222]">Editar producto</h2>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setIsEditing(false);
                }}
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[#f2f2f2] transition-colors touch-manipulation"
                aria-label="Cerrar"
              >
                <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ProductForm 
              product={selectedProduct}
              onClose={() => {
                setSelectedProduct(null);
                setIsEditing(false);
              }}
              onSuccess={handleProductCreated}
            />
          </div>
        </div>
      )}

      {/* Label Selector Modal */}
      <LabelSelector
        isOpen={labelSelectorOpen}
        onClose={() => setLabelSelectorOpen(false)}
      />
    </div>
  );
}