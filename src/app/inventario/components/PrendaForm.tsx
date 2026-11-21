"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Swal from "sweetalert2";
import type { Product } from "@prisma/client";
import { BranchPicker } from "@/components/ui/BranchPicker";
import { FotoUploader, subirFotos } from "@/components/ui/FotoUploader";
import { StockMovementReceiptPanel } from "@/app/inventario/components/StockMovementReceiptPanel";
import type { StockMovementReceipt } from "@/lib/stock-movement-receipt";
import { CANALES_PUBLICACION } from "@/lib/validations/prenda";
import type {
  CategoriaPrendaOption,
  TaxonomyOption,
} from "@/lib/validations/prendaTaxonomy";
import { createPrenda, getPrenda, updatePrenda } from "@/app/actions/prenda";
import {
  createCategoriaPrenda,
  createCondicionPrenda,
  createEstiloPrenda,
  getCategoriaPrendaOptions,
  getCondicionPrendaOptions,
  getEstiloPrendaOptions,
  getMedidaTipoOptions,
} from "@/app/actions/prendaTaxonomy";

export interface PrendaFormProps {
  /** Con producto, el modal abre en edición de esa prenda. */
  prenda?: Product | null;
  /** Sucursales activas: la prenda nace con su stock en una (solo en el alta). */
  branches?: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSuccess?: () => void;
}

type MedidaFila = { key: number; medidaTipoId: string; valorCm: string };
type TalleFila = { key: number; talle: string; cantidad: string };

/**
 * Alta y edición de prenda (U3): bottom-sheet con la ficha completa de la ropa
 * —talle, categoría y condición creables, estilos, medidas, costo, «publicada
 * en»— y el stock inicial en una sucursal.
 *
 * El código (`PK…`) lo genera el servidor: en el alta se avisa y en la edición
 * se muestra de solo lectura. La cantidad desaparece cuando la prenda es única
 * y el stock nunca se edita acá (S20: solo por movimientos auditables).
 */
