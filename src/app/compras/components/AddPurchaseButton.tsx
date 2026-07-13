"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { registerPurchase } from "../../actions/purchase";
import { getProducts } from "../../actions/product";
import { useRouter } from "next/navigation";
import { Product } from "@prisma/client";
import Swal from "sweetalert2";
import { ProductAutocomplete } from "./ProductAutocomplete";
import { ProductForm } from "@/app/productos/components/ProductForm";

interface AddPurchaseButtonProps {
  products: Product[];
}

interface PurchaseItem {
  id: string;
  productId: string;
  price: string;
  quantity: string;
}

export function AddPurchaseButton({ products: initialProducts }: AddPurchaseButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>([
    { id: "1", productId: "", price: "", quantity: "" }
  ]);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const addItem = () => {
    setItems([...items, { 
      id: Date.now().toString(), 
      productId: "", 
      price: "", 
      quantity: "" 
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: string, value: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateSubtotal = (price: string, quantity: string) => {
    const p = parseFloat(price) || 0;
    const q = parseInt(quantity) || 0;
    return p * q;
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + calculateSubtotal(item.price, item.quantity), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all items
    const validItems = items.filter(item => item.productId && item.price && item.quantity);
    if (validItems.length === 0) {
      await Swal.fire({
        title: "Error",
        text: "Por favor agregá al menos un producto",
        icon: "error",
        confirmButtonColor: "#ff385c",
      });
      return;
    }

    setLoading(true);

    const result = await registerPurchase({
      items: validItems.map(item => ({
        productId: parseInt(item.productId),
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity),
      })),
    });

    if (result.success) {
      const totalItems = validItems.reduce((sum, item) => sum + parseInt(item.quantity), 0);
      await Swal.fire({
        title: "Compra registrada",
        text: `${totalItems} unidades agregadas al inventario`,
        icon: "success",
        confirmButtonColor: "#ff385c",
        confirmButtonText: "Aceptar",
        background: "#ffffff",
        color: "#222222",
      });
      router.refresh();
      setIsOpen(false);
      setItems([{ id: "1", productId: "", price: "", quantity: "" }]);
    } else {
      await Swal.fire({
        title: "Error",
        text: result.error || "Error al registrar la compra",
        icon: "error",
        confirmButtonColor: "#ff385c",
        background: "#ffffff",
        color: "#222222",
      });
    }
    setLoading(false);
  };

  const handleProductCreated = async (product: Product) => {
    // Refresh product list
    const result = await getProducts();
    if (result.success) {
      setProducts(result.data as Product[]);
    }
    
    // Update the item being edited with the new product ID
    if (editingItemId) {
      updateItem(editingItemId, "productId", product.id.toString());
    }
    
    // Close product modal
    setShowProductModal(false);
    setEditingItemId(null);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-[#ff385c] text-white rounded-full shadow-lg hover:bg-[#e00b41] transition-colors flex items-center justify-center z-40"
        aria-label="Registrar compra"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

{isOpen && (
          <div 
            className={`fixed inset-0 ${showProductModal ? 'bg-black/20 backdrop-blur-md' : 'bg-black/30 backdrop-blur-md'} z-[60] flex items-end justify-center`}
            onClick={() => setIsOpen(false)}
          >
          <div 
            className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#222222]">Nueva Compra</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[#f2f2f2] transition-colors touch-manipulation"
                aria-label="Cerrar"
              >
                <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#6a6a6a] mb-4">No hay productos registrados</p>
                <p className="text-sm text-[#6a6a6a]">Primero creá un producto en la sección Productos</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Items */}
                {items.map((item, index) => (
                  <div key={item.id} className="p-4 bg-[#f9f9f9] rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-[#222222]">Producto {index + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            Swal.fire({
                              title: '¿Eliminar item?',
                              text: 'Esta acción no se puede deshacer',
                              icon: 'warning',
                              showCancelButton: true,
                              confirmButtonColor: '#ff385c',
                              cancelButtonColor: '#6a6a6a',
                              confirmButtonText: 'Sí, eliminar',
                              cancelButtonText: 'Cancelar',
                              background: '#ffffff',
                              color: '#222222',
                            }).then((result) => {
                              if (result.isConfirmed) {
                                removeItem(item.id);
                              }
                            });
                          }}
                          className="min-w-[44px] min-h-[44px] px-4 py-2 text-red-500 text-sm font-medium rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation"
                          aria-label={`Eliminar producto ${index + 1}`}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                    
                    <ProductAutocomplete
                      products={products}
                      value={item.productId}
                      onChange={(productId) => updateItem(item.id, "productId", productId)}
                      renderCreateButton={true}
                      onCreateClick={() => {
                        setEditingItemId(item.id);
                        setShowProductModal(true);
                      }}
                    />
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`price-${item.id}`} className="block text-xs text-[#6a6a6a] mb-2">
                          Precio
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6a] text-sm">$</span>
                          <input
                            id={`price-${item.id}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, "price", e.target.value)}
                            className="w-full pl-7 pr-3 py-3 min-h-[48px] rounded-lg border border-gray-200 focus:border-[#ff385c] outline-none transition-all text-sm touch-manipulation"
                            placeholder="0.00"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor={`quantity-${item.id}`} className="block text-xs text-[#6a6a6a] mb-2">
                          Cantidad
                        </label>
                        <input
                          id={`quantity-${item.id}`}
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                          className="w-full px-3 py-3 min-h-[48px] rounded-lg border border-gray-200 focus:border-[#ff385c] outline-none transition-all text-sm touch-manipulation"
                          placeholder="0"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm text-[#6a6a6a]">Subtotal</span>
                      <span className="font-medium text-[#222222]">
                        ${calculateSubtotal(item.price, item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Add Another Product Button */}
                <button
                  type="button"
                  onClick={addItem}
                  className="w-full py-3 border-2 border-dashed border-gray-300 text-[#6a6a6a] rounded-xl hover:border-[#ff385c] hover:text-[#ff385c] transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar otro producto
                </button>

                {/* Total */}
                <div className="p-4 bg-[#222222] rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">Total</span>
                    <span className="text-white text-xl font-bold">
                      ${calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-[#ff385c] text-white font-medium rounded-xl hover:bg-[#e00b41] transition-colors disabled:opacity-50"
                >
                  {loading ? "Registrando..." : "Registrar Compra"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Product Creation Modal */}
      {showProductModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end justify-center"
          onClick={() => {
            setShowProductModal(false);
            setEditingItemId(null);
          }}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#222222]">
                {editingItemId ? "Crear producto para edición" : "Nuevo Producto"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowProductModal(false);
                  setEditingItemId(null);
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
              onClose={() => {
                setShowProductModal(false);
                setEditingItemId(null);
              }}
              onSuccess={handleProductCreated}
            />
          </div>
        </div>
      )}
    </>
  );
}