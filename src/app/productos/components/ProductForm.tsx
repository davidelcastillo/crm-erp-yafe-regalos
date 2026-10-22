// src/app/productos/components/ProductForm.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@prisma/client";
import Swal from "sweetalert2";
import { CategorySelector } from "@/components/ui/CategorySelector";
import {
  createProduct,
  updateProductExtended,
} from "@/app/actions/product";

interface ProductFormProps {
  product?: Product | null;
  onClose: () => void;
  onSuccess?: (product: Product) => void;
}

/**
 * ProductForm
 *
 * Reusable create/edit modal for Products (App Router Client Component).
 *
 * Fase 3:
 *  - Adds a Category field (CategorySelector with inline "+ Nueva categoría").
 *  - Adds an Active/Inactive toggle (edit mode only) with a SweetAlert2
 *    confirmation before deactivating.
 *  - Uses `updateProductExtended` for the extended payload in edit mode
 *    (carrying categoryId + active on top of the HU2 fields).
 *  - `code` and `codePrefix` are immutable in edit mode (read-only display).
 *  - There is NO `stock` field on Product anymore (stock lives in BranchInventory
 *    per branch). The HU2 create mode no longer asks for initial stock.
 *
 * Style tokens: Airbnb-inspired per STYLE.md (Rausch accent, ink text, 44px
 * tap targets, bottom-sheet modal `rounded-t-3xl` on mobile).
 */
