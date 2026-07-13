"use client";

import { useState } from "react";
import { createProduct, updateProduct } from "../../actions/product";
import { useRouter } from "next/navigation";
import { Product } from "@prisma/client";
import Swal from "sweetalert2";

interface ProductFormProps {
  product?: Product | null;
  onClose: () => void;
  onSuccess?: (product: Product) => void;
}

export function ProductForm({ product, onClose, onSuccess }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!product;

  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    stock: product?.stock || 0,
    prefix: "",
    price: product?.price ? Number(product.price) : 0,
    code: product?.code || "",
    codePrefix: product?.codePrefix || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = isEdit
      ? { id: product!.id, name: formData.name, description: formData.description, stock: formData.stock, price: formData.price }
      : { name: formData.name, description: formData.description, stock: formData.stock, prefix: formData.prefix, price: formData.price };

    const result = isEdit
      ? await updateProduct(payload)
      : await createProduct(payload);

    if (result.success) {
      await Swal.fire({
        title: isEdit ? "Producto actualizado" : "Producto creado",
        text: isEdit ? "El producto se ha actualizado correctamente" : "El producto se ha creado correctamente",
        icon: "success",
        confirmButtonColor: "#ff385c",
        confirmButtonText: "Aceptar",
        background: "#ffffff",
        color: "#222222",
        customClass: { confirmButton: "rounded-xl px-6 py-3 font-medium" },
      });
      
      // Extract product from result.data
      const createdProduct = result.data as Product;
      
      if (onSuccess) {
        // Custom behavior: call onSuccess callback
        onSuccess(createdProduct);
      } else {
        // Default behavior: refresh router
        router.refresh();
      }
      
      // Always close the modal
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

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all";
  const labelClass = "block text-sm font-medium text-[#222222] mb-2";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center">
      <div 
        className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[#222222]">
            {isEdit ? "Editar Producto" : "Nuevo Producto"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[#f2f2f2] transition-colors touch-manipulation"
          >
            <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="product-name" className={labelClass}>Nombre *</label>
            <input id="product-name" type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} placeholder="Ej: Jabón de Avena y Arroz" required />
          </div>

          <div>
            <label htmlFor="product-description" className={labelClass}>Descripción</label>
            <textarea id="product-description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={inputClass + " resize-none"} placeholder="Ej: Jabón artesanal exfoliante" rows={3} />
          </div>

          <div>
            <label htmlFor="product-stock" className={labelClass}>Cantidad inicial</label>
            <input id="product-stock" type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })} className={inputClass} placeholder="0" min="0" />
          </div>

          {isEdit ? (
            <>
              <div>
                <label htmlFor="product-code" className={labelClass}>Código</label>
                <input id="product-code" type="text" value={formData.code} readOnly className={`${inputClass} bg-[#f2f2f2] font-mono text-sm`} title="El código no se puede modificar" />
              </div>
              <div>
                <label htmlFor="product-codePrefix" className={labelClass}>Prefijo</label>
                <input id="product-codePrefix" type="text" value={formData.codePrefix} readOnly className={`${inputClass} bg-[#f2f2f2] font-mono text-sm text-uppercase`} title="El prefijo no se puede modificar" />
              </div>
              <div>
                <label htmlFor="product-price" className={labelClass}>Precio de venta *</label>
                <input id="product-price" type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.00" required />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="product-prefix" className={labelClass}>Prefijo (2-4 letras) *</label>
                <input id="product-prefix" type="text" maxLength={4} value={formData.prefix.toUpperCase()} onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })} className={inputClass} placeholder="Ej: AA, PROD, XYZ" required style={{ textTransform: "uppercase" }} />
                <p className="text-xs text-[#6a6a6a] mt-1">2-4 letras. El sistema autogenera el código (ej: AA000, AA001...)</p>
              </div>
              <div>
                <label htmlFor="product-price" className={labelClass}>Precio de venta *</label>
                <input id="product-price" type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.00" required />
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="w-full py-4 bg-[#222222] text-white font-medium rounded-xl hover:bg-[#3f3f3f] transition-colors disabled:opacity-50">
            {loading ? "Guardando..." : isEdit ? "Actualizar Producto" : "Crear Producto"}
          </button>
        </form>
      </div>
    </div>
  );
}