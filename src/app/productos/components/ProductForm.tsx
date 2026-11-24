// src/app/productos/components/ProductForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Product } from "@prisma/client";
import Swal from "sweetalert2";
import { CategoriasPicker } from "@/components/ui/CategoriasPicker";
import type { CategoryOption } from "@/components/ui/CategorySelector";
import { BranchPicker } from "@/components/ui/BranchPicker";
import { FotoUploader, subirFotos } from "@/components/ui/FotoUploader";
import { EstilosPicker } from "@/components/ui/EstilosPicker";
import { CANALES_PUBLICACION } from "@/lib/validations/prenda";
import type { TaxonomyOption } from "@/lib/validations/prendaTaxonomy";
import { getBranchOptions } from "@/app/actions/branch";
import { getCategoryOptions } from "@/app/actions/category";
import { getFotosProducto } from "@/app/actions/foto";
import { getEstiloPrendaOptions } from "@/app/actions/prendaTaxonomy";
import {
  createProduct,
  getProductById,
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
 *  - Adds a Category field (CategoriasPicker: varias por producto, con alta
 *    rápida de categoría).
 *  - Adds an Active/Inactive toggle (edit mode only) with a SweetAlert2
 *    confirmation before deactivating.
 *  - Uses `updateProductExtended` for the extended payload in edit mode
 *    (carrying `categorias` + active on top of the HU2 fields).
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
  /**
   * Categorías del producto: varias y todas equivalentes (pedido del dueño). En
   * la edición arranca en `null` hasta leer las guardadas, así guardar sin haber
   * cargado no las borra.
   */
  const [categorias, setCategorias] = useState<number[] | null>(isEdit ? null : []);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<CategoryOption[]>([]);
  const [isActive, setIsActive] = useState<boolean>(product?.active ?? true);

  /**
   * T3: el alta puede dejar el stock en una sucursal y, con costo, registrar la
   * compra del alta. Sin sucursal elegida el alta queda como antes.
   */
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [cantidadInicial, setCantidadInicial] = useState("");
  const [costo, setCosto] = useState("");

  /**
   * Wizard del alta: 1 = sucursal (o sin sucursal), 2 = ficha. La edición no
   * tiene pasos.
   */
  const [paso, setPaso] = useState(1);
  const enPasoSucursal = !isEdit && paso === 1;
  const sucursalElegida = branches.find((b) => b.id === branchId)?.name;

  /**
   * T3: «Publicar en» para productos normales (misma tabla que la prenda).
   * En la edición arranca en `null` hasta que llegan los canales guardados, así
   * guardar sin haber cargado no borra publicaciones.
   */
  const [publicadaEn, setPublicadaEn] = useState<string[] | null>(isEdit ? null : []);
  /**
   * Estilos del producto: la misma taxonomía que la prenda. En la edición
   * arranca en `null` hasta leer los guardados, así guardar sin cargar no los borra.
   */
  const [estilos, setEstilos] = useState<number[] | null>(isEdit ? null : []);
  const [estilosDisponibles, setEstilosDisponibles] = useState<TaxonomyOption[]>([]);
  /** T2: fotos elegidas en el alta; se suben recién con el producto creado (id). */
  const [fotosPendientes, setFotosPendientes] = useState<File[]>([]);

  /**
   * Variantes (opcionales, como los talles de la prenda): nombre libre +
   * cantidad y, si existe, la foto del producto a la que se asocian. En la
   * edición arranca en `null` hasta leer las guardadas, así guardar antes de
   * cargar no las borra.
   */
  const [tieneVariantes, setTieneVariantes] = useState(false);
  const [variantes, setVariantes] = useState<
    { key: number; nombre: string; cantidad: string; fotoPosition: string }[] | null
  >(isEdit ? null : []);
  /** Fotos ya guardadas del producto: alimentan el selector de foto de la variante. */
  const [fotos, setFotos] = useState<{ position: number }[]>([]);
  /** Clave estable de cada fila; el interruptor también cuenta como toque. */
  const siguienteKey = useRef(0);
  const variantesTocadas = useRef(false);
  const variantesFilas = variantes ?? [];
  const totalVariantes = variantesFilas.reduce(
    (total, fila) => total + (Number(fila.cantidad) || 0),
    0
  );

  /**
   * Con el modal abierto la página de atrás no scrollea: en el celular el gesto
   * se escapaba del modal y movía /inventario. Es DOM, no estado de React.
   */
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, []);

  const toggleCanal = (canal: string) =>
    setPublicadaEn((prev) =>
      (prev ?? []).includes(canal)
        ? (prev ?? []).filter((actual) => actual !== canal)
        : [...(prev ?? []), canal]
    );

  // Las categorías se piden una vez, en el alta y en la edición.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const resultado = await getCategoryOptions();
        if (!cancelado && resultado.success && resultado.data) {
          setCategoriasDisponibles(resultado.data as CategoryOption[]);
        }
      } catch (error) {
        console.error("Error loading category options:", error);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const toggleCategoria = (id: number) =>
    setCategorias((prev) =>
      (prev ?? []).includes(id)
        ? (prev ?? []).filter((actual) => actual !== id)
        : [...(prev ?? []), id]
    );

  const toggleEstilo = (id: number) =>
    setEstilos((prev) =>
      (prev ?? []).includes(id) ? (prev ?? []).filter((actual) => actual !== id) : [...(prev ?? []), id]
    );

  const nuevaFilaVariante = () => ({
    key: ++siguienteKey.current,
    nombre: "",
    cantidad: "",
    fotoPosition: "",
  });

  /** El interruptor arma la primera fila; al apagarse la lista queda vacía. */
  const toggleVariantes = (activar: boolean) => {
    variantesTocadas.current = true;
    setTieneVariantes(activar);
    setVariantes(activar ? (variantesFilas.length > 0 ? variantesFilas : [nuevaFilaVariante()]) : []);
  };

  const cambiarVariante = (
    key: number,
    campo: "nombre" | "cantidad" | "fotoPosition",
    valor: string
  ) =>
    setVariantes((prev) =>
      (prev ?? []).map((fila) => (fila.key === key ? { ...fila, [campo]: valor } : fila))
    );
  const agregarVariante = () => setVariantes((prev) => [...(prev ?? []), nuevaFilaVariante()]);
  const quitarVariante = (key: number) =>
    setVariantes((prev) => (prev ?? []).filter((fila) => fila.key !== key));

  // Los estilos activos se piden una vez, en el alta y en la edición.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const resultado = await getEstiloPrendaOptions();
        if (!cancelado && resultado.success) setEstilosDisponibles(resultado.data);
      } catch (error) {
        console.error("Error loading style options:", error);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // La edición lee los canales ya publicados antes de poder guardar.
  useEffect(() => {
    if (!product) return;
    let cancelado = false;
    (async () => {
      try {
        const resultado = await getProductById(product.id);
        if (cancelado || !resultado.success) return;
        const ficha = resultado.data as {
          publicadaEn?: string[];
          estilos?: number[];
          categorias?: number[];
          variantes?: { nombre: string; cantidad: number; fotoPosition: number | null }[];
        };
        setPublicadaEn(ficha.publicadaEn ?? []);
        setEstilos(ficha.estilos ?? []);
        setCategorias(ficha.categorias ?? []);
        // Si ya se tocó el interruptor, el usuario manda: no se pisa lo tipeado.
        if (variantesTocadas.current) return;
        const guardadas = ficha.variantes ?? [];
        setTieneVariantes(guardadas.length > 0);
        setVariantes(
          guardadas.map((variante) => ({
            key: ++siguienteKey.current,
            nombre: variante.nombre,
            cantidad: String(variante.cantidad),
            fotoPosition: variante.fotoPosition === null ? "" : String(variante.fotoPosition),
          }))
        );
      } catch (error) {
        console.error("Error loading product publications:", error);
        if (!cancelado) setPublicadaEn([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [product]);

  // Las fotos guardadas solo existen en la edición: son las opciones del
  // selector de foto de cada variante.
  useEffect(() => {
    if (!product) return;
    let cancelado = false;
    (async () => {
      try {
        const resultado = await getFotosProducto({ productId: product.id });
        if (!cancelado && resultado.success) {
          setFotos(resultado.data.map((foto) => ({ position: foto.position })));
        }
      } catch (error) {
        console.error("Error loading product photos:", error);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [product]);

  useEffect(() => {
    if (isEdit) return;
    let cancelado = false;
    (async () => {
      try {
        const resultado = await getBranchOptions();
        if (!cancelado && resultado.success && resultado.data) setBranches(resultado.data);
      } catch (error) {
        // Sin sucursales el alta sigue funcionando sin stock, como antes.
        console.error("Error loading branch options:", error);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [isEdit]);

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
        confirmButtonColor: "var(--palette-brand-action)",
        cancelButtonColor: "var(--palette-secondary-gray)",
        confirmButtonText: "Sí, desactivar",
        cancelButtonText: "Cancelar",
      });
      if (!confirmation.isConfirmed) return; // leave the toggle unchanged
    }
    setIsActive(nextValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    /**
     * Variantes para el payload: solo las filas con nombre. Apagado en el alta
     * la clave no viaja; apagado en la edición viaja vacío y borra las guardadas
     * (`null` = todavía no se leyeron: no se toca nada).
     */
    const variantesPayload = tieneVariantes
      ? variantesFilas
          .filter((fila) => fila.nombre.trim() !== "")
          .map((fila) => ({
            nombre: fila.nombre.trim(),
            cantidad: Number(fila.cantidad) || 0,
            ...(fila.fotoPosition !== "" ? { fotoPosition: Number(fila.fotoPosition) } : {}),
          }))
      : isEdit && variantes !== null
        ? []
        : null;
    const variantesDelPayload =
      variantesPayload !== null ? { variantes: variantesPayload } : {};

    const payload = isEdit
      ? {
          id: product!.id,
          name: formData.name,
          description: formData.description || null,
          price: formData.price,
          active: isActive,
          // Sin categorías cargadas todavía no se tocan las guardadas.
          ...(categorias !== null ? { categorias } : {}),
          // Sin canales cargados todavía no se toca lo publicado.
          ...(publicadaEn !== null ? { publicadaEn } : {}),
          // Sin estilos cargados todavía no se tocan los guardados.
          ...(estilos !== null ? { estilos } : {}),
          ...variantesDelPayload,
        }
      : {
          name: formData.name,
          description: formData.description,
          prefix: formData.prefix,
          price: formData.price,
          // Las categorías elegidas viajan en el alta (vacío = sin categoría).
          categorias: categorias ?? [],
          publicadaEn: publicadaEn ?? [],
          estilos: estilos ?? [],
          // La cantidad y el costo viajan siempre: con costo se registra la
          // compra del alta, haya o no sucursal. Sin sucursal no hay stock.
          ...(branchId !== null ? { branchId } : {}),
          // Con variantes el total sale de la suma, como los talles de prenda.
          cantidadInicial: tieneVariantes ? totalVariantes : Number(cantidadInicial) || 0,
          costoUnitario: Number(costo) || 0,
          ...variantesDelPayload,
        };

    const result = isEdit
      ? await updateProductExtended(payload)
      : await createProduct(payload);

    if (result.success) {
      const createdProduct = result.data as Product;

      // T2: las fotos del alta se suben con el producto ya creado. Una que
      // falle se avisa y no bloquea al resto ni la creación.
      const avisoFotos = isEdit ? null : await subirFotos(createdProduct.id, fotosPendientes);
      if (avisoFotos) {
        await Swal.fire({
          title: "Fotos sin subir",
          text: `${avisoFotos}. El producto sí se creó, podés reintentar desde la edición.`,
          icon: "warning",
          confirmButtonColor: "var(--palette-brand-action)",
          confirmButtonText: "Aceptar",
        });
      }

      await Swal.fire({
        title: isEdit ? "Producto actualizado" : "Producto creado",
        text: isEdit
          ? "El producto se ha actualizado correctamente"
          : "El producto se ha creado correctamente",
        icon: "success",
        confirmButtonColor: "var(--palette-brand-action)",
        confirmButtonText: "Aceptar",
        customClass: { confirmButton: "rounded-xl px-6 py-3 font-medium" },
      });

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
        confirmButtonColor: "var(--danger)",
        confirmButtonText: "Aceptar",
      });
    }
    setLoading(false);
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-hairline focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none transition-all";
  const labelClass = "block text-sm font-medium text-ink mb-2";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim-strong p-3 backdrop-blur-sm md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl bg-surface animate-slide-up md:max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera fija, fuera del scroll. */}
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-6">
          <div className="min-w-0">
            <h2 id="product-form-title" className="text-xl font-semibold text-ink">
              {isEdit ? "Editar Producto" : "Nuevo Producto"}
            </h2>
            {!isEdit && (
              <p className="mt-1 text-sm text-ink-muted">
                {enPasoSucursal
                  ? "Paso 1 de 2 · Elegí la sucursal"
                  : `Paso 2 de 2 · ${sucursalElegida ?? "Sin sucursal"}`}
              </p>
            )}
            {!isEdit && !enPasoSucursal && (
              <button
                type="button"
                onClick={() => setPaso(1)}
                className="mt-1 text-sm text-accent underline-offset-2 hover:underline"
              >
                Cambiar sucursal
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-icon btn-round text-ink-muted hover:bg-surface-strong"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* Área central: scrollea sola y retiene el gesto (overscroll-contain). */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 pb-4">
          {enPasoSucursal ? (
            <div className="space-y-3">
              <BranchPicker
                branches={branches}
                value={branchId}
                onChange={setBranchId}
                label="Sucursal"
                columns={2}
                emptyLabel="No hay sucursales activas: el producto se crea sin stock"
              />
              {/* La sucursal es opcional: sin ella el producto nace sin stock. */}
              <button
                type="button"
                aria-pressed={branchId === null}
                onClick={() => setBranchId(null)}
                className={`w-full min-h-[44px] rounded-2xl bg-surface px-4 py-3 text-left text-sm font-medium transition-all touch-manipulation ${
                  branchId === null
                    ? "border-2 border-accent ring-2 ring-accent/40 text-ink"
                    : "border border-hairline text-ink-muted"
                }`}
              >
                Sin sucursal (el producto se crea sin stock)
              </button>
            </div>
          ) : (
            <>
          {/* Pedido del dueño: las fotos van primero en la ficha. */}
          <div>
            <span className={labelClass}>Fotos</span>
            <FotoUploader
              productId={isEdit ? product!.id : null}
              onPendientesChange={setFotosPendientes}
            />
          </div>

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

          {/* Interruptor de variantes (opcional, como los talles de prenda). */}
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-soft p-4">
            <div className="min-w-0">
              <label htmlFor="product-tiene-variantes" className="text-sm font-medium text-ink">
                Este producto tiene variantes
              </label>
              <p className="text-xs text-ink-muted">
                Con variantes el total de unidades sale de la suma de las filas.
              </p>
            </div>
            <input
              id="product-tiene-variantes"
              type="checkbox"
              checked={tieneVariantes}
              onChange={(e) => toggleVariantes(e.target.checked)}
              className="h-5 w-5 accent-accent"
            />
          </div>

          {/* Filas «Nombre + cantidad» y, si la foto existe, a cuál se asocian. */}
          {tieneVariantes && (
            <div className="space-y-2">
              <span className={labelClass}>Variantes</span>
              {variantesFilas.map((fila, indice) => {
                const numero = indice + 1;
                return (
                  <div
                    key={fila.key}
                    className="space-y-2 rounded-xl border border-hairline bg-surface p-3"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={fila.nombre}
                        onChange={(e) => cambiarVariante(fila.key, "nombre", e.target.value)}
                        aria-label={`Variante ${numero}`}
                        maxLength={40}
                        placeholder="Ej: Roja"
                        className={inputClass}
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="0"
                        max="999"
                        value={fila.cantidad}
                        onChange={(e) => cambiarVariante(fila.key, "cantidad", e.target.value)}
                        aria-label={`Cantidad de la variante ${numero}`}
                        placeholder="0"
                        className={`${inputClass} w-24 text-center`}
                      />
                      {variantesFilas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => quitarVariante(fila.key)}
                          aria-label={`Quitar variante ${numero}`}
                          className="btn btn-icon text-ink-muted hover:bg-surface-strong"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor={`product-variante-${fila.key}-foto`}
                        className="mb-1 block text-xs text-ink-muted"
                      >
                        Foto de la variante {numero}
                      </label>
                      <select
                        id={`product-variante-${fila.key}-foto`}
                        value={fila.fotoPosition}
                        onChange={(e) => cambiarVariante(fila.key, "fotoPosition", e.target.value)}
                        disabled={!isEdit}
                        className={`${inputClass} bg-surface`}
                      >
                        <option value="">Sin foto</option>
                        {fotos.map((foto) => (
                          <option key={foto.position} value={String(foto.position)}>
                            Foto {foto.position + 1}
                          </option>
                        ))}
                      </select>
                      {!isEdit && (
                        <p className="mt-1 text-xs text-ink-muted">
                          Las fotos se asocian cuando el producto ya existe (edición).
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={agregarVariante}
                className="btn btn-ghost text-sm text-accent"
              >
                ＋ Agregar variante
              </button>
            </div>
          )}

          {/* Cantidad y costo: el total de unidades se deriva con variantes. */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              {tieneVariantes ? (
                <div>
                  <span className={labelClass}>Total de unidades</span>
                  <p
                    data-testid="product-cantidad-total"
                    className={`${inputClass} bg-surface-strong text-sm text-ink-muted`}
                  >
                    {totalVariantes} {totalVariantes === 1 ? "unidad" : "unidades"}
                  </p>
                </div>
              ) : (
                <div>
                  <label htmlFor="product-cantidad-inicial" className={labelClass}>
                    Cantidad inicial
                  </label>
                  <input
                    id="product-cantidad-inicial"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    max="999"
                    value={cantidadInicial}
                    onChange={(e) => setCantidadInicial(e.target.value)}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>
              )}
              <div>
                <label htmlFor="product-costo" className={labelClass}>
                  Costo
                </label>
                <input
                  id="product-costo"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <p className="col-span-2 text-xs text-ink-muted">
                {branchId === null
                  ? "Sin sucursal: no se carga stock; el costo igual queda registrado como compra."
                  : "Con costo y cantidad se registra la compra en Compras."}
              </p>
            </div>
          )}

          {/* Categorías: varias por producto, todas equivalentes. */}
          <CategoriasPicker
            id="product-categorias"
            options={categoriasDisponibles}
            onOptionsChange={setCategoriasDisponibles}
            selected={categorias ?? []}
            onToggle={toggleCategoria}
            onCreated={(id) =>
              setCategorias((prev) =>
                (prev ?? []).includes(id) ? (prev ?? []) : [...(prev ?? []), id]
              )
            }
            disabled={loading}
          />

          {/* Estilos: la misma taxonomía que la prenda, con su alta rápida. */}
          <EstilosPicker
            options={estilosDisponibles}
            onOptionsChange={setEstilosDisponibles}
            selected={estilos ?? []}
            onToggle={toggleEstilo}
            onCreated={(id) =>
              setEstilos((prev) => (prev ?? []).includes(id) ? (prev ?? []) : [...(prev ?? []), id])
            }
          />

          {/* T3: «Publicar en» — mismo patrón que la prenda. */}
          <div>
            <span className={labelClass}>Publicar en</span>
            <div className="flex flex-wrap gap-2">
              {CANALES_PUBLICACION.map((canal) => (
                <label
                  key={canal}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-hairline px-4 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    checked={(publicadaEn ?? []).includes(canal)}
                    onChange={() => toggleCanal(canal)}
                    className="h-5 w-5 accent-accent"
                  />
                  {canal}
                </label>
              ))}
            </div>
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

          </>
          )}
          </div>

          {/* Pie fijo, fuera del scroll: en el paso 1 se continúa; en el 2 se guarda. */}
          <div className="border-t border-hairline bg-surface px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 md:pb-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-4 min-h-[48px] rounded-xl border border-hairline text-ink font-medium hover:bg-surface-strong transition-colors touch-manipulation"
            >
              Cancelar
            </button>
            {enPasoSucursal ? (
              <button
                type="button"
                onClick={() => setPaso(2)}
                className="flex-1 py-4 min-h-[48px] bg-ink text-surface font-medium rounded-xl hover:bg-ink-body hover:text-surface transition-colors touch-manipulation"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-4 min-h-[48px] bg-ink text-surface font-medium rounded-xl hover:bg-ink-body hover:text-surface transition-colors disabled:opacity-50 touch-manipulation"
              >
                {loading
                  ? "Guardando…"
                  : isEdit
                    ? "Actualizar Producto"
                    : "Crear Producto"}
              </button>
            )}
          </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
