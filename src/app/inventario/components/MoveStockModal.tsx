"use client";

import { useMemo, useState } from "react";
import {
  moveStockBatchBetweenBranches,
  getBranchInventory,
} from "@/app/actions/inventory";
import Swal from "sweetalert2";
import { BranchPicker } from "@/components/ui/BranchPicker";
import type { StockMovementReceipt } from "@/lib/stock-movement-receipt";
import { StockMovementReceiptPanel } from "./StockMovementReceiptPanel";

export interface MoveStockModalProps {
  open: boolean;
  onClose: () => void;
  productId: number; // This prop is no longer used but kept for compatibility
  branches: Array<{ id: number; name: string }>;
  onConfirm: () => void;
}

type MovableProduct = { id: number; name: string; code?: string; stock: number };
type Step = 1 | 2;

export const MoveStockModal = ({
  open,
  onClose,
  productId,
  branches,
  onConfirm,
}: MoveStockModalProps) => {
  const [step, setStep] = useState<Step>(1);
  const [receipt, setReceipt] = useState<StockMovementReceipt | null>(null);
  const [sourceBranchId, setSourceBranchId] = useState<number | null>(null);
  const [destBranchId, setDestBranchId] = useState<number | null>(null);
  const [productOptions, setProductOptions] = useState<MovableProduct[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [pending, setPending] = useState(false);
  const [loadingOrigin, setLoadingOrigin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRows = useMemo(
    () => productOptions.filter((p) => selectedIds.includes(p.id)),    [productOptions, selectedIds]
  );

  /** Filtro local del paso 2: por nombre o por código, como en Entrada/Salida. */
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return productOptions;
    return productOptions.filter(
      (p) =>
        p.name.toLowerCase().includes(texto) ||
        (p.code ?? "").toLowerCase().includes(texto)
    );
  }, [productOptions, busqueda]);

  const summary = useMemo(
    () => ({
      count: selectedRows.length,
      total: selectedRows.reduce(
        (acc, p) => acc + (parseInt(quantities[p.id], 10) || 0),
        0
      ),
    }),
    [selectedRows, quantities]
  );

  const summaryText = `${summary.count} ${
    summary.count === 1 ? "producto" : "productos"
  } · ${summary.total} unidades`;

  /** Error inline por fila (derivado de quantities + stock de la fila). */
  const rowErrors = useMemo(() => {
    const errors: Record<number, string> = {};
    for (const p of selectedRows) {
      const q = quantities[p.id];
      if (q === undefined || q === "") {
        errors[p.id] = "Ingresá una cantidad";
        continue;
      }
      const num = parseInt(q, 10);
      if (!Number.isInteger(num) || num < 1) {
        errors[p.id] = "Cantidad inválida";
        continue;
      }
      if (num > p.stock) {
        errors[p.id] = `La cantidad supera el stock disponible (${p.stock})`;
      }
    }
    return errors;
  }, [selectedRows, quantities]);

  const isValid =
    selectedRows.length > 0 &&
    selectedRows.every((p) => !rowErrors[p.id]);

  /** Carga los productos de la sucursal origen; el avance al paso 2 lo confirma «Siguiente». */
  const handleOriginChange = async (branchId: number | null) => {
    setSourceBranchId(branchId);
    setError(null);
    if (branchId === null) {
      setProductOptions([]);
      setSelectedIds([]);
      setQuantities({});
      setBusqueda("");
      setStep(1);
      return;
    }
    setLoadingOrigin(true);
    try {
      const res = await getBranchInventory({ branchId });
      if (res.success) {
        setProductOptions(res.data as MovableProduct[]);
        setSelectedIds([]);
        setQuantities({});
        setBusqueda("");
      } else {
        setError(res.error || "Error al cargar productos");
      }
    } finally {
      setLoadingOrigin(false);
    }
  };

  const toggleSelection = (id: number) => {
    const isSelected = selectedIds.includes(id);
    if (isSelected) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
      setQuantities((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleQuantityChange = (id: number, value: string) => {
    setQuantities((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    if (sourceBranchId === null || destBranchId === null || !isValid) return;

    const confirm = await Swal.fire({
      title: "¿Mover stock?",
      html: `<p>${summaryText}</p>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#6d28d9",
      cancelButtonColor: "#6a6a6a",
      confirmButtonText: "Sí, mover",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    setPending(true);
    setError(null);
    try {
      const payload = {
        sourceBranchId,
        destBranchId,
        performedBy: "admin", // TODO: desde auth context (igual que el código actual)
        items: selectedRows.map((p) => ({
          productId: p.id,
          quantity: parseInt(quantities[p.id], 10),
        })),
      };
      const res = await moveStockBatchBetweenBranches(payload);
      if (res.success && res.data) {
        setReceipt(res.data.receipt);
        onConfirm();
      } else {
        await Swal.fire({
          title: "Error",
          text: res.error || "Error al mover stock",
          icon: "error",
          confirmButtonColor: "#dc2626",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al mover stock");
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return null;
  }

  if (receipt) {
    return <StockMovementReceiptPanel receipt={receipt} onClose={() => { setReceipt(null); onClose(); }} />;
  }

  return (
    <div
      className="fixed inset-0 bg-scrim backdrop-blur-md z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-stock-title"
    >
      <div
        className="bg-surface w-full max-w-xl md:max-w-3xl rounded-2xl p-6 animate-scale-in max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2
            id="move-stock-title"
            className="text-xl font-semibold text-ink"
          >
            Mover Stock
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-icon btn-round hover:bg-surface-strong"
            aria-label="Cerrar"
          >
            <svg
              className="w-6 h-6 text-ink-muted"
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

        {error && <p className="mb-4 text-sm text-error">{error}</p>}

        {/* Paso 1: es un solo bloque, así que desde `md` las cards de sucursal van
            en dos columnas y la acción deja de estirarse a lo ancho del panel. */}
        {step === 1 && (
          <div>
            <p className="block text-xs text-ink-muted mb-2">Sucursal origen</p>
            <BranchPicker
              branches={branches}
              value={sourceBranchId}
              onChange={handleOriginChange}
              label="Sucursal origen"
              emptyLabel="No hay sucursales activas"
              columns={2}
            />
            <div className="md:flex md:justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={sourceBranchId === null || loadingOrigin || error !== null || pending}
                className="btn btn-primary w-full mt-6 md:w-auto"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* Desde `md` la lista se opera a la izquierda y el resumen con la acción
            va a la derecha; en celular se apilan en ese mismo orden. */}
        {step === 2 && (
          <div>
            <p className="block text-xs text-ink-muted mb-2">Sucursal destino</p>
            <BranchPicker
              branches={branches}
              value={destBranchId}
              onChange={setDestBranchId}
              disabledIds={sourceBranchId === null ? [] : [sourceBranchId]}
              label="Sucursal destino"
              emptyLabel="No hay sucursales activas"
              columns={2}
            />

            <div className="md:grid md:grid-cols-2 md:gap-5 md:items-start">
              <section className="mt-4">
                <p className="block text-xs text-ink-muted mb-2">
                  Productos con stock en la sucursal de origen
                </p>

                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o código"
                  aria-label="Buscar producto"
                  className="mb-3 min-h-[48px] w-full rounded-xl border border-hairline px-3 py-3 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 touch-manipulation"
                />

                {productOptions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-muted">
                    No hay productos con stock en esta sucursal
                  </p>
                ) : visibles.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-muted">
                    No encontramos productos con ese nombre o código
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {visibles.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 min-h-[44px] rounded-xl hover:bg-surface-soft transition-colors"
                      >
                        <input
                          type="checkbox"
                          id={`ms-check-${p.id}`}
                          checked={selectedIds.includes(p.id)}
                          onChange={() => toggleSelection(p.id)}
                          aria-label={`Seleccionar ${p.name}`}
                          className="w-5 h-5 accent-accent"
                        />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={`ms-check-${p.id}`}
                            className="block text-sm font-medium text-ink truncate cursor-pointer"
                          >
                            {p.name}
                          </label>
                          <span className="block text-xs text-ink-muted">
                            Stock: {p.stock}
                          </span>
                          {rowErrors[p.id] && (
                            <span className="block text-xs text-error mt-1">
                              {rowErrors[p.id]}
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={p.stock}
                          value={quantities[p.id] ?? ""}
                          onChange={(e) =>
                            handleQuantityChange(p.id, e.target.value)
                          }
                          disabled={!selectedIds.includes(p.id) || pending}
                          aria-label={`Cantidad ${p.name}`}
                          className="w-20 px-3 py-3 rounded-xl border border-hairline focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed tabular-nums text-right"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-4 rounded-2xl border border-hairline bg-surface-soft p-4 md:sticky md:top-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Resumen
                </h3>
                <p className="mt-2 text-sm text-ink-body tabular-nums">
                  {summaryText}
                </p>

                <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-hairline pt-3">
                  <span className="text-sm font-medium text-ink">
                    Unidades a mover
                  </span>
                  <span className="text-2xl font-bold text-ink tabular-nums">
                    {summary.total}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn btn-secondary"
                    disabled={pending}
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!isValid || pending}
                    className="btn btn-primary flex-1 md:flex-none"
                  >
                    {pending ? "Moviendo…" : "Mover Stock"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
