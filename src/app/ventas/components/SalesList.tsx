"use client";

import { useState } from "react";

interface SaleItem {
  id: number;
  productId: number;
  price: number;
  quantity: number;
  subtotal: number;
  product: {
    id: number;
    name: string;
  };
}

interface Sale {
  id: number;
  date: string;
  totalAmount: number;
  items: SaleItem[];
  paymentMethod?: "EFECTIVO" | "TRANSFERENCIA" | "MIXTO";
  branch?: { id: number; name: string } | null;
  /** Anterior al último cierre de caja de su sucursal (S17). */
  previousCash?: boolean;
}

interface SaleCardProps {
  sale: Sale;
  onExpand?: () => void;
  expanded?: boolean;
}

export function SaleCard({ sale, onExpand, expanded }: SaleCardProps) {
  const formattedDate = new Date(sale.date).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemCount = sale.items.length;
  const total = sale.totalAmount;

  const paymentMethodColors: Record<string, string> = {
    EFECTIVO: "bg-green-100 text-green-800",
    TRANSFERENCIA: "bg-blue-100 text-blue-800",
    MIXTO: "bg-purple-100 text-purple-800",
  };

  const paymentMethod = sale.paymentMethod ?? "EFECTIVO";
  const deCajaAnterior = sale.previousCash === true;

  return (
    <div
      className={`rounded-2xl shadow-[rgba(0,0,0,0.02)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_6px,rgba(0,0,0,0.1)_0px_4px_8px] ${
        deCajaAnterior ? "bg-[#f2f2f2]" : "glass"
      }`}
    >
      <div className="p-4 cursor-pointer" onClick={onExpand}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[#222222]">{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</h3>
            <p className="text-sm text-[#6a6a6a] mt-1 break-words">
              {sale.items.map(item => item.product.name).join(', ')}
            </p>
            {sale.branch && (
              <span className="inline-block max-w-full truncate align-top mt-1 px-2 py-0.5 bg-[#3b82f6]/10 text-[#3b82f6] rounded text-xs font-medium">
                {sale.branch.name}
              </span>
            )}
            {/* El estado no se comunica solo por color: la caja anterior lleva rótulo. */}
            {deCajaAnterior && (
              <span className="inline-block mt-1 ml-1 px-2 py-0.5 bg-[#222222]/10 text-[#6a6a6a] rounded text-xs font-medium">
                Caja anterior
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="text-lg font-bold text-green-700">+ ${total.toFixed(2)}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${paymentMethodColors[paymentMethod] || "bg-gray-100 text-gray-800"}`}>
              {paymentMethod}
            </span>
            <svg className={`w-5 h-5 text-[#6a6a6a] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-[#6a6a6a]">{formattedDate}</p>
          <span className="text-xs text-[#6a6a6a]">Toca para ver detalles</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3 space-y-3">
            {sale.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-[#222222] font-medium break-words">{item.product.name}</p>
                  <p className="text-[#6a6a6a] text-xs">{item.quantity} x ${item.price.toFixed(2)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[#222222] font-medium">${item.subtotal.toFixed(2)}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">-{item.quantity}</span>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
              <span className="font-semibold text-[#222222]">Total</span>
              <span className="font-bold text-green-700">+${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SalesListProps {
  sales: Sale[];
}

export function SalesList({ sales }: SalesListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {sales.map((sale) => (
        <SaleCard
          key={sale.id}
          sale={sale}
          expanded={expandedId === sale.id}
          onExpand={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
        />
      ))}
    </div>
  );
}