"use client";

import { useState } from "react";
import { createProduct, updateProduct } from "../../actions/product";
import { useRouter } from "next/navigation";
import { Product } from "@prisma/client";
import Swal from "sweetalert2";

interface ProductFormProps {
  product?: Product | null;
  onClose: () => void;
}

export function ProductForm({ product, onClose }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    stock: product?.stock || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = product
      ? await updateProduct({ id: product.id, ...formData })
      : await createProduct(formData);

    if (result.success) {
      await Swal.fire({
        title: product ? "Producto actualizado" : "Producto creado",
        text: product 
          ? "El producto se ha actualizado correctamente" 
          : "El producto se ha creado correctamente",
        icon: "success",
        confirmButtonColor: "#ff385c",
        confirmButtonText: "Aceptar",
        background: "#ffffff",
        color: "#222222",
        customClass: {
          confirmButton: "rounded-xl px-6 py-3 font-medium",
        },
      });
      router.refresh();
      onClose();
    } else {
      await Swal.fire({
        title: "Error",
        text: result.error || "Error al guardar el producto",
        icon: "error",
        confirmButtonColor: "#ff385c",
        confirmButtonText: "Aceptar",
        background: "#ffffff",
        color: "#222222",
      });
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center">
      <div 
        className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[#222222]">
            {product ? "Editar Producto" : "Nuevo Producto"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#f2f2f2] transition-colors"
          >
            <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="product-name" className="block text-sm font-medium text-[#222222] mb-2">
              Nombre *
            </label>
            <input
              id="product-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all"
              placeholder="Ej: Jabón de Avena y Arroz"
              required
            />
          </div>

          <div>
            <label htmlFor="product-description" className="block text-sm font-medium text-[#222222] mb-2">
              Descripción
            </label>
            <textarea
              id="product-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all resize-none"
              placeholder="Ej: Jabón artesanal exfoliante"
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="product-stock" className="block text-sm font-medium text-[#222222] mb-2">
              Cantidad inicial
            </label>
            <input
              id="product-stock"
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all"
              placeholder="0"
              min="0"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#222222] text-white font-medium rounded-xl hover:bg-[#3f3f3f] transition-colors disabled:opacity-50"
          >
            {loading ? "Guardando..." : product ? "Actualizar Producto" : "Crear Producto"}
          </button>
        </form>
      </div>
    </div>
  );
}