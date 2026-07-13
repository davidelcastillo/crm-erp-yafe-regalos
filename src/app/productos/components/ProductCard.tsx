import { Product } from "@prisma/client";
import { DeleteButton } from "./DeleteButton";

interface ProductCardProps {
  product: Product;
  onEdit?: (product: Product) => void;
}

const formatPrice = (price: unknown) => {
  // Handle Prisma Decimal, number, or string
  let num = 0;
  if (typeof price === "number") num = price;
  else if (typeof price === "string") num = parseFloat(price);
  else if (price && typeof price === "object" && "toNumber" in price) {
    num = (price as { toNumber: () => number }).toNumber();
  }
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export function ProductCard({ product, onEdit }: ProductCardProps) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-[rgba(0,0,0,0.02)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_6px,rgba(0,0,0,0.1)_0px_4px_8px]">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-[#222222]">{product.name}</h3>
            <code className="px-2 py-0.5 bg-[#f2f2f2] rounded text-xs font-mono text-[#6a6a6a]">
              {product.code}
            </code>
          </div>
          {product.description && product.description !== "-" && (
            <p className="text-sm text-[#6a6a6a] mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#f2f2f2] text-[#222222]">
            {product.stock} uds
          </span>
          <span className="text-sm font-semibold text-[#222222]">{formatPrice(product.price)}</span>
        </div>
      </div>
      
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        {onEdit && (
          <button
            onClick={() => onEdit(product)}
            className="flex-1 py-2 px-3 text-sm font-medium text-[#3f3f3f] bg-[#f2f2f2] rounded-lg hover:bg-[#e5e5e5] transition-colors"
          >
            Editar
          </button>
        )}
        <DeleteButton productId={product.id} />
      </div>
    </div>
  );
}