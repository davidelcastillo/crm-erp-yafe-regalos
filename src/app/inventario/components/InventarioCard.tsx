"use client";

import { useState } from "react";
import { Product } from "@prisma/client";
import { updateProduct, deleteProduct, toggleProductActive, updateProductExtended } from "@/app/actions/product";
import { urlFoto } from "@/components/ui/FotoUploader";
import { sumStock, type StockSource } from "@/lib/inventory-stock";
import { PrendaForm } from "./PrendaForm";
import { ProductForm } from "@/app/productos/components/ProductForm";
import Swal from "sweetalert2";

interface InventarioCardProps {
  product: Product;
  dataProductId?: string;
  isHighlighted?: boolean;
  onViewMovements?: (product: Product) => void;
  /** Category options hoisted from the page (shared by all cards, avoids N+1). */
  categories?: Array<{ id: number; name: string }>;
}

type SerializedProduct = Omit<Product, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

/** Fila de `BranchInventory` tal como la devuelve `getProductsWithBranchStock`. */
type BranchStockRow = { stock: number; branch?: { id: number; name: string } | null };
/** Portada (posición 0) y variantes que arma `getProductsWithBranchStock`. */
type ProductExtra = {
  images?: { path: string }[];
  variantes?: { nombre: string }[];
  /** Categorías del producto (N:N): la card las muestra todas. */
  categorias?: { category: { id: number; name: string } }[];
};

const MAX_SUCURSALES_VISIBLES = 3;

function getStockStatus(stock: number): {
  color: string;
  bgColor: string;
  label: string;
} {
  if (stock === 0) {
    return { color: "text-white", bgColor: "bg-negative-strong", label: "Sin stock" };
  }
  if (stock <= 5) {
    return { color: "text-white", bgColor: "bg-warning-strong", label: "Stock bajo" };
  }
  return { color: "text-white", bgColor: "bg-positive-strong", label: "En stock" };
}

