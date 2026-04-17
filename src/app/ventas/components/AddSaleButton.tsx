"use client";

import { useState, useEffect } from "react";
import { registerSale } from "../../actions/sale";
import { getCustomers } from "../../actions/customer";
import { useRouter } from "next/navigation";
import { Product, Customer } from "@prisma/client";
import Swal from "sweetalert2";

interface AddSaleButtonProps {
  products: Product[];
}

interface CustomerOption {
  id: number;
  name: string;
  surname: string;
  totalBalance: number;
}

interface SaleItem {
  id: string;
  productId: string;
  price: string;
  quantity: string;
}

export function AddSaleButton({ products }: AddSaleButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [items, setItems] = useState<SaleItem[]>([
    { id: "1", productId: "", price: "", quantity: "" }
  ]);

  // Load customers on mount
  useEffect(() => {
    async function loadCustomers() {
      const result = await getCustomers();
      if (result.success && result.data) {
        setCustomers(result.data as unknown as CustomerOption[]);
      }
    }
    loadCustomers();
  }, []);

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

  const calculatePending = () => {
    const total = calculateTotal();
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, total - paid);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

    const result = await registerSale({
      items: validItems.map(item => ({
        productId: parseInt(item.productId),
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity),
      })),
      customerId: selectedCustomerId ? parseInt(selectedCustomerId) : undefined,
      amountPaid: amountPaid ? parseFloat(amountPaid) : 0,
    });

    if (result.success) {
      const totalItems = validItems.reduce((sum, item) => sum + parseInt(item.quantity), 0);
      await Swal.fire({
        title: "Venta registrada",
        text: `${totalItems} unidades vendidas por $${calculateTotal().toFixed(2)}`,
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
        text: result.error || "Error al registrar la venta",
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
        aria-label="Registrar venta"
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
              <h2 className="text-xl font-semibold text-[#222222]">Nueva Venta</h2>
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
                    
                    <select
                      value={item.productId}
                      onChange={(e) => updateItem(item.id, "productId", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all bg-white"
                      required
                    >
                      <option value="">Seleccionar producto...</option>
                      {products.filter(p => p.stock > 0).map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} (Stock: {product.stock})
                        </option>
                      ))}
                    </select>

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

                {/* Customer Selection */}
                <div className="p-4 bg-[#f9f9f9] rounded-xl">
                  <label className="block text-sm font-medium text-[#222222] mb-2">Cliente (opcional)</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all bg-white"
                  >
                    <option value="">Cliente Anónimo</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.surname}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount Paid */}
                <div className="p-4 bg-[#f9f9f9] rounded-xl">
                  <label className="block text-sm font-medium text-[#222222] mb-2">Monto Pagado</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6a] text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-full pl-7 pr-3 py-3 rounded-xl border border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Totals */}
                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-green-800 font-medium">Total Venta</span>
                    <span className="text-green-700 font-bold">
                      ${calculateTotal().toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-green-800">Monto Pagado</span>
                    <span className="text-green-600">-${(parseFloat(amountPaid) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-green-200">
                    <div className="flex items-center gap-2">
                      <span className="text-green-800 font-medium">Saldo Pendiente</span>
                      <button
                        type="button"
                        onClick={() => setAmountPaid(calculateTotal().toFixed(2))}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Total
                      </button>
                    </div>
                    <span className="text-green-700 text-xl font-bold">
                      ${calculatePending().toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-[#222222] text-white font-medium rounded-xl hover:bg-[#3f3f3f] transition-colors disabled:opacity-50"
                >
                  {loading ? "Registrando..." : "Registrar Venta"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}