// src/app/productos/components/BulkProductForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Swal from "sweetalert2";
import { getCategoryOptions } from "@/app/actions/category";
import { createProductsBatch } from "@/app/actions/product";
import { createProductsBatchSchema } from "@/lib/validations/product";
import { CategorySelector } from "@/components/ui/CategorySelector";
import { BranchPicker } from "@/components/ui/BranchPicker";
import { StockMovementReceiptPanel } from "@/app/inventario/components/StockMovementReceiptPanel";
import type { StockMovementReceipt } from "@/lib/stock-movement-receipt";

/** Tope de filas por envío (S6). */
const MAX_FILAS = 50;

type Fila = {
  id: string;
  name: string;
  prefix: string;
  price: string;
  categoryId: number | null;
  /** Stock inicial en la sucursal del lote; vacío es 0 (T5). */
  initialStock: string;
};
/** `row` es un mensaje que no pertenece a un campo puntual: se muestra en la card. */
type Campo = "name" | "prefix" | "price" | "categoryId" | "initialStock" | "row";
type FilaError = { field: Campo; message: string };

export interface BulkProductFormProps {
  onClose: () => void;
  onSuccess?: () => void;
  /** Sucursales activas para el stock inicial (D8). */
  branches: Array<{ id: number; name: string }>;
}

/** Agrupa los errores del servidor o del esquema por id de fila (el `row` viene 0-based). */
function erroresPorFila(
  items: { row: number; field?: string; message: string }[],
  filas: Fila[]
): Record<string, FilaError[]> {
  const mapa: Record<string, FilaError[]> = {};
  for (const item of items) {
    const fila = filas[item.row];
    if (!fila) continue;
    const field: Campo =
      item.field === "name" ||
      item.field === "prefix" ||
      item.field === "price" ||
      item.field === "categoryId" ||
      item.field === "initialStock"
        ? item.field
        : "row";
    (mapa[fila.id] ??= []).push({ field, message: item.message });
  }
  return mapa;
}

/**
 * BulkProductForm
 *
 * Alta masiva de productos (S1): muchas filas en un mismo modal y un solo
 * envío «todo o nada» (S7). Por fila: nombre, prefijo, precio, categoría (S4)
 * y, si se elige una sucursal, stock inicial (T5).
 *
 * La sucursal es global para todo el lote (D8) y opcional: sin sucursal el
 * modal crea solo productos, como antes. Con sucursal, la acción deja el stock
 * y, para las filas con stock mayor a 0, el movimiento de ingreso con su
 * comprobante (S2/S11).
 *
 * La lista de categorías se pide UNA vez para todo el modal y cada fila recibe
 * esa lista ya cargada (`CategorySelector` con `options` inyectadas, T10), así
 * que el atajo «+ Nueva categoría» vuelve por fila sin sumar viajes: la
 * categoría creada se agrega a la lista única del modal.
 *
 * Patrón: bottom-sheet montado en un portal al `body`, como `ProductForm`
 * (STYLE.md), con el cuerpo con scroll y el pie fijo. Enter nunca envía: pasa
 * al campo siguiente y en el último campo de la última fila agrega una fila.
 */
