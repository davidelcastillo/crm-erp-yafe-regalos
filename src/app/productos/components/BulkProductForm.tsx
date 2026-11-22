// src/app/productos/components/BulkProductForm.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Swal from "sweetalert2";
import { getCategoryOptions } from "@/app/actions/category";
import { getEstiloPrendaOptions } from "@/app/actions/prendaTaxonomy";
import type { TaxonomyOption } from "@/lib/validations/prendaTaxonomy";
import { createProductsBatch } from "@/app/actions/product";
import { createProductsBatchSchema } from "@/lib/validations/product";
import { CategorySelector } from "@/components/ui/CategorySelector";
import { EstilosPicker } from "@/components/ui/EstilosPicker";
import { BranchPicker } from "@/components/ui/BranchPicker";
import { subirFoto } from "@/components/ui/FotoUploader";
import { MAX_FOTOS } from "@/lib/storage";
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
  /** Costo que salió cada unidad (T4); vacío es 0 y no entra en la compra. */
  costo: string;
  /** Estilos de la fila (misma taxonomía que la prenda); vacío son ninguno. */
  estilos: number[];
  /** Variantes de la fila (nombre + cantidad): con ellas el stock es la suma. */
  variantes: { nombre: string; cantidad: string }[];
  /** Fotos pendientes (U2): no viajan en el lote, se suben con el producto creado. */
  fotos: File[];
};
/** `row` es un mensaje que no pertenece a un campo puntual: se muestra en la card. */
type Campo = "name" | "prefix" | "price" | "categoryId" | "initialStock" | "costo" | "row";
type FilaError = { field: Campo; message: string };
/** Paso 1: sucursal del stock inicial. Paso 2: las filas de productos (S17). */
type Paso = "sucursal" | "productos";

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
      item.field === "initialStock" ||
      item.field === "costo"
        ? item.field
        : "row";
    (mapa[fila.id] ??= []).push({ field, message: item.message });
  }
  return mapa;
}

/**
 * Fotos pendientes de una fila del lote (U2): hasta `MAX_FOTOS`, la primera es
 * la portada. Se validan acá (tipo y tope, igual que `FotoUploader`) y la subida
 * espera a que el producto exista.
 */
