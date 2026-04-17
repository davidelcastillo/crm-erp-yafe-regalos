import { Product } from "@prisma/client";
import { DeleteButton } from "./DeleteButton";

interface ProductCardProps {
  product: Product;
  onEdit?: (product: Product) => void;
}

export function ProductCard({ product, onEdit }: ProductCardProps) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-[rgba(0,0,0,0.02)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_6px,rgba(0,0,0,0.1)_0px_4px_8px]">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-[#222222]">{product.name}</h3>
          {product.description && (
            <p className="text-sm text-[#6a6a6a] mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#f2f2f2] text-[#222222]">
            {product.stock} uds
          </span>
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