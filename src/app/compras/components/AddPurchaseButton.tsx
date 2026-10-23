"use client";

import { useState, useRef } from "react";
import { createPurchaseWithBranchSplit } from "../../actions/purchase";
import { getProducts } from "../../actions/product";
import { getUser } from "@/actions/auth";
import { useRouter } from "next/navigation";
import { Product } from "@prisma/client";
import Swal from "sweetalert2";
import { ProductAutocomplete } from "./ProductAutocomplete";
import { ProductForm } from "@/app/productos/components/ProductForm";
import { useBranch } from "@/lib/context/BranchContext";

interface AddPurchaseButtonProps {
  products: Product[];
  /** Called after a successful purchase, so the page can re-run its load effect. */
  onSuccess?: () => void;
}

interface PurchaseItem {
  id: string;
  productId: string;
  branchId: string;
  price: string;
  quantity: string;
}

export function AddPurchaseButton({ products: initialProducts, onSuccess }: AddPurchaseButtonProps) {
  const router = useRouter();
  const { branches } = useBranch();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>([
    { id: "1", productId: "", branchId: "", price: "", quantity: "" }
  ]);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Contador por ref para ids de fila estables (evita colisiones de Date.now())
  const nextItemId = useRef(1);

  const addItem = () => {
    nextItemId.current += 1;
    setItems(prev => [...prev, { 
      id: String(nextItemId.current), 
      productId: "", 
      branchId: "",
      price: "", 
      quantity: "" 
    }]);
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(item => item.id !== id);
    });
  };

  const updateItem = (id: string, field: string, value: string) => {
    setItems(prev => prev.map(item => 
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

    // Single-flight: ignorar envíos mientras ya hay uno en curso
    if (loading) return;

    // Validate all items
    const validItems = items.filter(item => item.productId && item.branchId && item.price && item.quantity);
    if (validItems.length === 0) {
      await Swal.fire({
        title: "Error",
        text: "Por favor agregá al menos un producto",
        icon: "error",
        confirmButtonColor: "#dc2626",
      });
      return;
    }

    setLoading(true);

    // performedBy: email del usuario autenticado (audit trail de movimientos)
    const user = await getUser();

    const result = await createPurchaseWithBranchSplit({
        items: validItems.map(item => ({
          productId: parseInt(item.productId),
          branchId: parseInt(item.branchId),
          quantity: parseInt(item.quantity),
          price: parseFloat(item.price),
        })),
        ...(user?.email ? { performedBy: user.email } : {}),
      });

    if (result.success) {
      const totalItems = validItems.reduce((sum, item) => sum + parseInt(item.quantity), 0);
      await Swal.fire({
        title: "Compra registrada",
        text: `${totalItems} unidades agregadas al inventario`,
        icon: "success",
        confirmButtonColor: "#6d28d9",
        confirmButtonText: "Aceptar",
      });
      router.refresh();
      onSuccess?.();
      setIsOpen(false);
      setItems([{ id: "1", productId: "", branchId: "", price: "", quantity: "" }]);
    } else {
      await Swal.fire({
        title: "Error",
        text: result.error || "Error al registrar la compra",
        icon: "error",
        confirmButtonColor: "#dc2626",
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
        className="btn-fab fixed bottom-24 right-6 z-40"
        aria-label="Registrar compra"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

{isOpen && (
          <div 
            className={`fixed inset-0 ${showProductModal ? 'bg-black/20 backdrop-blur-md' : 'bg-scrim backdrop-blur-md'} z-[60] flex items-end justify-center md:items-center`}
            onClick={() => setIsOpen(false)}
          >
          <div 
            className="bg-surface w-full max-w-lg md:max-w-4xl rounded-t-3xl md:rounded-2xl p-6 animate-slide-up md:animate-scale-in max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-ink">Nueva Compra</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-icon btn-round hover:bg-surface-strong"
                aria-label="Cerrar"
              >
                <svg className="w-6 h-6 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-ink-muted mb-4">No hay productos registrados</p>
                <p className="text-sm text-ink-muted">Primero creá un producto en la sección Inventario</p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-4 md:grid md:grid-cols-2 md:gap-5 md:items-start"
              >
                {/* Desde `md` el cuerpo va en dos columnas: a la izquierda lo que se
                    compra, a la derecha el total con la acción. En celular se apila
                    en el mismo orden de siempre. */}
                {/* Columna izquierda: buscador de productos y lista de ítems. */}
                <div className="space-y-4">
                  {/* Items */}
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-hairline bg-surface-soft p-4 space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                          Producto {index + 1}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              Swal.fire({
                                title: '¿Eliminar item?',
                                text: 'Esta acción no se puede deshacer',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: "#6d28d9",
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
                            className="btn btn-danger"
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

                      <div>
                        <label htmlFor={`branch-${item.id}`} className="block text-xs text-ink-muted mb-2">
                          Sucursal
                        </label>
                        <select
                          id={`branch-${item.id}`}
                          value={item.branchId}
                          onChange={(e) => updateItem(item.id, "branchId", e.target.value)}
                          className="w-full px-3 py-3 min-h-[48px] rounded-lg border border-hairline focus:border-accent outline-none transition-all text-sm touch-manipulation"
                          required
                        >
                          <option value="">Seleccionar sucursal</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor={`price-${item.id}`} className="block text-xs text-ink-muted mb-2">
                            Precio
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm">$</span>
                            <input
                              id={`price-${item.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price}
                              onChange={(e) => updateItem(item.id, "price", e.target.value)}
                              className="w-full pl-7 pr-3 py-3 min-h-[48px] rounded-lg border border-hairline focus:border-accent outline-none transition-all text-sm touch-manipulation tabular-nums text-right"
                              placeholder="0.00"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`quantity-${item.id}`} className="block text-xs text-ink-muted mb-2">
                            Cantidad
                          </label>
                          <input
                            id={`quantity-${item.id}`}
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                            className="w-full px-3 py-3 min-h-[48px] rounded-lg border border-hairline focus:border-accent outline-none transition-all text-sm touch-manipulation tabular-nums text-right"
                            placeholder="0"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-hairline">
                        <span className="text-sm text-ink-muted">Subtotal</span>
                        <span className="font-medium text-ink tabular-nums">
                          ${calculateSubtotal(item.price, item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Add Another Product Button */}
                  <button
                    type="button"
                    onClick={addItem}
                    className="btn btn-secondary w-full md:w-auto"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar otro producto
                  </button>
                </div>

                {/* Columna derecha: el total y la acción. En celular queda debajo de los
                    ítems, en el orden de siempre. El total sigue siendo el bloque
                    inverso (fondo `ink`, texto `surface`): con `text-white` fijo, en
                    tema oscuro quedaba blanco sobre blanco. */}
                <div className="mt-4 space-y-4 md:mt-0 md:sticky md:top-4">
                  {/* Total */}
                  <div className="p-4 bg-ink rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-surface font-medium">Total</span>
                      <span className="text-surface text-xl font-bold tabular-nums">
                        ${calculateTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full"
                  >
                    {loading ? "Registrando..." : "Registrar Compra"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Product Creation Modal */}
      {showProductModal && (
        <div 
          className="fixed inset-0 bg-scrim-strong backdrop-blur-sm z-[70] flex items-end justify-center md:items-center"
          onClick={() => {
            setShowProductModal(false);
            setEditingItemId(null);
          }}
        >
          <div 
            className="bg-surface w-full max-w-lg rounded-t-3xl md:rounded-2xl p-6 animate-slide-up md:animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-ink">
                {editingItemId ? "Crear producto para edición" : "Nuevo Producto"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowProductModal(false);
                  setEditingItemId(null);
                }}
                className="btn btn-icon btn-round hover:bg-surface-strong"
                aria-label="Cerrar"
              >
                <svg className="w-6 h-6 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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