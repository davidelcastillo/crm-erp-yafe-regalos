"use client";

import { useState } from "react";

interface PurchaseItem {
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

interface PurchaseWithItems {
  id: number;
  date: string;
  totalAmount: number;
  items: PurchaseItem[];
}

interface PurchaseCardProps {
  purchase: PurchaseWithItems;
  onExpand?: () => void;
  expanded?: boolean;
}

export function PurchaseCard({ purchase, onExpand, expanded }: PurchaseCardProps) {
  const formattedDate = new Date(purchase.date).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemCount = purchase.items.length;
  const total = purchase.totalAmount;

  return (
    <div className="bg-white rounded-2xl shadow-[rgba(0,0,0,0.02)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_6px,rgba(0,0,0,0.1)_0px_4px_8px]">
      <div className="p-4 cursor-pointer" onClick={onExpand}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[#222222]">{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</h3>
            <p className="text-sm text-[#6a6a6a] mt-1">
              {purchase.items.map(item => item.product.name).join(', ')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-lg font-bold text-red-800">- ${total.toFixed(2)}</span>
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
            {purchase.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <div>
                  <p className="text-[#222222] font-medium">{item.product.name}</p>
                  <p className="text-[#6a6a6a] text-xs">{item.quantity} x ${item.price.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#222222] font-medium">${item.subtotal.toFixed(2)}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">+{item.quantity}</span>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
              <span className="font-semibold text-[#222222]">Total</span>
              <span className="font-bold text-red-800">-${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PurchasesListProps {
  purchases: PurchaseWithItems[];
}

export function PurchasesList({ purchases }: PurchasesListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {purchases.map((purchase) => (
        <PurchaseCard
          key={purchase.id}
          purchase={purchase}
          expanded={expandedId === purchase.id}
          onExpand={() => setExpandedId(expandedId === purchase.id ? null : purchase.id)}
        />
      ))}
    </div>
  );
}