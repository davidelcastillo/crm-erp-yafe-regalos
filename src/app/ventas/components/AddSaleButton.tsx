// src/app/ventas/components/AddSaleButton.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { registerSale } from "../../actions/sale";
import { getUser } from "@/actions/auth";
import { getCustomers } from "../../actions/customer";
import { useRouter } from "next/navigation";
import { Product } from "@prisma/client";
import Swal from "sweetalert2";
import { ProductSearch, ProductSearchResult } from "@/components/ProductSearch";
import { PaymentMethod, computePayment } from "@/lib/utils/payment";
import { useBranch } from "@/lib/context/BranchContext";
import { BranchPicker } from "@/components/ui/BranchPicker";
import { ValueChange } from "@/components/ui/ValueChange";

interface AddSaleButtonProps {
  products: Product[];
  /** Called after a successful sale, so the page can re-run its load effect. */
  onSuccess?: () => void;
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
  name: string;
  code: string;
  price: string;
  quantity: string;
}

type PaymentMethodType = "EFECTIVO" | "TRANSFERENCIA" | "MIXTO";

type PasoVenta = "sucursal" | "productos";

// shortcut: MIXTO desactivado por pedido (L30); reactivar mostrando la opción en la lista de medios
const MEDIOS_DE_PAGO: PaymentMethodType[] = ["EFECTIVO", "TRANSFERENCIA"];