export function BulkProductForm({ onClose, onSuccess, branches }: BulkProductFormProps) {
  const [filas, setFilas] = useState<Fila[]>([
    { id: "1", name: "", prefix: "", price: "", categoryId: null, initialStock: "" },
  ]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<StockMovementReceipt | null>(null);
  const [categorias, setCategorias] = useState<{ id: number; name: string }[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
  const [errorCategorias, setErrorCategorias] = useState(false);
  const [errores, setErrores] = useState<Record<string, FilaError[]>>({});

  // Sin sucursal no existen los campos de stock: limpiar sus errores evita que
  // el resumen intente enfocar un campo que ya no está en pantalla.
  useEffect(() => {
    if (branchId !== null) return;
    setErrores((prev) => {
      const limpio = Object.entries(prev)
        .map(([id, lista]) => [id, lista.filter((e) => e.field !== "initialStock")] as const)
        .filter(([, lista]) => lista.length > 0);
      return Object.fromEntries(limpio);
    });
  }, [branchId]);
  const [loading, setLoading] = useState(false);

  const nextId = useRef(1);
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const resumenRef = useRef<HTMLDivElement>(null);
  const idParaEnfocar = useRef<string | null>(null);
  const enfocarResumen = useRef(false);

  // Lista de categorías: un solo viaje para todo el modal, compartido por las filas.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const resultado = await getCategoryOptions();
        if (cancelado) return;
        if (resultado.success && resultado.data) setCategorias(resultado.data);
        else setErrorCategorias(true);
      } catch (error) {
        console.error("Error loading category options:", error);
        if (!cancelado) setErrorCategorias(true);
      } finally {
        if (!cancelado) setCargandoCategorias(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // Foco diferido: la fila nueva (o el resumen) todavía no existe cuando se pide.
  useEffect(() => {
    const id = idParaEnfocar.current;
    if (!id) return;
    idParaEnfocar.current = null;
    const input = document.getElementById(`bulk-row-${id}-name`);
    input?.focus();
    input?.scrollIntoView?.({ block: "nearest" });
  }, [filas]);

  useEffect(() => {
    if (!enfocarResumen.current) return;
    enfocarResumen.current = false;
    resumenRef.current?.focus();
  }, [errores]);

  const agregarFila = () => {
    if (filas.length >= MAX_FILAS) return;
    nextId.current += 1;
    const nueva: Fila = {
      id: String(nextId.current),
      name: "",
      prefix: filas[filas.length - 1]?.prefix ?? "", // una fila nueva copia el prefijo anterior
      price: "",
      categoryId: null,
      initialStock: "",
    };
    idParaEnfocar.current = nueva.id;
    setFilas((prev) => [...prev, nueva]);
  };

  const quitarFila = async (fila: Fila) => {
    if (filas.length <= 1) return; // la última fila no se puede quitar

    const conDatos =
      fila.name.trim() || fila.prefix.trim() || fila.price.trim() || fila.initialStock.trim();
    if (conDatos) {
      const confirmacion = await Swal.fire({
        title: "¿Quitar esta fila?",
        text: "Se pierden los datos cargados en la fila.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#6d28d9",
        cancelButtonColor: "#6a6a6a",
        confirmButtonText: "Sí, quitar",
        cancelButtonText: "Cancelar",
      });
      if (!confirmacion.isConfirmed) return;
    }

    setFilas((prev) => prev.filter((f) => f.id !== fila.id));
    setErrores((prev) => {
      const copia = { ...prev };
      delete copia[fila.id];
      return copia;
    });
  };

  const actualizarFila = <K extends keyof Omit<Fila, "id">>(id: string, campo: K, valor: Fila[K]) =>
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));

  /** Enter pasa al campo siguiente; en el último campo de la última fila agrega una fila. */
  const alPresionarEnter = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    const inputs = Array.from(
      cuerpoRef.current?.querySelectorAll<HTMLInputElement>("[data-bulk-field]") ?? []
    );
    const siguiente = inputs[inputs.indexOf(evento.currentTarget) + 1];
    if (siguiente) {
      siguiente.focus();
      siguiente.scrollIntoView?.({ block: "nearest" });
      return;
    }
    agregarFila();
  };

  const cerrar = async () => {
    const conDatos = filas.some(
      (f) => f.name.trim() || f.prefix.trim() || f.price.trim() || f.initialStock.trim()
    );
    if (!conDatos) {
      onClose();
      return;
    }
    const confirmacion = await Swal.fire({
      title: "¿Descartar los productos?",
      text: "Se pierden las filas cargadas.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#6d28d9",
      cancelButtonColor: "#6a6a6a",
      confirmButtonText: "Sí, descartar",
      cancelButtonText: "Cancelar",
    });
    if (confirmacion.isConfirmed) onClose();
  };

  const filasConError = filas.filter((f) => (errores[f.id]?.length ?? 0) > 0);

  const irAPrimeraConError = () => {
    const fila = filasConError[0];
    if (!fila) return;
    const campo = errores[fila.id]?.[0]?.field;
    const id = campo && campo !== "row" ? campo : "name";
    document.getElementById(`bulk-row-${fila.id}-${id}`)?.focus();
  };

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (loading) return;

    // Validación de cliente con el mismo esquema: el servidor sigue siendo la autoridad.
    // Sin sucursal el payload va como antes: sin `branchId` ni stock por fila.
    const parsed = createProductsBatchSchema.safeParse({
      ...(branchId !== null ? { branchId } : {}),
      rows: filas.map((f) => ({
        name: f.name,
        prefix: f.prefix,
        price: Number(f.price),
        categoryId: f.categoryId,
        // Vacío es 0: el producto igual queda en la vista por sucursal (S11).
        ...(branchId !== null
          ? { initialStock: f.initialStock.trim() === "" ? 0 : Number(f.initialStock) }
          : {}),
      })),
    });
    if (!parsed.success) {
      const items = parsed.error.issues.flatMap((issue) => {
        const [raiz, row, campo] = issue.path;
        return raiz === "rows" && typeof row === "number"
          ? [{ row, field: typeof campo === "string" ? campo : undefined, message: issue.message }]
          : [];
      });
      if (items.length === 0) {
        await Swal.fire({
          title: "Error",
          text: parsed.error.issues.map((e) => e.message).join(", "),
          icon: "error",
          confirmButtonColor: "#dc2626",
          confirmButtonText: "Aceptar",
        });
        return;
      }
      setErrores(erroresPorFila(items, filas));
      enfocarResumen.current = true;
      return;
    }

    setLoading(true);
    setErrores({});
    const resultado = await createProductsBatch(parsed.data);
    setLoading(false);

    if (resultado.success) {
      // Con comprobante primero se descarga (y si quiere, las etiquetas): el
      // modal se cierra recién cuando se cierra el panel, una sola vez.
      if (resultado.data.receipt) {
        setReceipt(resultado.data.receipt);
        return;
      }
      const cantidad = resultado.data.products.length;
      await Swal.fire({
        title: "Productos creados",
        text: `${cantidad} ${cantidad === 1 ? "producto creado" : "productos creados"} correctamente`,
        icon: "success",
        confirmButtonColor: "#6d28d9",
        confirmButtonText: "Aceptar",
      });
      onSuccess?.();
      onClose();
      return;
    }

    const rowErrors = "rowErrors" in resultado ? resultado.rowErrors : undefined;
    if (rowErrors && rowErrors.length > 0) {
      setErrores(erroresPorFila(rowErrors, filas));
      enfocarResumen.current = true;
      return;
    }

    await Swal.fire({
      title: "Error",
      text: resultado.error || "Error al crear los productos",
      icon: "error",
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Aceptar",
    });
  };

  if (typeof document === "undefined") return null;

  if (receipt) {
    return (
      <StockMovementReceiptPanel
        receipt={receipt}
        onClose={() => {
          onSuccess?.();
          onClose();
        }}
      />
    );
  }

  const inputClass =
    "w-full px-3 py-3 min-h-[44px] scroll-mb-32 rounded-xl border border-hairline bg-surface text-ink focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none transition-all";
  const labelClass = "block text-sm font-medium text-ink mb-1";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-scrim-strong backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-product-title"
        className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl bg-surface animate-slide-up md:max-w-3xl"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-6">
          <div className="min-w-0">
            <h2 id="bulk-product-title" className="text-xl font-semibold text-ink">
              Varios productos
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Hasta {MAX_FILAS} por carga. Se crean todos o ninguno.
            </p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="btn btn-icon btn-round text-ink-muted hover:bg-surface-strong"
            aria-label="Cerrar"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={enviar}
          className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-2 md:items-start md:gap-x-6 md:gap-y-4 md:overflow-y-auto md:px-6 md:pb-4"
        >
          {/* Columna izquierda desde md: el resumen y las filas. En celular va primero. */}
          <div
            ref={cuerpoRef}
            className="order-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4 md:order-none md:col-start-1 md:row-start-1 md:overflow-visible md:px-0 md:pb-0"
          >
            {/* Sucursal global del lote (D8) y opcional: sin ella no hay stock. */}
            <section className="rounded-2xl border border-hairline bg-surface-soft p-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Stock inicial · todo el lote
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                {branchId === null
                  ? "Sin sucursal: los productos se crean sin stock y no se genera comprobante."
                  : "Cada producto deja su stock en esta sucursal. Con stock mayor a 0 se genera el movimiento de ingreso y su comprobante."}
              </p>
              <div className="mt-3">
                <BranchPicker
                  branches={branches}
                  value={branchId}
                  onChange={setBranchId}
                  label="Sucursal del stock inicial"
                  emptyLabel="No hay sucursales activas: los productos se crean sin stock"
                />
              </div>
              {branchId !== null && (
                <button
                  type="button"
                  onClick={() => setBranchId(null)}
                  className="btn btn-ghost mt-2"
                >
                  No cargar stock
                </button>
              )}
            </section>

            {errorCategorias && (
              <p role="status" className="rounded-xl border border-hairline bg-surface-soft p-3 text-sm text-ink-muted">
                No se pudieron cargar las categorías. Los productos se van a guardar sin
                categoría; podés asignarla después desde el inventario.
              </p>
            )}

            {filasConError.length > 0 && (
              <div
                ref={resumenRef}
                role="alert"
                tabIndex={-1}
                className="rounded-2xl border border-error bg-error-surface p-4 text-error-ink"
              >
                <p className="text-sm font-medium">
                  {filasConError.length === 1
                    ? "1 fila con errores"
                    : `${filasConError.length} filas con errores`}
                </p>
                <button type="button" onClick={irAPrimeraConError} className="btn btn-ghost mt-2">
                  Ir a la primera
                </button>
              </div>
            )}

            {filas.map((fila, index) => {
              const erroresFila = errores[fila.id] ?? [];
              const mensajeDe = (campo: Campo) =>
                erroresFila.find((e) => e.field === campo)?.message;
              const base = `bulk-row-${fila.id}`;
              const errorCard = mensajeDe("row");
              /** aria-describedby: el mensaje del campo más el de la card, si existen. */
              const descritoPor = (campo: Campo) =>
                [mensajeDe(campo) ? `${base}-${campo}-error` : null, errorCard ? `${base}-row-error` : null]
                  .filter(Boolean)
                  .join(" ") || undefined;

              return (
                <div
                  key={fila.id}
                  className={`rounded-2xl border p-4 space-y-3 ${
                    erroresFila.length > 0
                      ? "border-error bg-error-surface"
                      : "border-hairline bg-surface-soft"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Producto {index + 1}
                    </span>
                    {filas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => quitarFila(fila)}
                        disabled={loading}
                        className="btn btn-icon text-ink-muted hover:bg-surface-strong"
                        aria-label={`Quitar producto ${index + 1}`}
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {errorCard && (
                    <p id={`${base}-row-error`} className="text-sm text-error-ink">
                      {errorCard}
                    </p>
                  )}

                  <div>
                    <label htmlFor={`${base}-name`} className={labelClass}>
                      Nombre *
                    </label>
                    <input
                      id={`${base}-name`}
                      data-bulk-field="name"
                      type="text"
                      value={fila.name}
                      onChange={(e) => actualizarFila(fila.id, "name", e.target.value)}
                      onKeyDown={alPresionarEnter}
                      enterKeyHint="next"
                      placeholder="Ej: Jabón de Avena y Arroz"
                      required
                      aria-invalid={mensajeDe("name") ? "true" : undefined}
                      aria-describedby={descritoPor("name")}
                      className={inputClass}
                    />
                    {mensajeDe("name") && (
                      <p id={`${base}-name-error`} className="mt-1 text-sm text-error-ink">
                        {mensajeDe("name")}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`${base}-prefix`} className={labelClass}>
                      Prefijo (2-4 letras) *
                    </label>
                    <input
                      id={`${base}-prefix`}
                      data-bulk-field="prefix"
                      type="text"
                      maxLength={4}
                      autoCapitalize="characters"
                      value={fila.prefix}
                      onChange={(e) => actualizarFila(fila.id, "prefix", e.target.value.toUpperCase())}
                      onKeyDown={alPresionarEnter}
                      enterKeyHint="next"
                      placeholder="Ej: AA"
                      required
                      aria-invalid={mensajeDe("prefix") ? "true" : undefined}
                      aria-describedby={descritoPor("prefix")}
                      className={`${inputClass} uppercase`}
                    />
                    {mensajeDe("prefix") && (
                      <p id={`${base}-prefix-error`} className="mt-1 text-sm text-error-ink">
                        {mensajeDe("prefix")}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`${base}-price`} className={labelClass}>
                      Precio de venta *
                    </label>
                    <input
                      id={`${base}-price`}
                      data-bulk-field="price"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={fila.price}
                      onChange={(e) => actualizarFila(fila.id, "price", e.target.value)}
                      onKeyDown={alPresionarEnter}
                      enterKeyHint={branchId !== null ? "next" : "done"}
                      placeholder="0.00"
                      required
                      aria-invalid={mensajeDe("price") ? "true" : undefined}
                      aria-describedby={descritoPor("price")}
                      className={inputClass}
                    />
                    {mensajeDe("price") && (
                      <p id={`${base}-price-error`} className="mt-1 text-sm text-error-ink">
                        {mensajeDe("price")}
                      </p>
                    )}
                  </div>

                  {/* Stock inicial: solo tiene sentido con una sucursal elegida (D8). */}
                  {branchId !== null && (
                    <div>
                      <label htmlFor={`${base}-initialStock`} className={labelClass}>
                        Stock inicial
                      </label>
                      <input
                        id={`${base}-initialStock`}
                        data-bulk-field="initialStock"
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="0"
                        value={fila.initialStock}
                        onChange={(e) => actualizarFila(fila.id, "initialStock", e.target.value)}
                        onKeyDown={alPresionarEnter}
                        enterKeyHint="next"
                        placeholder="0"
                        aria-invalid={mensajeDe("initialStock") ? "true" : undefined}
                        aria-describedby={descritoPor("initialStock")}
                        className={inputClass}
                      />
                      {mensajeDe("initialStock") && (
                        <p id={`${base}-initialStock-error`} className="mt-1 text-sm text-error-ink">
                          {mensajeDe("initialStock")}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label htmlFor={`${base}-categoryId`} className={labelClass}>
                      Categoría
                    </label>
                    <CategorySelector
                      id={`${base}-categoryId`}
                      selectedId={fila.categoryId}
                      onValueChange={(id) => actualizarFila(fila.id, "categoryId", id)}
                      options={categorias}
                      onOptionsChange={setCategorias}
                      disabled={cargandoCategorias || loading}
                      invalid={Boolean(mensajeDe("categoryId"))}
                      describedBy={descritoPor("categoryId")}
                    />
                    {mensajeDe("categoryId") && (
                      <p id={`${base}-categoryId-error`} className="mt-1 text-sm text-error-ink">
                        {mensajeDe("categoryId")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Columna derecha desde md: la acción, pegajosa (`md:sticky md:top-4`).
              En celular `contents` deja el pie al final de la columna única. */}
          <div className="contents md:sticky md:top-4 md:col-start-2 md:row-start-1 md:block md:space-y-4">
            {/* Pie fijo: agregar filas a la izquierda del envío, una sola acción primaria. */}
            <div className="order-2 space-y-2 border-t border-hairline px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 md:order-none md:border-0 md:p-0">
              <button
                type="button"
                onClick={agregarFila}
                disabled={filas.length >= MAX_FILAS || loading}
                className="btn btn-secondary w-full"
              >
                {filas.length >= MAX_FILAS ? "Máximo 50" : "+ Agregar producto"}
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading
                  ? "Creando…"
                  : `Crear ${filas.length} ${filas.length === 1 ? "producto" : "productos"}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
