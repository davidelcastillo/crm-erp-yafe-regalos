"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { ValueChange } from "@/components/ui/ValueChange";

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
  branch?: { id: number; name: string } | null;
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
    <div className="glass rounded-2xl border border-black/5">
      <div className="p-4 cursor-pointer" onClick={onExpand}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-ink">{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</h3>
            <p className="text-sm text-ink-muted mt-1 break-words">
              {purchase.items.map(item => item.product.name).join(', ')}
            </p>
            {purchase.branch && (
              <span className="inline-block max-w-full truncate align-top mt-1 px-2 py-0.5 bg-[#3b82f6]/10 text-[#3b82f6] rounded text-xs font-medium">
                {purchase.branch.name}
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {/* El monto total entra animado cuando la card se vuelve a pintar (S9),
                y queda en un solo nodo de texto. */}
            <ValueChange key={total} className="text-lg font-bold text-red-800">
              {`- $${total.toFixed(2)}`}
            </ValueChange>
            <svg className={`w-5 h-5 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-hairline-soft flex items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">{formattedDate}</p>
          <span className="text-xs text-ink-muted shrink-0">Toca para ver detalles</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-hairline-soft">
          <div className="mt-3 space-y-3">
            {purchase.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-ink font-medium break-words">{item.product.name}</p>
                  <p className="text-ink-muted text-xs">{item.quantity} x ${item.price.toFixed(2)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-ink font-medium">${item.subtotal.toFixed(2)}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">+{item.quantity}</span>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
              <span className="font-semibold text-ink">Total</span>
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
      {/* Cada compra entra en cascada con su posición (S7); la raíz de la card
          no cambia. */}
      {purchases.map((purchase, index) => (
        <Reveal key={purchase.id} index={index}>
          <PurchaseCard
            purchase={purchase}
            expanded={expandedId === purchase.id}
            onExpand={() => setExpandedId(expandedId === purchase.id ? null : purchase.id)}
          />
        </Reveal>
      ))}
    </div>
  );
}