export function ProductForm({ product, onClose, onSuccess }: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!product;
  const [categoryId, setCategoryId] = useState<number | null>(
    product?.categoryId ?? null
  );
  const [isActive, setIsActive] = useState<boolean>(product?.active ?? true);

  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    prefix: "",
    price: product?.price ? Number(product.price) : 0,
    code: product?.code || "",
    codePrefix: product?.codePrefix || "",
  });

  /**
   * Confirm before deactivating a product (only when the user actually flips
   * active=true → active=false in edit mode). Reactivating does not require
   * confirmation (no destructive intent).
   */
  const handleActiveToggle = async (nextValue: boolean) => {
    if (isEdit && !nextValue && isActive) {
      const confirmation = await Swal.fire({
        title: "¿Desactivar producto?",
        text:
          "El producto dejará de aparecer en los selectores de compras, ventas y movimientos, pero conservará su stock e historial.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#6d28d9",
        cancelButtonColor: "#6a6a6a",
        confirmButtonText: "Sí, desactivar",
        cancelButtonText: "Cancelar",
        background: "#ffffff",
        color: "#222222",
      });
      if (!confirmation.isConfirmed) return; // leave the toggle unchanged
    }
    setIsActive(nextValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = isEdit
      ? {
          id: product!.id,
          name: formData.name,
          description: formData.description || null,
          price: formData.price,
          categoryId: categoryId,
          active: isActive,
        }
      : {
          name: formData.name,
          description: formData.description,
          prefix: formData.prefix,
          price: formData.price,
          // Note: categoryId / active are NOT part of createProduct's schema in HU2.
          // They are persisted on the product only after creation, via the extended
          // update path. For simplicity the create flow leaves them at defaults
          // (categoryId=null, active=true) and the user can edit afterwards.
        };

    const result = isEdit
      ? await updateProductExtended(payload)
      : await createProduct(payload);

    if (result.success) {
      await Swal.fire({
        title: isEdit ? "Producto actualizado" : "Producto creado",
        text: isEdit
          ? "El producto se ha actualizado correctamente"
          : "El producto se ha creado correctamente",
        icon: "success",
        confirmButtonColor: "#6d28d9",
        confirmButtonText: "Aceptar",
        background: "#ffffff",
        color: "#222222",
        customClass: { confirmButton: "rounded-xl px-6 py-3 font-medium" },
      });

      const createdProduct = result.data as Product;

      if (onSuccess) {
        onSuccess(createdProduct);
      } else {
        router.refresh();
      }

      onClose();
    } else {
      await Swal.fire({
        title: "Error",
        text: result.error || "Error al guardar el producto",
        icon: "error",
        confirmButtonColor: "#dc2626",
        confirmButtonText: "Aceptar",
        background: "#ffffff",
        color: "#222222",
      });
    }
    setLoading(false);
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-hairline focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none transition-all";
  const labelClass = "block text-sm font-medium text-ink mb-2";

  return (
    <div className="fixed inset-0 bg-scrim-strong backdrop-blur-sm z-[60] flex items-end justify-center">
      <div
        className="bg-surface w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-ink">
            {isEdit ? "Editar Producto" : "Nuevo Producto"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-surface-strong transition-colors touch-manipulation"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="product-name" className={labelClass}>Nombre *</label>
            <input
              id="product-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClass}
              placeholder="Ej: Jabón de Avena y Arroz"
              required
            />
          </div>

          <div>
            <label htmlFor="product-description" className={labelClass}>Descripción</label>
            <textarea
              id="product-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={`${inputClass} resize-none`}
              placeholder="Ej: Jabón artesanal exfoliante"
              rows={3}
            />
          </div>

          {isEdit ? (
            <>
              <div>
                <label htmlFor="product-code" className={labelClass}>Código</label>
                <input
                  id="product-code"
                  type="text"
                  value={formData.code}
                  readOnly
                  className={`${inputClass} bg-surface-strong font-mono text-sm`}
                  title="El código no se puede modificar"
                />
              </div>
              <div>
                <label htmlFor="product-codePrefix" className={labelClass}>Prefijo</label>
                <input
                  id="product-codePrefix"
                  type="text"
                  value={formData.codePrefix}
                  readOnly
                  className={`${inputClass} bg-surface-strong font-mono text-sm`}
                  title="El prefijo no se puede modificar"
                />
              </div>
              <div>
                <label htmlFor="product-price" className={labelClass}>Precio de venta *</label>
                <input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                  }
                  className={inputClass}
                  placeholder="0.00"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="product-prefix" className={labelClass}>Prefijo (2-4 letras) *</label>
                <input
                  id="product-prefix"
                  type="text"
                  maxLength={4}
                  value={formData.prefix.toUpperCase()}
                  onChange={(e) =>
                    setFormData({ ...formData, prefix: e.target.value.toUpperCase() })
                  }
                  className={inputClass}
                  placeholder="Ej: AA, PROD, XYZ"
                  required
                  style={{ textTransform: "uppercase" }}
                />
                <p className="text-xs text-ink-muted mt-1">
                  2-4 letras. El sistema autogenera el código (ej: AA000, AA001…)
                </p>
              </div>
              <div>
                <label htmlFor="product-price" className={labelClass}>Precio de venta *</label>
                <input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                  }
                  className={inputClass}
                  placeholder="0.00"
                  required
                />
              </div>
            </>
          )}

          {/* Category Selector */}
          <div>
            <span className={labelClass}>Categoría</span>
            <CategorySelector
              selectedId={categoryId}
              onValueChange={setCategoryId}
              label=""
            />
          </div>

          {/* Active Toggle (edit mode only) */}
          {isEdit && (
            <div className="flex items-center justify-between p-4 bg-surface-soft rounded-xl">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-ink">Activo</span>
                <span className="text-xs text-ink-muted">
                  Los productos inactivos no aparecen en compras, ventas ni movimientos.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                aria-label="Activo"
                onClick={() => handleActiveToggle(!isActive)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors touch-manipulation min-w-[44px] min-h-[44px] ${
                  isActive ? "bg-accent" : "bg-hairline-strong"
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-surface transition-transform ${
                    isActive ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 min-h-[48px] bg-ink text-surface font-medium rounded-xl hover:bg-ink-body hover:text-surface transition-colors disabled:opacity-50 touch-manipulation"
            >
              {loading
                ? "Guardando…"
                : isEdit
                  ? "Actualizar Producto"
                  : "Crear Producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
