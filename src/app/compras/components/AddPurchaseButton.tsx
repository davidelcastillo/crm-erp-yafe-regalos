"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { registerPurchase } from "../../actions/purchase";
import { useRouter } from "next/navigation";
import { Product } from "@prisma/client";
import Swal from "sweetalert2";

interface AddPurchaseButtonProps {
  products: Product[];
}

interface PurchaseItem {
  id: string;
  productId: string;
  price: string;
  quantity: string;
}

// Autocomplete Input - busca productos sin crear nuevos
function ProductAutocomplete({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
}) {
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
    setSearch(newValue);
    setIsOpen(true);
    
    // Auto-select if exact match
    const match = products.find(p => p.name.toLowerCase() === newValue.toLowerCase());
    if (match) {
      onChange(match.id.toString());
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

export function AddPurchaseButton({ products }: AddPurchaseButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>([
    { id: "1", productId: "", price: "", quantity: "" }
  ]);

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center">
          <div 
            className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#222222]">Nueva Compra</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full hover:bg-[#f2f2f2] transition-colors"
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
                          onClick={() => removeItem(item.id)}
                          className="text-red-500 text-sm hover:text-red-700"
                        >
                          Eliminar
                        </button>
                      )}
</div>
                    
                    <ProductAutocomplete
                      products={products}
                      value={item.productId}
                      onChange={(productId) => updateItem(item.id, "productId", productId)}
                    />
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#6a6a6a] mb-1">Precio</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6a] text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, "price", e.target.value)}
                            className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 focus:border-[#ff385c] outline-none transition-all text-sm"
                            placeholder="0.00"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-[#6a6a6a] mb-1">Cantidad</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-[#ff385c] outline-none transition-all text-sm"
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
    </>
  );
}