function FotosFila({
  id,
  etiqueta,
  archivos,
  onChange,
  disabled,
}: {
  id: string;
  /** Nombre de la fila o «Producto N»: el label dice de qué producto son. */
  etiqueta: string;
  archivos: File[];
  onChange: (archivos: File[]) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  // Una object URL por miniatura: se libera cuando el archivo deja la fila.
  const urls = useMemo(() => archivos.map((archivo) => URL.createObjectURL(archivo)), [archivos]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);

  const agregar = (elegidos: File[]) => {
    const libres = MAX_FOTOS - archivos.length;
    if (elegidos.length > libres) {
      setError(
        `El máximo es ${MAX_FOTOS} fotos: ${libres === 0 ? "quitá una para agregar otra" : `elegí ${libres} o menos`}`
      );
      return;
    }
    const noImagen = elegidos.filter((archivo) => !archivo.type.startsWith("image/"));
    if (noImagen.length > 0) {
      setError(`${noImagen.map((archivo) => `«${archivo.name}»`).join(", ")} no es una imagen`);
      return;
    }
    setError(null);
    onChange([...archivos, ...elegidos]);
  };

  return (
    <div className="space-y-2">
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || archivos.length >= MAX_FOTOS}
        onChange={(evento) => {
          const elegidos = Array.from(evento.target.files ?? []);
          evento.target.value = "";
          agregar(elegidos);
        }}
        className="sr-only"
      />
      <label
        htmlFor={id}
        className="flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-xl border border-hairline bg-surface px-3 text-sm font-medium text-ink touch-manipulation"
      >
        ＋ Fotos de {etiqueta}
      </label>
      <p className="text-xs text-ink-muted">
        {archivos.length} de {MAX_FOTOS} · la primera es la portada
      </p>
      {error && (
        <p role="alert" className="text-sm text-error-ink">
          {error}
        </p>
      )}
      {archivos.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {archivos.map((archivo, indice) => (
            <li key={`${archivo.name}-${indice}`} className="relative">
              {/* object URL del archivo elegido: todavía no existe en el bucket. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[indice]}
                alt={archivo.name}
                className="aspect-square w-full rounded-lg border border-hairline object-cover"
              />
              {indice === 0 && (
                <span className="absolute left-1 top-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-surface">
                  Portada
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange(archivos.filter((_, i) => i !== indice))}
                disabled={disabled}
                aria-label={`Quitar foto ${indice + 1} de ${etiqueta}`}
                className="absolute -right-1 -top-1 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-surface"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * BulkProductForm
 *
 * Alta masiva de productos (S1): muchas filas en un mismo modal y un solo
 * envío «todo o nada» (S7). Por fila: nombre, prefijo, precio, categoría (S4)
 * y, si se elige una sucursal, stock inicial (T5) y costo (T4).
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
 * Dos pasos como `LabelSelector` (S17): primero la sucursal y después las
 * filas, así el bloque de sucursal no comparte el scroll con las cards. El paso
 * 2 conserva todo lo tipeado al volver y no vuelve a pedir las categorías.
 *
 * Patrón: bottom-sheet montado en un portal al `body` (STYLE.md). El panel es
 * una columna con altura tope, el cuerpo del paso es el ÚNICO scroller y el pie
 * va después, reservado en el flujo: nada se pinta encima de las cards ni de los
 * campos (S18). Enter nunca envía: pasa al campo siguiente y en el último campo
 * de la última fila agrega una fila.
 */
export function BulkProductForm({ onClose, onSuccess, branches }: BulkProductFormProps) {
  const [filas, setFilas] = useState<Fila[]>([
    {
      id: "1",
      name: "",
      prefix: "",
      price: "",
      categoryId: null,
      initialStock: "",
      costo: "",
      estilos: [],
      variantes: [],
      fotos: [],
    },
  ]);
  const [paso, setPaso] = useState<Paso>("sucursal");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<StockMovementReceipt | null>(null);
  const [categorias, setCategorias] = useState<{ id: number; name: string }[]>([]);
  // Una sola lista de estilos activos para todas las filas.
  const [estilosDisponibles, setEstilosDisponibles] = useState<TaxonomyOption[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
  const [errorCategorias, setErrorCategorias] = useState(false);
  const [errores, setErrores] = useState<Record<string, FilaError[]>>({});

  // Sin sucursal no existen los campos de stock ni de costo: limpiar sus
  // errores evita que el resumen intente enfocar un campo que ya no está.
  useEffect(() => {
    if (branchId !== null) return;
    setErrores((prev) => {
      const limpio = Object.entries(prev)
        .map(
          ([id, lista]) =>
            [id, lista.filter((e) => e.field !== "initialStock" && e.field !== "costo")] as const
        )
        .filter(([, lista]) => lista.length > 0);
      return Object.fromEntries(limpio);
    });
  }, [branchId]);
  const [loading, setLoading] = useState(false);
  /** Subida de las fotos pendientes después de crear el lote (U2). */
  const [subiendoFotos, setSubiendoFotos] = useState(false);

  const nextId = useRef(1);
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const pasoTituloRef = useRef<HTMLHeadingElement>(null);
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

  // Estilos activos: una sola lista para todas las filas, igual que las categorías.
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

  // El paso nuevo se anuncia por su título: el panel conserva su `h2` y el paso
  // se nombra con un `h3` enfocable.
  useEffect(() => {
    pasoTituloRef.current?.focus();
  }, [paso]);

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
      costo: "",
      estilos: [],
      variantes: [],
      fotos: [],
    };
    idParaEnfocar.current = nueva.id;
    setFilas((prev) => [...prev, nueva]);
  };

  const quitarFila = async (fila: Fila) => {
    if (filas.length <= 1) return; // la última fila no se puede quitar

    const conDatos =
      fila.name.trim() ||
      fila.prefix.trim() ||
      fila.price.trim() ||
      fila.initialStock.trim() ||
      fila.costo.trim() ||
      fila.estilos.length > 0 ||
      fila.variantes.length > 0 ||
      fila.fotos.length > 0;
    if (conDatos) {
      const confirmacion = await Swal.fire({
        title: "¿Quitar esta fila?",
        text: "Se pierden los datos cargados en la fila.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "var(--palette-brand-action)",
        cancelButtonColor: "var(--palette-secondary-gray)",
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

  /** Variantes de la fila: un solo punto de cambio, con la fila siempre fresca. */
  const actualizarVariantes = (
    id: string,
    cambio: (variantes: Fila["variantes"]) => Fila["variantes"]
  ) =>
    setFilas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, variantes: cambio(f.variantes) } : f))
    );
  const agregarVariante = (id: string) =>
    actualizarVariantes(id, (variantes) => [...variantes, { nombre: "", cantidad: "" }]);
  const quitarVariante = (id: string, indice: number) =>
    actualizarVariantes(id, (variantes) => variantes.filter((_, i) => i !== indice));
  const cambiarVariante = (
    id: string,
    indice: number,
    campo: "nombre" | "cantidad",
    valor: string
  ) =>
    actualizarVariantes(id, (variantes) =>
      variantes.map((variante, i) => (i === indice ? { ...variante, [campo]: valor } : variante))
    );

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
      (f) =>
        f.name.trim() ||
        f.prefix.trim() ||
        f.price.trim() ||
        f.initialStock.trim() ||
        f.costo.trim() ||
        f.estilos.length > 0 ||
        f.variantes.length > 0 ||
        f.fotos.length > 0
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
      confirmButtonColor: "var(--palette-brand-action)",
      cancelButtonColor: "var(--palette-secondary-gray)",
      confirmButtonText: "Sí, descartar",
      cancelButtonText: "Cancelar",
    });
    if (confirmacion.isConfirmed) onClose();
  };

  const filasConError = filas.filter((f) => (errores[f.id]?.length ?? 0) > 0);
  const nombreSucursal = branches.find((b) => b.id === branchId)?.name ?? "";

  /**
   * Sube las fotos pendientes con el producto ya creado (U2). Se cruza por
   * nombre porque el lote no devuelve el código de cada fila y la posición no
   * sirve (`createManyAndReturn` no promete orden); el nombre es único en el
   * lote (`createProductsBatchSchema`). Devuelve el detalle de las que fallaron
   * o `null`: una foto que falla no revierte el lote.
   */
  const subirFotosDelLote = async (
    products: { id: number; code: string; name: string }[]
  ): Promise<string | null> => {
    const porNombre = new Map(products.map((producto) => [producto.name.trim().toLowerCase(), producto]));
    const fallas: string[] = [];
    let pedidas = 0;
    let subidas = 0;

    for (const [indice, fila] of filas.entries()) {
      if (fila.fotos.length === 0) continue;
      pedidas += fila.fotos.length;
      const detalle = (mensaje: string) => `Fila ${indice + 1} «${fila.name.trim()}»: ${mensaje}`;
      const producto = porNombre.get(fila.name.trim().toLowerCase());
      if (!producto) {
        fallas.push(detalle("no se encontró el producto creado"));
        continue;
      }
      const resultados = await Promise.all(
        fila.fotos.map((archivo) => subirFoto(producto.id, archivo))
      );
      subidas += resultados.filter((resultado) => resultado.success).length;
      for (const resultado of resultados) {
        if (!resultado.success) fallas.push(detalle(resultado.error));
      }
    }

    if (fallas.length === 0) return null;
    return `Se subieron ${subidas} de ${pedidas} fotos. ${fallas.join(" · ")}`;
  };

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
        // Estilos de la fila: sin elegir ninguno no viaja (el esquema lo deja vacío).
        ...(f.estilos.length > 0 ? { estilos: f.estilos } : {}),
        // Variantes de la fila: con ellas el stock es la suma, no `initialStock`.
        ...(f.variantes.length > 0
          ? {
              variantes: f.variantes.map((variante) => ({
                nombre: variante.nombre,
                cantidad: variante.cantidad.trim() === "" ? 0 : Number(variante.cantidad),
              })),
            }
          : {}),
        // Vacío es 0: el producto igual queda en la vista por sucursal (S11).
        ...(branchId !== null
          ? { initialStock: f.initialStock.trim() === "" ? 0 : Number(f.initialStock) }
          : {}),
        // El costo vacío no viaja (T4): la fila sin costo no entra en la compra.
        ...(branchId !== null && f.costo.trim() !== "" ? { costo: Number(f.costo) } : {}),
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
          confirmButtonColor: "var(--danger)",
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

    // U2: las fotos esperan al producto creado. Una que falle se avisa sin
    // bloquear el lote ya creado (mismo criterio que el alta individual).
    let avisoFotos: string | null = null;
    if (resultado.success) {
      setSubiendoFotos(true);
      avisoFotos = await subirFotosDelLote(resultado.data.products);
      setSubiendoFotos(false);
    }
    setLoading(false);

    if (resultado.success) {
      if (avisoFotos) {
        await Swal.fire({
          title: "Fotos sin subir",
          text: `${avisoFotos}. Los productos sí se crearon, podés reintentar desde la edición.`,
          icon: "warning",
          confirmButtonColor: "var(--palette-brand-action)",
          confirmButtonText: "Aceptar",
        });
      }
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
        confirmButtonColor: "var(--palette-brand-action)",
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
      confirmButtonColor: "var(--danger)",
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
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Paso {paso === "sucursal" ? 1 : 2} de 2
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

        <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
          {/* Único scroller del panel: el cuerpo del paso. */}
          <div ref={cuerpoRef} className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
            {paso === "sucursal" ? (
              <div className="md:mx-auto md:max-w-md">
                <h3
                  ref={pasoTituloRef}
                  tabIndex={-1}
                  className="text-base font-semibold text-ink outline-none"
                >
                  Elegí la sucursal
                </h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Con sucursal, cada producto deja su stock ahí; con stock mayor a 0 se genera el
                  movimiento de ingreso y su comprobante.
                </p>
                <div className="mt-4">
                  <BranchPicker
                    branches={branches}
                    value={branchId}
                    onChange={setBranchId}
                    columns={2}
                    label="Sucursal del stock inicial"
                    emptyLabel="No hay sucursales activas: los productos se crean sin stock"
                  />
                </div>
                <p className="mt-4 text-sm text-ink-muted">
                  Sin sucursal: los productos se crean sin stock y no se genera comprobante.
                </p>
                <button
                  type="button"
                  onClick={() => setBranchId(null)}
                  aria-pressed={branchId === null}
                  className={`btn mt-2 w-full ${branchId === null ? "btn-active" : "btn-ghost"}`}
                >
                  No cargar stock
                </button>
              </div>
            ) : (
              <div className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-x-6 md:gap-y-4">
                <div className="space-y-4 md:col-start-1 md:row-start-1">
                  <h3
                      ref={pasoTituloRef}
                    tabIndex={-1}
                    className="text-base font-semibold text-ink outline-none"
                  >
                    Cargá los productos
                  </h3>
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

                        {/* Variantes de la fila: con alguna, el stock es su suma y el
                            campo simple de stock inicial no se muestra. */}
                        <div className="space-y-2">
                          {fila.variantes.map((variante, indiceVariante) => {
                            const numero = indiceVariante + 1;
                            const idNombre = `${base}-variante-${numero}-nombre`;
                            const idCantidad = `${base}-variante-${numero}-cantidad`;
                            return (
                              <div
                                key={numero}
                                className="space-y-2 rounded-xl border border-hairline bg-surface p-3"
                              >
                                <div>
                                  <label htmlFor={idNombre} className={labelClass}>
                                    Variante {numero} del producto {index + 1}
                                  </label>
                                  <input
                                    id={idNombre}
                                    data-bulk-field="variante"
                                    type="text"
                                    value={variante.nombre}
                                    onChange={(e) =>
                                      cambiarVariante(fila.id, indiceVariante, "nombre", e.target.value)
                                    }
                                    onKeyDown={alPresionarEnter}
                                    enterKeyHint="next"
                                    maxLength={40}
                                    placeholder="Ej: Roja"
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label htmlFor={idCantidad} className={labelClass}>
                                    Cantidad de la variante {numero} del producto {index + 1}
                                  </label>
                                  <input
                                    id={idCantidad}
                                    data-bulk-field="variante"
                                    type="number"
                                    inputMode="numeric"
                                    step="1"
                                    min="0"
                                    max="999"
                                    value={variante.cantidad}
                                    onChange={(e) =>
                                      cambiarVariante(
                                        fila.id,
                                        indiceVariante,
                                        "cantidad",
                                        e.target.value
                                      )
                                    }
                                    onKeyDown={alPresionarEnter}
                                    enterKeyHint="next"
                                    placeholder="0"
                                    className={inputClass}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => quitarVariante(fila.id, indiceVariante)}
                                  disabled={loading}
                                  aria-label={`Quitar variante ${numero} del producto ${index + 1}`}
                                  className="btn btn-ghost w-full"
                                >
                                  Quitar variante
                                </button>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => agregarVariante(fila.id)}
                            disabled={loading}
                            aria-label={`Agregar variante al producto ${index + 1}`}
                            className="btn btn-secondary w-full"
                          >
                            + Agregar variante
                          </button>
                        </div>

                        {/* Stock inicial: solo tiene sentido con una sucursal elegida (D8)
                            y sin variantes, porque ahí el stock es la suma. */}
                        {branchId !== null && fila.variantes.length === 0 && (
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

                        {/* T4: el costo de la fila entra en la compra del lote. */}
                        {branchId !== null && (
                          <div>
                            <label htmlFor={`${base}-costo`} className={labelClass}>
                              Costo
                            </label>
                            <input
                              id={`${base}-costo`}
                              data-bulk-field="costo"
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              value={fila.costo}
                              onChange={(e) => actualizarFila(fila.id, "costo", e.target.value)}
                              onKeyDown={alPresionarEnter}
                              enterKeyHint="next"
                              placeholder="0.00"
                              aria-invalid={mensajeDe("costo") ? "true" : undefined}
                              aria-describedby={descritoPor("costo")}
                              className={inputClass}
                            />
                            {mensajeDe("costo") && (
                              <p id={`${base}-costo-error`} className="mt-1 text-sm text-error-ink">
                                {mensajeDe("costo")}
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

                        {/* Estilos de la fila: la misma taxonomía que la prenda, compacta. */}
                        <EstilosPicker
                          compact
                          options={estilosDisponibles}
                          onOptionsChange={setEstilosDisponibles}
                          selected={fila.estilos}
                          onToggle={(id) =>
                            actualizarFila(
                              fila.id,
                              "estilos",
                              fila.estilos.includes(id)
                                ? fila.estilos.filter((actual) => actual !== id)
                                : [...fila.estilos, id]
                            )
                          }
                          onCreated={(id) =>
                            actualizarFila(fila.id, "estilos", [...fila.estilos, id])
                          }
                          disabled={loading}
                        />

                        {/* U2: fotos de la fila, pendientes hasta que el producto exista. */}
                        <FotosFila
                          id={`${base}-fotos`}
                          etiqueta={fila.name.trim() || `Producto ${index + 1}`}
                          archivos={fila.fotos}
                          onChange={(fotos) => actualizarFila(fila.id, "fotos", fotos)}
                          disabled={loading}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Sucursal elegida en el paso 1: se muestra como dato y la
                    salida sin stock sigue alcanzable acá (T15). */}
                <aside className="space-y-3 rounded-2xl border border-hairline bg-surface-soft p-4 md:col-start-2 md:row-start-1 md:sticky md:top-4">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Stock inicial · todo el lote
                  </h4>
                  <p className="text-sm text-ink-muted">
                    {nombreSucursal
                      ? `Sucursal: ${nombreSucursal}. Cada producto deja su stock ahí.`
                      : "Sin sucursal: los productos se crean sin stock y no se genera comprobante."}
                  </p>
                  {branchId !== null && (
                    <button
                      type="button"
                      onClick={() => setBranchId(null)}
                      disabled={loading}
                      className="btn btn-ghost w-full"
                    >
                      No cargar stock
                    </button>
                  )}
                </aside>
              </div>
            )}
          </div>

          {/* Pie reservado y fuera del scroll: no se pinta sobre campos ni cards (S18). */}
          {paso === "sucursal" ? (
            <div className="border-t border-hairline bg-surface px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 md:pb-4">
              <div className="md:mx-auto md:max-w-md">
                <button
                  type="button"
                  onClick={() => setPaso("productos")}
                  className="btn btn-primary w-full"
                >
                  Continuar
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-hairline bg-surface px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 md:grid md:grid-cols-2 md:gap-x-6 md:pb-4">
              {/* Desde md alineado con la columna derecha del cuerpo: filas a la
                  izquierda, acción a la derecha. */}
              <div className="space-y-2 md:col-start-2">
                {subiendoFotos && (
                  <p role="status" className="text-sm text-ink-muted">
                    Subiendo las fotos…
                  </p>
                )}
                <button
                  type="button"
                  onClick={agregarFila}
                  disabled={filas.length >= MAX_FILAS || loading}
                  className="btn btn-secondary w-full"
                >
                  {filas.length >= MAX_FILAS ? "Máximo 50" : "+ Agregar producto"}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaso("sucursal")}
                    disabled={loading}
                    className="btn btn-secondary"
                  >
                    Volver
                  </button>
                  <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                    {loading
                      ? subiendoFotos
                        ? "Subiendo fotos…"
                        : "Creando…"
                      : `Crear ${filas.length} ${filas.length === 1 ? "producto" : "productos"}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}