export function PrendaForm({ prenda, branches = [], onClose, onSuccess }: PrendaFormProps) {
  const isEdit = !!prenda;

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    precio: "",
    costo: "",
    detalleCondicion: "",
    detalleIntervencion: "",
  });
  /** S1: filas «Talle + Cantidad»; el total se deriva, nunca se escribe a mano. */
  const [talles, setTalles] = useState<TalleFila[]>([{ key: 1, talle: "", cantidad: "1" }]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [condicionId, setCondicionId] = useState<number | null>(null);
  const [estilos, setEstilos] = useState<number[]>([]);
  const [medidas, setMedidas] = useState<MedidaFila[]>([]);
  const [esUnica, setEsUnica] = useState(false);
  /** Una vez que la persona toca la marca, la categoría deja de precargarla. */
  const [esUnicaTocada, setEsUnicaTocada] = useState(false);
  const [branchId, setBranchId] = useState<number | null>(null);
  /** Wizard del alta (S3 pedido del dueño): 1 = sucursal, 2 = ficha. La edición no tiene pasos. */
  const [paso, setPaso] = useState(1);
  const enPasoSucursal = !isEdit && paso === 1;
  const [publicadaEn, setPublicadaEn] = useState<string[]>([]);
  /** T2: fotos elegidas en el alta; se suben recién con la prenda creada (id). */
  const [fotosPendientes, setFotosPendientes] = useState<File[]>([]);
  const [code, setCode] = useState("");

  const [categorias, setCategorias] = useState<CategoriaPrendaOption[]>([]);
  const [condiciones, setCondiciones] = useState<TaxonomyOption[]>([]);
  const [estilosDisponibles, setEstilosDisponibles] = useState<TaxonomyOption[]>([]);
  const [medidasDisponibles, setMedidasDisponibles] = useState<TaxonomyOption[]>([]);
  const [cargandoOpciones, setCargandoOpciones] = useState(true);
  const [cargandoPrenda, setCargandoPrenda] = useState(isEdit);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<StockMovementReceipt | null>(null);

  // Taxonomías: una sola carga para todo el modal.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [cats, conds, ests, meds] = await Promise.all([
          getCategoriaPrendaOptions(),
          getCondicionPrendaOptions(),
          getEstiloPrendaOptions(),
          getMedidaTipoOptions(),
        ]);
        if (cancelado) return;
        if (cats.success) setCategorias(cats.data);
        if (conds.success) setCondiciones(conds.data);
        if (ests.success) setEstilosDisponibles(ests.data);
        if (meds.success) setMedidasDisponibles(meds.data);
      } catch (err) {
        console.error("Error loading prenda taxonomy:", err);
        if (!cancelado) setError("No se pudieron cargar las opciones de prenda");
      } finally {
        if (!cancelado) setCargandoOpciones(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // El fondo no scrollea mientras el modal está abierto (mismo cuidado que en
  // el alta de producto: sin esto el gesto arrastra la página de atrás).
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, []);

  // Edición: la ficha llega del servidor (la card solo tiene el producto).
  useEffect(() => {
    if (!prenda) return;
    let cancelado = false;
    (async () => {
      try {
        const resultado = await getPrenda(prenda.id);
        if (cancelado) return;
        if (!resultado.success) {
          setError(resultado.error);
          return;
        }
        const ficha = resultado.data;
      setForm({
        nombre: ficha.nombre,
        descripcion: ficha.descripcion,
        precio: String(ficha.precio),
        costo: String(ficha.costo),
        detalleCondicion: ficha.detalleCondicion,
        detalleIntervencion: ficha.detalleIntervencion,
      });
      setTalles(
        ficha.talles.map((fila, i) => ({
          key: i + 1,
          talle: fila.talle,
          cantidad: String(fila.cantidad),
        }))
      );
      setCategoriaId(ficha.categoriaPrendaId);
      setCondicionId(ficha.condicionId);
      setEstilos(ficha.estilos);
      setMedidas(
        ficha.medidas.map((medida, i) => ({
          key: i + 1,
          medidaTipoId: String(medida.medidaTipoId),
          valorCm: String(medida.valorCm),
        }))
      );
      setEsUnica(ficha.esUnica);
      setEsUnicaTocada(true);
      setPublicadaEn(ficha.publicadaEn);
      setCode(ficha.code);
      } catch (err) {
        console.error("Error loading prenda:", err);
        if (!cancelado) setError("No se pudo cargar la prenda");
      } finally {
        if (!cancelado) setCargandoPrenda(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [prenda]);

  const precioNumero = Number(form.precio) || 0;
  const costoNumero = Number(form.costo) || 0;
  /** S1: la cantidad total de la prenda se deriva de las filas de talle. */
  const cantidadTotal = talles.reduce(
    (suma, fila) => suma + (Number(fila.cantidad) > 0 ? Number(fila.cantidad) : 0),
    0
  );
  const ganancia = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(precioNumero - costoNumero);

  /** La categoría precarga «única» mientras nadie haya tocado la marca. */
  const cambiarCategoria = (id: number | null) => {
    setCategoriaId(id);
    if (esUnicaTocada) return;
    const elegida = categorias.find((categoria) => categoria.id === id);
    if (elegida) setEsUnica(elegida.esUnicaPorDefecto);
  };

  /** Alta rápida de una taxonomía: mismo patrón Swal que `CategorySelector`. */
  const crearTaxonomia = async (
    etiqueta: string,
    crear: (data: { name: string }) => Promise<
      { success: true; data: unknown } | { success: false; error: string }
    >
  ): Promise<string | null> => {
    const modal = await Swal.fire({
      title: `Nueva ${etiqueta}`,
      input: "text",
      inputLabel: "Nombre",
      inputAttributes: { maxlength: "100" },
      showCancelButton: true,
      confirmButtonText: "Crear",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "var(--palette-brand-action)",
      cancelButtonColor: "var(--palette-secondary-gray)",
      inputValidator: (value) => {
        if (!value || !value.trim()) return "El nombre es requerido";
        if (value.length > 100) return "Máximo 100 caracteres";
        return null;
      },
    });
    if (!modal.isConfirmed) return null;

    const name = String(modal.value ?? "").trim();
    const resultado = await crear({ name });
    if (!resultado.success) {
      setError(resultado.error);
      return null;
    }
    return name;
  };

  const crearCategoria = async () => {
    const modal = await Swal.fire({
      title: "Nueva categoría de prenda",
      input: "text",
      inputLabel: "Nombre",
      inputAttributes: { maxlength: "100" },
      showCancelButton: true,
      confirmButtonText: "Crear",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "var(--palette-brand-action)",
      cancelButtonColor: "var(--palette-secondary-gray)",
      inputValidator: (value) => {
        if (!value || !value.trim()) return "El nombre es requerido";
        if (value.length > 100) return "Máximo 100 caracteres";
        return null;
      },
    });
    if (!modal.isConfirmed) return;

    // U8: el prefijo es la base del código de las prendas de la categoría —
    // sin él no se puede dar de alta ninguna prenda, así que se pide acá.
    const modalPrefijo = await Swal.fire({
      title: `Prefijo de «${String(modal.value ?? "").trim()}»`,
      input: "text",
      inputLabel: "Prefijo del código (2-4 letras, p. ej. RPH)",
      inputAttributes: { maxlength: "4" },
      showCancelButton: true,
      confirmButtonText: "Crear",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "var(--palette-brand-action)",
      cancelButtonColor: "var(--palette-secondary-gray)",
      inputValidator: (value) => {
        if (!value || !/^[A-Za-z]{2,4}$/.test(value.trim()))
          return "El prefijo debe tener entre 2 y 4 letras";
        return null;
      },
    });
    if (!modalPrefijo.isConfirmed) return;

    const resultado = await createCategoriaPrenda({
      name: String(modal.value ?? "").trim(),
      codePrefix: String(modalPrefijo.value ?? "").trim(),
    });
    if (!resultado.success) {
      setError(resultado.error);
      return;
    }
    const creada = resultado.data;
    setCategorias((prev) =>
      [...prev, creada].sort((a, b) => a.name.localeCompare(b.name))
    );
    cambiarCategoria(creada.id);
  };

  const crearCondicion = async () => {
    const name = await crearTaxonomia("condición", createCondicionPrenda);
    if (!name) return;
    const resultado = await getCondicionPrendaOptions();
    if (resultado.success) {
      setCondiciones(resultado.data);
      const nueva = resultado.data.find((c) => c.name === name);
      if (nueva) setCondicionId(nueva.id);
    }
  };

  const crearEstilo = async () => {
    const name = await crearTaxonomia("estilo", createEstiloPrenda);
    if (!name) return;
    const resultado = await getEstiloPrendaOptions();
    if (resultado.success) {
      setEstilosDisponibles(resultado.data);
      const nuevo = resultado.data.find((e) => e.name === name);
      if (nuevo) setEstilos((prev) => [...prev, nuevo.id]);
    }
  };

  const agregarMedida = () =>
    setMedidas((prev) => [
      ...prev,
      { key: prev.length === 0 ? 1 : Math.max(...prev.map((m) => m.key)) + 1, medidaTipoId: "", valorCm: "" },
    ]);

  const quitarMedida = (key: number) =>
    setMedidas((prev) => prev.filter((medida) => medida.key !== key));

  const agregarTalle = () =>
    setTalles((prev) => [
      ...prev,
      {
        key: prev.length === 0 ? 1 : Math.max(...prev.map((f) => f.key)) + 1,
        talle: "",
        cantidad: "1",
      },
    ]);

  const quitarTalle = (key: number) =>
    setTalles((prev) => prev.filter((fila) => fila.key !== key));

  const actualizarTalle = (key: number, campo: "talle" | "cantidad", valor: string) =>
    setTalles((prev) =>
      prev.map((fila) => (fila.key === key ? { ...fila, [campo]: valor } : fila))
    );

  const actualizarMedida = (key: number, campo: "medidaTipoId" | "valorCm", valor: string) =>
    setMedidas((prev) =>
      prev.map((medida) => (medida.key === key ? { ...medida, [campo]: valor } : medida))
    );

  const toggleEstilo = (id: number) =>
    setEstilos((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));

  const toggleCanal = (canal: string) =>
    setPublicadaEn((prev) =>
      prev.includes(canal) ? prev.filter((c) => c !== canal) : [...prev, canal]
    );

  /** Los mismos campos para el alta y la edición; el stock solo viaja en el alta. */
  const construirPayload = () => ({
    nombre: form.nombre,
    descripcion: form.descripcion.trim() || undefined,
    precio: precioNumero,
    costo: costoNumero,
    categoriaPrendaId: categoriaId as number,
    talles: talles
      .filter((fila) => fila.talle.trim() !== "")
      .map((fila) => ({
        talle: fila.talle.trim(),
        cantidad: Number(fila.cantidad) || 0,
      })),
    condicionId: condicionId as number,
    detalleCondicion: form.detalleCondicion.trim() || undefined,
    detalleIntervencion: form.detalleIntervencion.trim() || undefined,
    estilos,
    medidas: medidas
      .filter((medida) => medida.medidaTipoId !== "")
      .map((medida) => ({
        medidaTipoId: Number(medida.medidaTipoId),
        valorCm: Number(medida.valorCm) || 0,
      })),
    esUnica,
    publicadaEn,
  });

  const handleSubmit = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (guardando) return;

    // Chequeo de cliente: el servidor vuelve a validarlo todo.
    const tallesValidos = talles.filter(
      (fila) => fila.talle.trim() !== "" && Number(fila.cantidad) >= 1
    );
    const faltante =
      !form.nombre.trim()
        ? "El nombre es requerido"
        : !(precioNumero > 0)
          ? "El precio debe ser mayor a 0"
          : form.costo.trim() === ""
            ? "El costo es requerido"
            : talles.length === 0 || tallesValidos.length === 0
              ? "Cargá al menos un talle con su cantidad"
              : tallesValidos.length !== talles.length
                ? "Cada talle necesita una cantidad de 1 o más"
                : esUnica && (tallesValidos.length !== 1 || Number(tallesValidos[0].cantidad) !== 1)
                  ? "Una prenda única lleva un solo talle con cantidad 1"
                  : categoriaId === null
                    ? "Elegí la categoría de prenda"
                    : condicionId === null
                      ? "Elegí la condición"
                      : !isEdit && branchId === null
                        ? "Elegí la sucursal"
                        : null;
    if (faltante) {
      setError(faltante);
      return;
    }

    setError(null);
    setGuardando(true);
    const payload = construirPayload();

    if (isEdit) {
      const resultado = await updatePrenda({ id: prenda!.id, ...payload });
      setGuardando(false);
      if (!resultado.success) {
        setError(resultado.error);
        return;
      }
      await Swal.fire({
        title: "Prenda actualizada",
        text: "La prenda se actualizó correctamente",
        icon: "success",
        confirmButtonColor: "var(--palette-brand-action)",
        confirmButtonText: "Aceptar",
      });
      onSuccess?.();
      onClose();
      return;
    }

    const resultado = await createPrenda({
      ...payload,
      branchId: branchId as number,
    });
    setGuardando(false);

    if (!resultado.success) {
      setError(resultado.error);
      return;
    }
    // T2: las fotos del alta se suben con la prenda ya creada. Una que falle
    // se avisa y no bloquea al resto ni la creación.
    const avisoFotos = await subirFotos(resultado.data.product.id, fotosPendientes);
    if (avisoFotos) {
      await Swal.fire({
        title: "Fotos sin subir",
        text: `${avisoFotos}. La prenda sí se creó, podés reintentar desde la edición.`,
        icon: "warning",
        confirmButtonColor: "var(--palette-brand-action)",
        confirmButtonText: "Aceptar",
      });
    }
    // Con comprobante primero se descarga: el modal cierra al cerrar el panel.
    if (resultado.data.receipt) {
      setReceipt(resultado.data.receipt);
      return;
    }    await Swal.fire({
      title: "Prenda creada",
      text: "La prenda se creó correctamente",
      icon: "success",
      confirmButtonColor: "var(--palette-brand-action)",
      confirmButtonText: "Aceptar",
    });
    onSuccess?.();
    onClose();
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
    "w-full px-3 py-3 min-h-[44px] rounded-xl border border-hairline bg-surface text-ink focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none transition-all";
  const labelClass = "block text-sm font-medium text-ink mb-1";
  /** Título de sección del paso 2: agrupa lo que va junto (pedido del dueño). */
  const seccionClass = "pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted";
  const titulo = isEdit ? "Editar prenda" : "Nueva prenda";
  const sucursalElegida = branches.find((b) => b.id === branchId)?.name;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-scrim-strong backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prenda-form-title"
        className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl bg-surface animate-slide-up md:max-w-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-6">
          <div className="min-w-0">
            <h2 id="prenda-form-title" className="text-xl font-semibold text-ink">
              {titulo}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {enPasoSucursal
                ? "Paso 1 de 2 · Elegí la sucursal"
                : !isEdit
                  ? `Paso 2 de 2 · ${sucursalElegida ?? "Sucursal"}`
                  : "Ropa second hand o nueva: ficha, medidas y stock en una sucursal."}
            </p>
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
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
            {cargandoPrenda ? (
              <p className="py-8 text-center text-sm text-ink-muted">Cargando prenda…</p>
            ) : enPasoSucursal ? (
              <div className="space-y-4">
                {error && (
                  <p role="alert" className="rounded-xl border border-error bg-error-surface p-3 text-sm text-error-ink">
                    {error}
                  </p>
                )}
                <BranchPicker
                  branches={branches}
                  value={branchId}
                  onChange={setBranchId}
                  label="Sucursal donde entra la prenda"
                  columns={2}
                />
                {branchId === null && (
                  <p className="text-center text-sm text-ink-muted">
                    Elegí la sucursal para continuar.
                  </p>
                )}
              </div>
            ) : (
              <>
                {error && (
                  <p role="alert" className="rounded-xl border border-error bg-error-surface p-3 text-sm text-error-ink">
                    {error}
                  </p>
                )}

                <div>
                  <label htmlFor="prenda-nombre" className={labelClass}>
                    Nombre *
                  </label>
                  <input
                    id="prenda-nombre"
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej: Campera de jean"
                    maxLength={100}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="prenda-precio" className={labelClass}>
                      Precio de venta *
                    </label>
                    <input
                      id="prenda-precio"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={form.precio}
                      onChange={(e) => setForm({ ...form, precio: e.target.value })}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="prenda-costo" className={labelClass}>
                      Costo *
                    </label>
                    <input
                      id="prenda-costo"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={form.costo}
                      onChange={(e) => setForm({ ...form, costo: e.target.value })}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                </div>

                <p role="status" className="text-sm text-ink-muted">
                  Ganancia estimada: <span className="font-semibold text-ink">{ganancia}</span>
                </p>

                <div>
                  <label htmlFor="prenda-descripcion" className={labelClass}>
                    Descripción
                  </label>
                  <textarea
                    id="prenda-descripcion"
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    rows={2}
                    maxLength={500}
                    placeholder="Ej: Segunda mano, talle M"
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {/* S1: filas «Talle + Cantidad»; una prenda única lleva un solo talle. */}
                <div>
                  <p className={seccionClass}>Talles y unidades</p>
                  <span className={labelClass}>Talles *</span>
                  <div className="space-y-2">
                    {talles.map((fila, indice) => (
                      <div key={fila.key} className="flex items-center gap-2">
                        <input
                          id={indice === 0 ? "prenda-talle" : `prenda-talle-${fila.key}`}
                          type="text"
                          value={fila.talle}
                          onChange={(e) => actualizarTalle(fila.key, "talle", e.target.value)}
                          placeholder="Único"
                          maxLength={20}
                          aria-label={`Talle ${indice + 1}`}
                          className={inputClass}
                        />
                        {!esUnica && (
                          <>
                            <input
                              id={`prenda-talle-cantidad-${fila.key}`}
                              type="number"
                              inputMode="numeric"
                              step="1"
                              min="1"
                              max="999"
                              value={fila.cantidad}
                              onChange={(e) =>
                                actualizarTalle(fila.key, "cantidad", e.target.value)
                              }
                              aria-label={`Cantidad del talle ${indice + 1}`}
                              className={`${inputClass} w-24 text-center`}
                            />
                            {talles.length > 1 && (
                              <button
                                type="button"
                                onClick={() => quitarTalle(fila.key)}
                                className="btn btn-icon text-ink-muted hover:bg-surface-strong"
                                aria-label={`Quitar talle ${indice + 1}`}
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {!esUnica && (
                    <button
                      type="button"
                      onClick={agregarTalle}
                      className="btn btn-ghost mt-2 text-sm text-accent"
                    >
                      ＋ Agregar talle
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-soft p-4">
                  <label htmlFor="prenda-es-unica" className="text-sm font-medium text-ink">
                    Prenda única
                  </label>
                  <input
                    id="prenda-es-unica"
                    type="checkbox"
                    checked={esUnica}
                    onChange={(e) => {
                      setEsUnica(e.target.checked);
                      setEsUnicaTocada(true);
                      // Una prenda única colapsa las filas a un solo talle (S1).
                      if (e.target.checked) {
                        setTalles((prev) => [
                          { key: prev[0]?.key ?? 1, talle: prev[0]?.talle ?? "", cantidad: "1" },
                        ]);
                      }
                    }}
                    className="h-5 w-5 accent-accent"
                  />
                </div>

                {/* El total de unidades se deriva de los talles (S1), nunca se escribe a mano. */}
                {!esUnica && (
                  <div>
                    <span className={labelClass}>Total de unidades</span>
                    <p
                      data-testid="prenda-cantidad-total"
                      className={`${inputClass} bg-surface-strong text-sm text-ink-muted`}
                    >
                      {cantidadTotal} {cantidadTotal === 1 ? "unidad" : "unidades"}
                    </p>
                  </div>
                )}

                <div>
                  <p className={seccionClass}>Ficha de la prenda</p>
                  <label htmlFor="prenda-categoria" className={labelClass}>
                    Categoría de prenda *
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="prenda-categoria"
                      value={categoriaId ?? ""}
                      onChange={(e) =>
                        cambiarCategoria(e.target.value === "" ? null : Number(e.target.value))
                      }
                      disabled={cargandoOpciones}
                      className={inputClass}
                    >
                      <option value="">Seleccionar categoría</option>
                      {categorias.map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={crearCategoria}
                      className="btn btn-primary shrink-0 whitespace-nowrap"
                      aria-label="Nueva categoría"
                    >
                      ＋ Nueva
                    </button>
                  </div>
                  {!cargandoOpciones && categorias.length === 0 && (
                    <p className="mt-1 text-xs text-ink-muted">
                      No hay categorías de prenda. Creá la primera con «＋ Nueva».
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="prenda-condicion" className={labelClass}>
                    Condición *
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="prenda-condicion"
                      value={condicionId ?? ""}
                      onChange={(e) =>
                        setCondicionId(e.target.value === "" ? null : Number(e.target.value))
                      }
                      disabled={cargandoOpciones}
                      className={inputClass}
                    >
                      <option value="">Seleccionar condición</option>
                      {condiciones.map((condicion) => (
                        <option key={condicion.id} value={condicion.id}>
                          {condicion.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={crearCondicion}
                      className="btn btn-primary shrink-0 whitespace-nowrap"
                      aria-label="Nueva condición"
                    >
                      ＋ Nueva
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="prenda-detalle-condicion" className={labelClass}>
                    Aclaración de la condición
                  </label>
                  <input
                    id="prenda-detalle-condicion"
                    type="text"
                    value={form.detalleCondicion}
                    onChange={(e) => setForm({ ...form, detalleCondicion: e.target.value })}
                    maxLength={200}
                    placeholder="Ej: mancha chica en el puño"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="prenda-detalle-intervencion" className={labelClass}>
                    Detalle de la intervención
                  </label>
                  <input
                    id="prenda-detalle-intervencion"
                    type="text"
                    value={form.detalleIntervencion}
                    onChange={(e) => setForm({ ...form, detalleIntervencion: e.target.value })}
                    maxLength={200}
                    placeholder="Ej: teñida, ruedo nuevo"
                    className={inputClass}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={labelClass}>Estilos</span>
                    <button
                      type="button"
                      onClick={crearEstilo}
                      className="btn btn-ghost whitespace-nowrap"
                      aria-label="Nuevo estilo"
                    >
                      ＋ Nuevo
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {estilosDisponibles.map((estilo) => {
                      const elegido = estilos.includes(estilo.id);
                      return (
                        <button
                          key={estilo.id}
                          type="button"
                          aria-pressed={elegido}
                          onClick={() => toggleEstilo(estilo.id)}
                          className={`min-h-[44px] rounded-full border px-4 py-2 text-sm transition-colors touch-manipulation ${
                            elegido
                              ? "border-accent bg-accent/10 font-medium text-brand-rosa-texto"
                              : "border-hairline bg-surface text-ink"
                          }`}
                        >
                          {estilo.name}
                        </button>
                      );
                    })}
                    {estilosDisponibles.length === 0 && (
                      <p className="text-xs text-ink-muted">Todavía no hay estilos.</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={labelClass}>Medidas</span>
                    <button
                      type="button"
                      onClick={agregarMedida}
                      className="btn btn-secondary whitespace-nowrap"
                      aria-label="Agregar medida"
                    >
                      ＋ Agregar medida
                    </button>
                  </div>
                  {medidasDisponibles.length === 0 && (
                    <p className="text-xs text-ink-muted">Todavía no hay tipos de medida.</p>
                  )}
                  {medidas.map((fila, indice) => (
                    <div key={fila.key} className="mt-2 flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`prenda-medida-tipo-${fila.key}`} className="block text-xs text-ink-muted mb-1">
                          Tipo de medida
                        </label>
                        <select
                          id={`prenda-medida-tipo-${fila.key}`}
                          value={fila.medidaTipoId}
                          onChange={(e) =>
                            actualizarMedida(fila.key, "medidaTipoId", e.target.value)
                          }
                          className={inputClass}
                        >
                          <option value="">Elegir</option>
                          {medidasDisponibles.map((tipo) => (
                            <option key={tipo.id} value={tipo.id}>
                              {tipo.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24 shrink-0">
                        <label htmlFor={`prenda-medida-cm-${fila.key}`} className="block text-xs text-ink-muted mb-1">
                          Centímetros
                        </label>
                        <input
                          id={`prenda-medida-cm-${fila.key}`}
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          max="300"
                          value={fila.valorCm}
                          onChange={(e) => actualizarMedida(fila.key, "valorCm", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => quitarMedida(fila.key)}
                        className="btn btn-icon text-ink-muted hover:bg-surface-strong"
                        aria-label={`Quitar medida ${indice + 1}`}
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {isEdit ? (
                  <div>
                    <label htmlFor="prenda-codigo" className={labelClass}>
                      Código
                    </label>
                    <input
                      id="prenda-codigo"
                      type="text"
                      value={code}
                      readOnly
                      className={`${inputClass} bg-surface-strong font-mono text-sm`}
                      title="El código no se puede modificar"
                    />
                  </div>
                ) : (
                  <div>
                    <span className={labelClass}>Código</span>
                    <p className="text-sm text-ink-muted">Se genera solo según la categoría (p. ej. RPH000).</p>
                  </div>
                )}

                <div>
                  <span className={labelClass}>Publicada en</span>
                  <div className="flex flex-wrap gap-2">
                    {CANALES_PUBLICACION.map((canal) => (
                      <label
                        key={canal}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-hairline px-4 text-sm text-ink"
                      >
                        <input
                          type="checkbox"
                          checked={publicadaEn.includes(canal)}
                          onChange={() => toggleCanal(canal)}
                          className="h-5 w-5 accent-accent"
                        />
                        {canal}
                      </label>
                    ))}
                  </div>
                </div>

                {/* T2: en la edición se administran las que ya tiene; en el alta
                    quedan pendientes hasta que la prenda exista. */}
                <div>
                  <p className={seccionClass}>Fotos</p>
                  <span className={labelClass}>Hasta 4 · la primera es la portada</span>
                  <FotoUploader
                    productId={isEdit ? prenda!.id : null}
                    onPendientesChange={setFotosPendientes}
                  />
                </div>
              </>
            )}
          </div>

          {/* Pie reservado y fuera del scroll. */}
          <div className="border-t border-hairline bg-surface px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 md:pb-4">
            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={guardando} className="btn btn-secondary">
                Cancelar
              </button>
              {enPasoSucursal ? (
                <button
                  type="button"
                  onClick={() => setPaso(2)}
                  disabled={branchId === null}
                  className="btn btn-primary flex-1"
                >
                  Continuar
                </button>
              ) : (
                <button type="submit" disabled={guardando} className="btn btn-primary flex-1">
                  {guardando ? "Guardando…" : isEdit ? "Guardar prenda" : "Crear prenda"}
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
