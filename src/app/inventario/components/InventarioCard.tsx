"use client";

import { useState } from "react";
import { Product } from "@prisma/client";
import { updateProduct, deleteProduct } from "@/app/actions/product";
import Swal from "sweetalert2";

interface InventarioCardProps {
  product: Product;
  dataProductId?: string;
  isHighlighted?: boolean;
  onViewMovements?: (product: Product) => void;
}

type SerializedProduct = Omit<Product, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function getStockStatus(stock: number): {
  color: string;
  bgColor: string;
  label: string;
} {
  if (stock === 0) {
    return { color: "text-white", bgColor: "bg-[#ef4444]", label: "Sin stock" };
  }
  if (stock <= 5) {
    return { color: "text-white", bgColor: "bg-[#f59e0b]", label: "Stock bajo" };
  }
  return { color: "text-white", bgColor: "bg-[#22c55e]", label: "En stock" };
}

export function InventarioCard({ product, dataProductId, isHighlighted, onViewMovements }: InventarioCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localStock, setLocalStock] = useState(product.stock);
  const [localName, setLocalName] = useState(product.name);
  const [localDescription, setLocalDescription] = useState(product.description || "");
  const [localPrice, setLocalPrice] = useState(product.price ? Number(product.price) : 0);

  // Stock status for badge
  const status = getStockStatus(product.stock);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLocalStock(product.stock);
    setLocalName(product.name);
    setLocalDescription(product.description || "");
  };

  const handleSave = async () => {
    try {
      const result = await updateProduct({
        id: product.id,
        name: localName,
        description: localDescription || null,
        stock: localStock,
        price: localPrice,
      });

      if (result.success) {
        await Swal.fire({
          title: "¡Listo!",
          text: "Producto actualizado",
          icon: "success",
          confirmButtonColor: "#22c55e",
          timer: 1500,
          showConfirmButton: false,
        });
        setIsEditing(false);
        // Refresh the page to get updated data
        window.location.reload();
      } else {
        await Swal.fire({
          title: "Error",
          text: result.error || "No se pudo actualizar",
          icon: "error",
          confirmButtonColor: "#ef4444",
        });
      }
    } catch (error) {
      console.error("Error updating product:", error);
      await Swal.fire({
        title: "Error",
        text: "Error al actualizar el producto",
        icon: "error",
        confirmButtonColor: "#ef4444",
      });
    }
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: "¿Eliminar producto?",
      text: `"${product.name}" será eliminado del inventario. Esta acción no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
    });

    if (result.isConfirmed) {
      try {
        const res = await deleteProduct({ id: product.id });
        if (res.success) {
          await Swal.fire({
            title: "¡Eliminado!",
            text: "Producto eliminado del inventario",
            icon: "success",
            confirmButtonColor: "#22c55e",
            timer: 1500,
            showConfirmButton: false,
          });
          window.location.reload();
        } else {
          await Swal.fire({
            title: "Error",
            text: res.error || "No se pudo eliminar",
            icon: "error",
            confirmButtonColor: "#ef4444",
          });
        }
      } catch (error) {
        console.error("Error deleting product:", error);
        await Swal.fire({
          title: "Error",
          text: "Error al eliminar el producto",
          icon: "error",
          confirmButtonColor: "#ef4444",
        });
      }
    }
  };

  const handleViewMovements = () => {
    if (onViewMovements) {
      onViewMovements(product);
    }
  };

  if (isEditing) {
    // Edit mode - show form
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-[#3b82f6]">
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-[#6a6a6a] mb-1">Nombre</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              className="w-full px-3 py-2 bg-[#f8f8f8] rounded-lg text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20"
            />
          </div>

          <div>
            <label className="block text-xs text-[#6a6a6a] mb-1">Descripción</label>
            <textarea
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-[#f8f8f8] rounded-lg text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[#6a6a6a] mb-1">Stock</label>
            <input
              type="number"
              value={localStock}
              onChange={(e) => setLocalStock(parseInt(e.target.value) || 0)}
              min={0}
              className="w-full px-3 py-2 bg-[#f8f8f8] rounded-lg text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20"
            />
          </div>

          <div>
            <label className="block text-xs text-[#6a6a6a] mb-1">Código</label>
            <input
              type="text"
              value={product.code || ""}
              readOnly
              className="w-full px-3 py-2 bg-[#f2f2f2] rounded-lg text-[#222222] font-mono text-sm"
              title="El código no se puede modificar"
            />
          </div>

          <div>
            <label className="block text-xs text-[#6a6a6a] mb-1">Prefijo</label>
            <input
              type="text"
              value={product.codePrefix || ""}
              readOnly
              className="w-full px-3 py-2 bg-[#f2f2f2] rounded-lg text-[#222222] font-mono text-sm text-uppercase"
              title="El prefijo no se puede modificar"
            />
          </div>

          <div>
            <label className="block text-xs text-[#6a6a6a] mb-1">Precio de venta</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={localPrice}
              onChange={(e) => setLocalPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-[#f8f8f8] rounded-lg text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 py-2 px-3 text-sm font-medium text-white bg-[#22c55e] rounded-lg hover:bg-[#16a34a] transition-colors"
            >
              Guardar
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-2 px-3 text-sm font-medium text-[#222222] bg-[#f2f2f2] rounded-lg hover:bg-[#e5e5e5] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const formatPrice = (price: unknown) => {
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

// View mode - show product info
   return (
     <div className={`bg-white rounded-2xl p-4 shadow-sm ${isHighlighted ? "ring-2 ring-[#3b82f6]" : ""}`} data-product-id={dataProductId}>
       <div className="flex justify-between items-start">
         <div className="flex-1">
           <div className="flex items-center gap-2 mb-1">
             <h3 className="text-base font-semibold text-[#222222]">{product.name}</h3>
             <code className="px-2 py-0.5 bg-[#f2f2f2] rounded text-xs font-mono text-[#6a6a6a]">
               {product.code}
             </code>
           </div>
           {product.description && product.description !== "-" && (
             <p className="text-sm text-[#6a6a6a] mt-1 line-clamp-2">
               {product.description}
             </p>
           )}
         </div>
         <div className="flex flex-col items-end gap-2">
           <span
             className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.color} ${status.bgColor}`}
           >
             {product.stock} uds
           </span>
           <span className="text-xs text-[#6a6a6a]">{status.label}</span>
           <span className="text-sm font-semibold text-[#222222]">{formatPrice(product.price)}</span>
         </div>
       </div>

       <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
         <button
           onClick={handleEdit}
           className="flex-1 py-2 px-3 text-sm font-medium text-[#3f3f3f] bg-[#f2f2f2] rounded-lg hover:bg-[#e5e5e5] transition-colors"
         >
           Editar
         </button>
         <button
           onClick={handleViewMovements}
           className="flex-1 py-2 px-3 text-sm font-medium text-white bg-[#8b5cf6] rounded-lg hover:#[7c3aed] transition-colors"
         >
           Ver Movimientos
         </button>
         <button
           onClick={handleDelete}
           className="flex-1 py-2 px-3 text-sm font-medium text-white bg-[#ef4444] rounded-lg hover:bg-[#dc2626] transition-colors"
         >
           Eliminar
         </button>
       </div>
     </div>
   );
 }