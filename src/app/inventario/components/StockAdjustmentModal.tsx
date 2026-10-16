"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  adjustBranchStockBatch,
  getProductsWithBranchStock,
} from "@/app/actions/inventory";
import { getUser } from "@/actions/auth";
import { BranchPicker } from "@/components/ui/BranchPicker";

/**
 * Entrada o salida de stock de un LOTE de productos en UNA sucursal: la forma
 * auditable de corregir stock (cada línea deja su `BranchMovement`
 * `ENTRY`/`EXIT`, con el actor y el motivo).
 *
 * Es hermana de `MoveStockModal`, que mueve entre DOS sucursales
 * (`TRANSFER_OUT` + `TRANSFER_IN`): acá la sucursal es una sola y el sentido lo
 * elige el usuario. Tres pasos: sucursal y sentido → productos → confirmación.
 */
export interface StockAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  branches: Array<{ id: number; name: string }>;
  onConfirm: () => void;
}

type Tipo = "ENTRY" | "EXIT";
type Step = 1 | 2 | 3;

type Fila = { id: number; name: string; code: string; stock: number };

const TIPOS: Array<{ value: Tipo; label: string; ayuda: string }> = [
  { value: "ENTRY", label: "Entrada", ayuda: "Suma unidades al stock" },
  { value: "EXIT", label: "Salida", ayuda: "Resta unidades del stock" },
];