export function InventarioCard({ product, dataProductId, isHighlighted, onViewMovements, categories = [] }: InventarioCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  // Un producto normal se edita con el mismo modal del alta: el editor inline
  // de la card quedó sin uso (ver `isEditing`), el dueño decide si se borra.
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  // Una prenda no se edita con el formulario de producto: tiene su ficha (U3).
  const [isEditingPrenda, setIsEditingPrenda] = useState(false);
  // Sum stock across all branch rows: correct for "Todas" and for a single branch.
  const displayStock = sumStock(product as unknown as StockSource);
  const [localName, setLocalName] = useState(product.name);
  const [localDescription, setLocalDescription] = useState(product.description || "");
  const [localPrice, setLocalPrice] = useState(product.price ? Number(product.price) : 0);
  const [localCategoryId, setLocalCategoryId] = useState<number | null>(product.categoryId ?? null);

  // Stock status for badge based on displayed stock (0 if no branch context)
  const status = getStockStatus(displayStock);

  const handleEdit = () => {
    if (product.kind === "PRENDA") {
      setIsEditingPrenda(true);
      return;
    }
    setIsEditingProduct(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLocalName(product.name);
    setLocalDescription(product.description || "");
    setLocalPrice(product.price ? Number(product.price) : 0);
    setLocalCategoryId(product.categoryId ?? null);
  };

   const handleSave = async () => {
     try {
       // 1. Update product fields (name, description, price, categoryId).
       //    El stock NO se toca acá: se cambia solo por movimientos auditables
       //    (Entrada/Salida, Mover Stock) o por compras y ventas (S20).
       const result = await updateProductExtended({
         id: product.id,
         name: localName,
         description: localDescription || null,
         price: localPrice,
         categoryId: localCategoryId,
         // active: product.active, // keep current active state (optional)
       });

       if (!result.success) {
         await Swal.fire({
           title: "Error",
           text: result.error || "No se pudo actualizar",
           icon: "error",
           confirmButtonColor: "#ef4444",
         });
         return;
       }

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
       title: '¿Desactivar producto?',
       text: "Esto lo marcará como inactivo pero conservará su stock e historial. ¿Continuar?",
       icon: 'warning',
       showCancelButton: true,
       confirmButtonText: 'Sí, desactivar',
       cancelButtonText: 'Cancelar',
       reverseButtons: true,
     });

     if (result.isConfirmed) {
       try {
         const res = await toggleProductActive({ id: product.id, active: false });
         if (res.success) {
           await Swal.fire({
             title: "¡Desactivado!",
             text: "Producto marcado como inactivo",
             icon: "success",
             confirmButtonColor: "#22c55e",
             timer: 1500,
             showConfirmButton: false,
           });
           window.location.reload();
         } else {
           await Swal.fire({
             title: "Error",
             text: res.error || "No se pudo desactivar",
             icon: "error",
             confirmButtonColor: "#ef4444",
           });
         }
       } catch (error) {
         console.error("Error deactivating product:", error);
         await Swal.fire({
           title: "Error",
           text: "Error al desactivar el producto",
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

  if (isEditingPrenda) {
    return (
      <PrendaForm
        prenda={product}
        onClose={() => setIsEditingPrenda(false)}
        onSuccess={() => window.location.reload()}
      />
    );
  }

  // Mismo refresh que la prenda: la card se vuelve a leer del servidor.
  if (isEditingProduct) {
    return (
      <ProductForm
        product={product}
        onClose={() => setIsEditingProduct(false)}
        onSuccess={() => window.location.reload()}
      />
    );
  }

   if (isEditing) {
     // Edit mode - show form
     return (
       <div className="bg-surface rounded-2xl p-4 shadow-sm border-2 border-info">
         <div className="flex flex-col gap-3">
           <div>
             <label className="block text-xs text-ink-muted mb-1">Nombre</label>
             <input
               type="text"
               value={localName}
               onChange={(e) => setLocalName(e.target.value)}
               className="w-full px-3 py-2 bg-surface-soft rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-info/20"
             />
           </div>

           <div>
             <label className="block text-xs text-ink-muted mb-1">Descripción</label>
             <textarea
               value={localDescription}
               onChange={(e) => setLocalDescription(e.target.value)}
               rows={2}
               className="w-full px-3 py-2 bg-surface-soft rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-info/20 resize-none"
             />
           </div>

           <div>
             <label className="block text-xs text-ink-muted mb-1">Categoría</label>
             <select
               value={localCategoryId ?? ''}
               onChange={(e) => {
                 const val = e.target.value;
                 setLocalCategoryId(val === '' ? null : Number(val));
               }}
               className="w-full px-3 py-2 bg-surface-soft rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-info/20"
             >
               <option value="">Sin categoría</option>
               {categories.map(cat => (
                 <option key={cat.id} value={cat.id}>
                   {cat.name}
                 </option>
               ))}
             </select>
           </div>

           <div>
             <label className="block text-xs text-ink-muted mb-1">Código</label>
             <input
               type="text"
               value={product.code || ""}
               readOnly
               className="w-full px-3 py-2 bg-surface-strong rounded-lg text-ink font-mono text-sm"
               title="El código no se puede modificar"
             />
           </div>

           <div>
             <label className="block text-xs text-ink-muted mb-1">Prefijo</label>
             <input
               type="text"
               value={product.codePrefix || ""}
               readOnly
               className="w-full px-3 py-2 bg-surface-strong rounded-lg text-ink font-mono text-sm text-uppercase"
               title="El prefijo no se puede modificar"
             />
           </div>

           <div>
             <label className="block text-xs text-ink-muted mb-1">Precio de venta</label>
             <input
               type="number"
               step="0.01"
               min="0"
               value={localPrice}
               onChange={(e) => setLocalPrice(parseFloat(e.target.value) || 0)}
               className="w-full px-3 py-2 bg-surface-soft rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-info/20"
             />
           </div>

           <div className="flex gap-2 pt-2">
             <button onClick={handleSave} className="btn btn-primary flex-1">
               Guardar
             </button>
             <button onClick={handleCancel} className="btn btn-secondary flex-1">
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

  // Sucursales donde el producto tiene stock > 0: una etiqueta por sucursal.
  const stockBranches = (
    (product as unknown as { inventory?: BranchStockRow[] }).inventory ?? []
  ).filter((row): row is BranchStockRow & { branch: { id: number; name: string } } =>
    row.stock > 0 && !!row.branch
  );
  const visibleBranches = stockBranches.slice(0, MAX_SUCURSALES_VISIBLES);
  const hiddenBranches = stockBranches.length - visibleBranches.length;
  const extra = product as unknown as ProductExtra;
  // Descripción real: vacía, solo espacios o «-» no muestran nada (reporte del dueño).
  const descripcion = product.description?.trim();
  // La primera foto por posición es la portada: la card la muestra en miniatura.
  const portada = extra.images?.[0]?.path ?? null;
  const variantes = extra.variantes ?? [];
  const categorias = extra.categorias ?? [];

// View mode - show product info
   return (
     <div className={`glass rounded-2xl border border-hairline-soft p-4 ${isHighlighted ? "ring-2 ring-info" : ""}`} data-product-id={dataProductId}>
       <div className="flex items-start justify-between gap-3">
         <div className="flex min-w-0 flex-1 items-start gap-3">
           {portada && (
             <img
               src={urlFoto(product.id, portada)}
               alt={product.name}
               className="h-20 w-16 shrink-0 rounded-lg border border-hairline-soft object-cover"
             />
           )}
         <div className="min-w-0 flex-1">
           {/* Dos líneas y el nombre completo en `title`: un nombre largo no aplasta la card. */}
           <h3
             title={product.name}
             className="line-clamp-2 break-words text-base font-semibold text-ink"
           >
             {product.name}
           </h3>
           {product.code && (
             <code className="mt-1 block max-w-full truncate rounded bg-surface-strong px-2 py-0.5 font-mono text-xs text-ink-muted">
               {product.code}
             </code>
           )}
           {descripcion && descripcion !== "-" && (
             <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
               {descripcion}
             </p>
           )}
           {categorias.length > 0 && (
             <ul aria-label="Categorías" className="mt-2 flex flex-wrap gap-1.5">
               {categorias.map((fila) => (
                 <li
                   key={fila.category.id}
                   className="rounded-full bg-surface-strong px-2.5 py-1 text-xs text-ink-muted"
                 >
                   {fila.category.name}
                 </li>
               ))}
             </ul>
           )}
           {variantes.length > 0 && (
             <ul aria-label="Variantes" className="mt-2 flex flex-wrap gap-1.5">
               {variantes.map((variante) => (
                 <li
                   key={variante.nombre}
                   className="rounded-full bg-surface-strong px-2.5 py-1 text-xs text-ink-muted"
                 >
                   {variante.nombre}
                 </li>
               ))}
             </ul>
           )}
         </div>
         </div>
         <div className="flex shrink-0 flex-col items-end gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.color} ${status.bgColor}`}
            >
              {displayStock} uds
            </span>
           <span className="text-xs text-ink-muted">{status.label}</span>
           <span className="text-sm font-semibold text-ink">{formatPrice(product.price)}</span>
         </div>
       </div>

       {/* Etiquetas de sucursal: en mobile envuelven y el nombre se recorta. */}
       {stockBranches.length > 0 && (
         <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Sucursales con stock">
           {visibleBranches.map((row) => (
             <li
               key={row.branch.id}
               aria-label={`Stock en ${row.branch.name}: ${row.stock} unidades`}
               className="inline-block max-w-full truncate rounded-full bg-surface-strong px-2.5 py-1 text-xs text-ink-muted"
             >
               {row.branch.name} · {row.stock}
             </li>
           ))}
           {hiddenBranches > 0 && (
             <li
               aria-label={`${hiddenBranches} sucursales más`}
               className="inline-block rounded-full bg-surface-strong px-2.5 py-1 text-xs text-ink-muted"
             >
               +{hiddenBranches}
             </li>
           )}
         </ul>
       )}

       {/* Los botones se envuelven: en un celular chico no entran los tres en una fila. */}
       <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline-soft pt-3">
         <button onClick={handleEdit} className="btn btn-secondary flex-1 whitespace-nowrap">
           Editar
         </button>
         <button onClick={handleViewMovements} className="btn btn-primary flex-1 whitespace-nowrap">
           Ver Movimientos
         </button>
          <button onClick={handleDelete} className="btn btn-danger flex-1 whitespace-nowrap">
            Desactivar
          </button>
       </div>
     </div>
   );
 }