export function AddSaleButton({ products, onSuccess }: AddSaleButtonProps) {
  const router = useRouter();
  const { branchId, branches } = useBranch();
  const [isOpen, setIsOpen] = useState(false);
  // Paso 1: elegir la sucursal. Paso 2: productos y pago.
  const [paso, setPaso] = useState<PasoVenta>("sucursal");
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [cashAmount, setCashAmount] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [items, setItems] = useState<SaleItem[]>([
    { id: "1", productId: "", name: "", code: "", price: "", quantity: "" }
  ]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("EFECTIVO");
  const [saleBranchId, setSaleBranchId] = useState<number | null>(null);
  const [searchRowId, setSearchRowId] = useState<string | null>(null);
  const rowIdRef = useRef(0);

  // Id monótono por fila: Date.now() se repetía cuando se agregaban dos filas en el
  // mismo milisegundo y la edición terminaba tocando las dos (bug 7.1 del usuario).
  const nextRowId = () => `row-${++rowIdRef.current}`;

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
      id: nextRowId(),
      productId: "",
      name: "",
      code: "",
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
    setItems(prevItems => prevItems.map(item =>
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

  // El pago sigue la misma regla que el servidor (`computePayment`): EFECTIVO y
  // TRANSFERENCIA cobran el total y MIXTO reparte efectivo/transferencia. Ya no
  // hay campo "Monto Pagado" (bug 8.3 del usuario).
  const calcularPago = () =>
    computePayment(PaymentMethod[paymentMethod], calculateTotal(), {
      cash: parseFloat(cashAmount) || 0,
      transfer: parseFloat(transferAmount) || 0,
    });

  // Sucursal elegida en el paso 1: el paso 2 la muestra como etiqueta, sin selector.
  const sucursalNombre = branches.find((b) => b.id === saleBranchId)?.name ?? "";

  const getProductDisplay = (item: SaleItem) => {
    if (!item.productId) return "Seleccionar producto...";
    return item.name && item.code
      ? item.name + " (" + item.code + ") - $" + parseFloat(item.price || "0").toFixed(2)
      : "Seleccionar producto...";
  };

  const handleProductSelect = (product: ProductSearchResult) => {
    // Manda la fila donde se abrió el selector. Antes se completaba la primera
    // fila vacía o se agregaba una nueva, así que cambiar un producto duplicaba
    // la fila con el mismo código (bug 7.1 del usuario).
    const targetId =
      searchRowId && items.some((item) => item.id === searchRowId)
        ? searchRowId
        : items.find((item) => !item.productId)?.id;

    if (targetId) {
      updateItem(targetId, "productId", product.id.toString());
      updateItem(targetId, "name", product.name);
      updateItem(targetId, "code", product.code);
      updateItem(targetId, "price", product.price.toString());
      setSearchRowId(null);
      return;
    }

    setItems([...items, {
      id: nextRowId(),
      productId: product.id.toString(),
      name: product.name,
      code: product.code,
      price: product.price.toString(),
      quantity: "1"
    }]);
    setSearchRowId(null);
  };

  const openProductSearch = (rowId: string) => {
    setSearchRowId(rowId);
    setIsProductSearchOpen(true);
  };

   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();

     // Require a branch for new sales (stock is branch-scoped)
     if (!saleBranchId) {
       await Swal.fire({
         title: "Sucursal requerida",
         text: "Seleccioná una sucursal antes de registrar una venta",
         icon: "warning",
         confirmButtonColor: "#6d28d9",
       });
       return;
     }

     const validItems = items.filter(item => item.productId && item.price && item.quantity);
     if (validItems.length === 0) {
       await Swal.fire({
         title: "Error",
         text: "Por favor agregá al menos un producto",
         icon: "error",
         confirmButtonColor: "#dc2626",
       });
       return;
     }

     // MIXTO requires at least one split amount greater than 0
     if (paymentMethod === "MIXTO") {
       const cash = parseFloat(cashAmount) || 0;
       const transfer = parseFloat(transferAmount) || 0;
       if (cash + transfer <= 0) {
         await Swal.fire({
           title: "Error",
           text: "se requiere una cantidad en efectivo o transferencia mayor a 0",
           icon: "error",
           confirmButtonColor: "#dc2626",
         });
         return;
       }
     }

     setLoading(true);

     // performedBy: email del usuario autenticado (libro de movimientos de la sucursal)
     const user = await getUser();

     const result = await registerSale({
       items: validItems.map(item => ({
         productId: parseInt(item.productId),
         price: parseFloat(item.price),
         quantity: parseInt(item.quantity),
       })),
       branchId: saleBranchId,
       customerId: selectedCustomerId ? parseInt(selectedCustomerId) : undefined,
       paymentMethod: paymentMethod,
       ...(user?.email ? { performedBy: user.email } : {}),
       ...(paymentMethod === "MIXTO"
         ? {
             cashAmount: parseFloat(cashAmount) || 0,
             transferAmount: parseFloat(transferAmount) || 0,
           }
         : { amountPaid: calcularPago().amountPaid }),
     });

     if (result.success) {
       const totalItems = validItems.reduce((sum, item) => sum + parseInt(item.quantity), 0);
       await Swal.fire({
         title: "Venta registrada",
         text: totalItems + " unidades vendidas por $" + calculateTotal().toFixed(2),
         icon: "success",
         confirmButtonColor: "#6d28d9",
         confirmButtonText: "Aceptar",
         background: "#ffffff",
         color: "#222222",
       });
        router.refresh();
        onSuccess?.();
        setIsOpen(false);
       setItems([{ id: "1", productId: "", name: "", code: "", price: "", quantity: "" }]);
       setCashAmount("");
       setTransferAmount("");
       setPaymentMethod("EFECTIVO");
     } else {
       await Swal.fire({
         title: "Error",
         text: result.error || "Error al registrar la venta",
         icon: "error",
         confirmButtonColor: "#dc2626",
         background: "#ffffff",
         color: "#222222",
       });
     }
     setLoading(false);
   };

  return (
    <>
       <button
         onClick={() => { setSaleBranchId(branchId ?? null); setPaso("sucursal"); setIsOpen(true); }}
         className="btn-fab fixed bottom-24 right-6 z-40"
         aria-label="Registrar venta"
       >
         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
         </svg>
       </button>

{isOpen && (
         <div className="fixed inset-0 bg-black/30 backdrop-blur-md z-[60] flex items-end justify-center md:items-center">
          <div
            className="bg-white w-full max-w-lg md:max-w-4xl rounded-t-3xl md:rounded-2xl p-6 animate-slide-up md:animate-scale-in max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-semibold text-[#222222]">Nueva Venta</h2>
               <button
                 type="button"
                 onClick={() => setIsOpen(false)}
                 className="btn btn-icon btn-round hover:bg-[#f2f2f2]"
                 aria-label="Cerrar"
               >
                 <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
             </div>
            {paso === "sucursal" ? (
              <div>
                <p className="text-[#6a6a6a] mb-2">Primero elegí la sucursal de la venta</p>
                <p className="text-sm text-[#6a6a6a] mb-4">Después cargás los productos y el pago.</p>

                <BranchPicker
                  branches={branches}
                  value={saleBranchId}
                  onChange={setSaleBranchId}
                  columns={2}
                  label="Sucursal de la venta"
                  emptyLabel="No hay sucursales activas para elegir."
                />

                {/* En celular la acción ocupa el ancho; desde `md` no se estira al ancho del panel. */}
                <div className="md:flex md:justify-end">
                  <button
                    type="button"
                    onClick={() => setPaso("productos")}
                    disabled={!saleBranchId}
                    className="btn btn-primary w-full mt-6 md:w-auto"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#6a6a6a] mb-4">No hay productos registrados</p>
                <p className="text-sm text-[#6a6a6a]">Primero creá un producto en la sección Inventario</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* La sucursal se eligió en el paso 1: acá va como etiqueta, no como selector. */}
                <p className="text-sm text-[#6a6a6a]">Sucursal: {sucursalNombre}</p>

                {/* Desde `md` el paso 2 abre en dos columnas: a la izquierda el
                    buscador y los productos agregados, a la derecha el pago, el
                    cliente y la acción. En celular se apila en el orden de siempre. */}
                <div className="md:grid md:grid-cols-2 md:gap-5 md:items-start">
                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <div key={item.id} className="rounded-2xl border border-black/10 bg-[#f7f7f7] p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium uppercase tracking-wide text-[#6a6a6a]">
                            Producto {index + 1}
                          </span>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="btn btn-danger"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => openProductSearch(item.id)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/30 outline-none transition-all bg-white text-left hover:bg-[#f8f8f8]"
                        >
                          {getProductDisplay(item)}
                        </button>

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
                                className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 focus:border-[#ec4899] outline-none transition-all text-sm tabular-nums text-right"
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
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-[#ec4899] outline-none transition-all text-sm tabular-nums text-right"
                              placeholder="0"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <span className="text-sm text-[#6a6a6a]">Subtotal</span>
                          <span className="font-medium text-[#222222] tabular-nums">
                            ${calculateSubtotal(item.price, item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}

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

                  <div className="mt-4 space-y-4 md:mt-0 md:sticky md:top-4">
                    {/* Payment Method Selector */}
                    <div className="rounded-2xl border border-black/10 bg-[#f7f7f7] p-4">
                      <label className="block text-xs font-medium uppercase tracking-wide text-[#6a6a6a] mb-3">
                        Método de Pago
                      </label>
                      {/* Control segmentado: el medio elegido va `btn-active`, el otro `btn-ghost` (blanco con borde, porque este control vive dentro de un panel gris). */}
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {MEDIOS_DE_PAGO.map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            aria-pressed={paymentMethod === method}
                            className={`btn whitespace-nowrap ${
                              paymentMethod === method ? "btn-active" : "btn-ghost"
                            }`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Customer Selection */}
                    <div className="rounded-2xl border border-black/10 bg-[#f7f7f7] p-4">
                      <label className="block text-xs font-medium uppercase tracking-wide text-[#6a6a6a] mb-2">
                        Cliente (opcional)
                      </label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/30 outline-none transition-all bg-white"
                      >
                        <option value="">Cliente Anónimo</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name} {customer.surname}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Amount Paid (for all payment methods) */}
                    {paymentMethod === "MIXTO" && (
                      <div className="rounded-2xl border border-black/10 bg-[#f7f7f7] p-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="cashAmount" className="block text-sm font-medium text-[#222222] mb-2">Efectivo</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6a] text-sm">$</span>
                              <input
                                id="cashAmount"
                                type="number"
                                step="0.01"
                                min="0"
                                value={cashAmount}
                                onChange={(e) => setCashAmount(e.target.value)}
                                className="w-full pl-7 pr-3 py-3 rounded-xl border border-gray-200 focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/30 outline-none transition-all tabular-nums text-right"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="transferAmount" className="block text-sm font-medium text-[#222222] mb-2">Transferencia</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6a] text-sm">$</span>
                              <input
                                id="transferAmount"
                                type="number"
                                step="0.01"
                                min="0"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                className="w-full pl-7 pr-3 py-3 rounded-xl border border-gray-200 focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/30 outline-none transition-all tabular-nums text-right"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Totals */}
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-green-800 font-medium">Total Venta</span>
                        <ValueChange
                          key={`total-${calculateTotal()}`}
                          className="text-green-700 font-bold tabular-nums"
                        >
                          ${calculateTotal().toFixed(2)}
                        </ValueChange>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-green-800">Monto Pagado</span>
                        <ValueChange
                          key={`pagado-${calcularPago().amountPaid}`}
                          className="text-green-600 tabular-nums"
                        >
                          -${calcularPago().amountPaid.toFixed(2)}
                        </ValueChange>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-green-200">
                        <span className="text-green-800 font-medium">Saldo Pendiente</span>
                        <ValueChange
                          key={`saldo-${calcularPago().pendingBalance}`}
                          className="text-green-700 text-xl font-bold tabular-nums"
                        >
                          ${calcularPago().pendingBalance.toFixed(2)}
                        </ValueChange>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn btn-primary w-full"
                    >
                      {loading ? "Registrando..." : "Registrar Venta"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

       <ProductSearch
         mode="modal"
         isOpen={isProductSearchOpen}
         onClose={() => setIsProductSearchOpen(false)}
         onSelect={handleProductSelect}
         placeholder="Buscar producto por código o nombre..."
         branchId={saleBranchId}
       />
    </>
  );
}