export const StockAdjustmentModal = ({
  open,
  onClose,
  branches,
  onConfirm,
}: StockAdjustmentModalProps) => {
  const [step, setStep] = useState<Step>(1);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<Tipo>("ENTRY");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [motivo, setMotivo] = useState("");
  const [pending, setPending] = useState(false);

  // Los productos se cargan en el handler (no en un effect): misma forma que
  // MoveStockModal, y evita el setState sincrónico dentro de un effect.
  //  - Entrada: todos los activos (aunque no tengan fila en la sucursal: el
  //    upsert la crea).
  //  - Salida: solo los que tienen stock > 0 en la sucursal.
  const cargarProductos = async (branch: number, sentido: Tipo) => {
    setLoading(true);
    setError(null);

    const result =
      sentido === "EXIT"
        ? await getProductsWithBranchStock({ branchId: branch, onlyWithStock: true })
        : await getProductsWithBranchStock({});

    setLoading(false);

    if (!result?.success || !Array.isArray(result.data)) {
      setError(result?.error ?? "Error al obtener los productos");
      setFilas([]);
      return;
    }

    setFilas(
      (result.data as Array<{
        id: number;
        name: string;
        code: string;
        inventory?: Array<{ branchId: number; stock: number }>;
      }>).map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        stock: p.inventory?.find((i) => i.branchId === branch)?.stock ?? 0,
      }))
    );
  };

  const handleContinue = () => {
    if (branchId === null) return;
    setSelectedIds([]);
    setQuantities({});
    setBusqueda("");
    setStep(2);
    void cargarProductos(branchId, tipo);
  };

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return filas;
    return filas.filter(
      (f) =>
        f.name.toLowerCase().includes(texto) ||
        f.code.toLowerCase().includes(texto)
    );
  }, [filas, busqueda]);

  const seleccionadas = useMemo(
    () => filas.filter((f) => selectedIds.includes(f.id)),
    [filas, selectedIds]
  );

  const totalUnidades = seleccionadas.reduce(
    (acc, f) => acc + (parseInt(quantities[f.id], 10) || 0),
    0
  );

  /** Error inline por fila: cantidad obligatoria, mayor a 0 y, en salida, ≤ stock. */
  const rowErrors = useMemo(() => {
    const errors: Record<number, string> = {};
    for (const fila of seleccionadas) {
      const valor = quantities[fila.id];
      if (valor === undefined || valor === "") {
        errors[fila.id] = "Ingresá una cantidad";
        continue;
      }
      const cantidad = parseInt(valor, 10);
      if (!Number.isInteger(cantidad) || cantidad < 1) {
        errors[fila.id] = "Cantidad inválida";
        continue;
      }
      if (tipo === "EXIT" && cantidad > fila.stock) {
        errors[fila.id] = `La cantidad supera el stock disponible (${fila.stock})`;
      }
    }
    return errors;
  }, [seleccionadas, quantities, tipo]);

  const isValid =
    seleccionadas.length > 0 &&
    seleccionadas.every((f) => !rowErrors[f.id]);

  const selectedBranchName =
    branches.find((b) => b.id === branchId)?.name ?? "-";

  const reset = () => {
    setStep(1);
    setBranchId(null);
    setTipo("ENTRY");
    setFilas([]);
    setError(null);
    setBusqueda("");
    setSelectedIds([]);
    setQuantities({});
    setMotivo("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleQuantityChange = (id: number, value: string) => {
    setQuantities((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    if (!isValid || branchId === null) return;

    setPending(true);
    const user = await getUser();
    const result = await adjustBranchStockBatch({
      branchId,
      movementType: tipo,
      items: seleccionadas.map((f) => ({
        productId: f.id,
        quantity: parseInt(quantities[f.id], 10),
      })),
      ...(motivo.trim() ? { reference: motivo.trim() } : {}),
      ...(user?.email ? { performedBy: user.email } : {}),
    });
    setPending(false);

    if (result.success) {
      await Swal.fire({
        title: tipo === "ENTRY" ? "Entrada registrada" : "Salida registrada",
        text: `${totalUnidades} unidades en ${selectedBranchName}`,
        icon: "success",
        confirmButtonColor: "#6d28d9",
        background: "#ffffff",
        color: "#222222",
      });
      reset();
      onConfirm();
      return;
    }

    setError(result.error ?? "Error al ajustar el stock");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-[60] flex items-center justify-center"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-adjustment-title"
    >
      <div
        className="bg-white w-full max-w-xl md:max-w-3xl rounded-2xl p-6 animate-scale-in max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2
            id="stock-adjustment-title"
            className="text-xl font-semibold text-[#222222]"
          >
            Entrada / salida de stock
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-icon btn-round hover:bg-[#f2f2f2]"
            aria-label="Cerrar"
          >
            <svg
              className="w-6 h-6 text-[#6a6a6a]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <p className="text-xs font-medium uppercase tracking-wide text-[#6a6a6a] mb-4">
          Paso {step} de 3
        </p>

        {/* Paso 1: la sucursal a la izquierda y el sentido con la acción a la
            derecha desde `md`; en celular se apilan en ese mismo orden. */}
        {step === 1 && (
          <div className="md:grid md:grid-cols-2 md:gap-5 md:items-start">
            <section>
              <p className="block text-xs text-[#6a6a6a] mb-2">Sucursal</p>
              <BranchPicker
                branches={branches}
                value={branchId}
                onChange={(id) => {
                  setBranchId(id);
                  setError(null);
                }}
                label="Sucursal"
              />
            </section>

            <section className="mt-4 rounded-2xl border border-black/10 bg-[#f7f7f7] p-4 md:mt-0 md:sticky md:top-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[#6a6a6a]">
                ¿Suma o resta stock?
              </h3>

              <div className="mt-3 flex gap-2">
                {TIPOS.map((opcion) => (
                  <button
                    key={opcion.value}
                    type="button"
                    onClick={() => setTipo(opcion.value)}
                    aria-pressed={tipo === opcion.value}
                    className={`btn ${tipo === opcion.value ? "btn-active" : "btn-ghost"} flex-1`}
                  >
                    {opcion.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#6a6a6a]">
                {TIPOS.find((t) => t.value === tipo)?.ayuda}
              </p>

              {error && <p className="mt-2 text-sm text-[#c13515]">{error}</p>}

              <button
                type="button"
                onClick={handleContinue}
                disabled={branchId === null}
                className="btn btn-primary mt-4 w-full md:w-auto"
              >
                Continuar
              </button>
            </section>
          </div>
        )}

        {/* Paso 2: la lista se opera a la izquierda y el resumen con la acción va
            a la derecha desde `md`; en celular se apilan en ese mismo orden. */}
        {step === 2 && (
          <div className="md:grid md:grid-cols-2 md:gap-5 md:items-start">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-[#222222]">
                  {tipo === "ENTRY" ? "Productos que entran" : "Productos que salen"}
                </h3>
                <span className="text-sm font-medium text-[#be185d]">
                  {seleccionadas.length} seleccionados
                </span>
              </div>

              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o código"
                aria-label="Buscar producto"
                className="w-full px-3 py-3 mb-3 min-h-[48px] rounded-xl border border-gray-200 focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/30 outline-none transition-all text-sm touch-manipulation"
              />

              {loading && (
                <p className="py-8 text-center text-sm text-[#6a6a6a]">
                  Cargando productos...
                </p>
              )}

              {!loading && error && (
                <p className="py-8 text-center text-sm text-[#c13515]">{error}</p>
              )}

              {!loading && !error && visibles.length === 0 && (
                <p className="py-8 text-center text-sm text-[#6a6a6a]">
                  {tipo === "EXIT"
                    ? "No hay productos con stock en esta sucursal"
                    : "No hay productos activos"}
                </p>
              )}

              {!loading && !error && visibles.length > 0 && (
                <div
                  role="group"
                  aria-label="Productos"
                  className="space-y-2 max-h-60 overflow-y-auto"
                >
                  {visibles.map((fila) => (
                    <div
                      key={fila.id}
                      className="flex items-center gap-3 p-3 min-h-[44px] rounded-xl hover:bg-[#f8f8f8] transition-colors"
                    >
                      <input
                        type="checkbox"
                        id={`sa-check-${fila.id}`}
                        checked={selectedIds.includes(fila.id)}
                        onChange={() => toggleSelection(fila.id)}
                        aria-label={`Seleccionar ${fila.name}`}
                        className="w-5 h-5 accent-[#ec4899]"
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`sa-check-${fila.id}`}
                          className="block text-sm font-medium text-[#222222] truncate cursor-pointer"
                        >
                          {fila.name}
                        </label>
                        <span className="block text-xs text-[#6a6a6a]">
                          {fila.code} · Stock: {fila.stock}
                        </span>
                        {rowErrors[fila.id] && (
                          <span className="block text-xs text-[#c13515] mt-1">
                            {rowErrors[fila.id]}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={tipo === "EXIT" ? fila.stock : undefined}
                        value={quantities[fila.id] ?? ""}
                        onChange={(e) => handleQuantityChange(fila.id, e.target.value)}
                        disabled={!selectedIds.includes(fila.id) || pending}
                        aria-label={`Cantidad ${fila.name}`}
                        placeholder="0"
                        className="w-20 px-3 py-3 rounded-xl border border-gray-200 focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/30 outline-none transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed tabular-nums text-right"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-black/10 bg-[#f7f7f7] p-4 md:mt-0 md:sticky md:top-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[#6a6a6a]">
                Resumen
              </h3>

              <div className="mt-3 flex items-baseline justify-between gap-4">
                <span className="text-sm text-[#3f3f3f]">Unidades</span>
                <span className="text-2xl font-bold text-[#222222] tabular-nums">
                  {totalUnidades}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-secondary"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!isValid}
                  className="btn btn-primary flex-1 md:flex-none"
                >
                  Siguiente
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Paso 3: el motivo a la izquierda y el detalle con el total de unidades
            a la derecha desde `md`; en celular se apilan en ese mismo orden. */}
        {step === 3 && (
          <div>
            <h3 className="text-base font-semibold text-[#222222] mb-3">
              Confirmar {tipo === "ENTRY" ? "entrada" : "salida"}
            </h3>

            <div className="md:grid md:grid-cols-2 md:gap-5 md:items-start">
              <section>
                <label className="block text-xs text-[#6a6a6a] mb-2" htmlFor="sa-motivo">
                  Motivo (opcional)
                </label>
                <input
                  id="sa-motivo"
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={200}
                  placeholder="Ej.: conteo físico, rotura, corrección"
                  className="w-full px-3 py-3 min-h-[48px] rounded-xl border border-gray-200 focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/30 outline-none transition-all text-sm touch-manipulation"
                />

                {error && <p className="mt-3 text-sm text-[#c13515]">{error}</p>}
              </section>

              <section className="mt-4 rounded-2xl border border-black/10 bg-[#f7f7f7] p-4 md:mt-0 md:sticky md:top-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-[#6a6a6a]">
                  Detalle
                </h3>

                <dl className="mt-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-[#6a6a6a]">Sucursal</dt>
                    <dd className="text-sm font-semibold text-[#222222] break-words">
                      {selectedBranchName}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-[#6a6a6a]">Movimiento</dt>
                    <dd className="text-sm font-semibold text-[#222222]">
                      {tipo === "ENTRY" ? "Entrada" : "Salida"}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-[#6a6a6a]">Productos</dt>
                    <dd className="text-sm font-semibold text-[#222222] tabular-nums">
                      {seleccionadas.length}
                    </dd>
                  </div>
                </dl>

                {/* El número que importa: el total de unidades, más grande. */}
                <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-black/10 pt-3">
                  <span className="text-sm font-medium text-[#222222]">Unidades</span>
                  <span className="text-2xl font-bold text-[#222222] tabular-nums">
                    {totalUnidades}
                  </span>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-between gap-3 mt-6 md:justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={pending}
                className="btn btn-secondary"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="btn btn-primary flex-1 md:flex-none"
              >
                {pending
                  ? "Guardando…"
                  : tipo === "ENTRY"
                    ? "Registrar entrada"
                    : "Registrar salida"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
