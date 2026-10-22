"use client";

interface PurchaseItem {
  id: number;
  productId: number;
  price: number;
  quantity: number;
  subtotal: number;
  product: {
    id: number;
    name: string;
    description: string | null;
    stock: number;
  };
}

interface Purchase {
  id: number;
  date: string;
  totalAmount: number;
  items: PurchaseItem[];
}

interface PurchaseCardProps {
  purchase: Purchase;
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
    <div className="bg-surface rounded-2xl shadow-[rgba(0,0,0,0.02)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_6px,rgba(0,0,0,0.1)_0px_4px_8px]">
      {/* Main Card */}
      <div 
        className="p-4 cursor-pointer" 
        onClick={onExpand}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-ink">{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</h3>
            <p className="text-sm text-ink-muted mt-1">
              {purchase.items.map(item => item.product.name).join(', ')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-lg font-bold text-red-800">
              - ${total.toFixed(2)}
            </span>
            <svg 
              className={`w-5 h-5 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-hairline-soft flex justify-between items-center">
          <p className="text-xs text-ink-muted">{formattedDate}</p>
          <span className="text-xs text-ink-muted">Toca para ver detalles</span>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-hairline-soft">
          <div className="mt-3 space-y-3">
            {purchase.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <div>
                  <p className="text-ink font-medium">{item.product.name}</p>
                  <p className="text-ink-muted text-xs">
                    {item.quantity} x ${item.price.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-ink font-medium">${item.subtotal.toFixed(2)}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    +{item.quantity}
                  </span>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-hairline flex justify-between items-center">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-bold text-red-800">-${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}