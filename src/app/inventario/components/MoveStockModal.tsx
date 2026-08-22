"use client";

import { useMemo, useState } from "react";
import {
  moveStockBatchBetweenBranches,
  getBranchInventory,
} from "@/app/actions/inventory";
import Swal from "sweetalert2";

export interface MoveStockModalProps {
  open: boolean;
  onClose: () => void;
  productId: number; // This prop is no longer used but kept for compatibility
  branches: Array<{ id: number; name: string }>;
  onConfirm: () => void;
}

type MovableProduct = { id: number; name: string; stock: number };
type Step = 1 | 2;

export const MoveStockModal = ({
  open,
  onClose,
  productId,
  branches,
  onConfirm,
}: MoveStockModalProps) => {
  const [step, setStep] = useState<Step>(1);
  const [sourceBranchId, setSourceBranchId] = useState<number | null>(null);
  const [destBranchId, setDestBranchId] = useState<number | null>(null);
  const [productOptions, setProductOptions] = useState<MovableProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRows = useMemo(
    () => productOptions.filter((p) => selectedIds.includes(p.id)),
    [productOptions, selectedIds]
  );

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

  const handleOriginChange = async (branchId: number | null) => {
    setSourceBranchId(branchId);
    setError(null);
    if (branchId === null) {
      setProductOptions([]);
      setSelectedIds([]);
      setQuantities({});
      setStep(1);
      return;
    }
    const res = await getBranchInventory({ branchId });
    if (res.success) {
      setProductOptions(res.data as MovableProduct[]);
      setSelectedIds([]);
      setQuantities({});
      setStep(2);
    } else {
      setError(res.error || "Error al cargar productos");
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
      confirmButtonColor: "#ff385c",
      cancelButtonColor: "#6a6a6a",
      background: "#ffffff",
      color: "#222222",
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
      if (res.success) {
        onClose();
        onConfirm();
      } else {
        await Swal.fire({
          title: "Error",
          text: res.error || "Error al mover stock",
          icon: "error",
          confirmButtonColor: "#ff385c",
          background: "#ffffff",
          color: "#222222",
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

  const selectClass =
    "w-full px-3 py-3 min-h-[48px] rounded-xl border border-gray-200 bg-white focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all text-sm touch-manipulation appearance-none cursor-pointer";

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-[60] flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-stock-title"
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2
            id="move-stock-title"
            className="text-xl font-semibold text-[#222222]"
          >
            Mover Stock
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[#f2f2f2] transition-colors touch-manipulation"
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

        {error && <p className="mb-4 text-sm text-[#c13515]">{error}</p>}

        {step === 1 && (
          <div>
            <label
              htmlFor="ms-origen"
              className="block text-xs text-[#6a6a6a] mb-2"
            >
              Sucursal origen
            </label>
            <div className="relative">
              <select
                id="ms-origen"
                value={sourceBranchId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  handleOriginChange(val === "" ? null : Number(val));
                }}
                className={`${selectClass} pr-10`}
                disabled={pending}
              >
                <option value="" className="bg-white text-[#222222]">
                  Seleccionar origen
                </option>
                {branches.map((b) => (
                  <option
                    key={b.id}
                    value={b.id}
                    className="bg-white text-[#222222]"
                  >
                    {b.name}
                  </option>
                ))}
              </select>
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6a6a6a] pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <label
              htmlFor="ms-destino"
              className="block text-xs text-[#6a6a6a] mb-2"
            >
              Sucursal destino
            </label>
            <div className="relative">
              <select
                id="ms-destino"
                value={destBranchId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setDestBranchId(val === "" ? null : Number(val));
                }}
                className={`${selectClass} pr-10`}
                disabled={pending}
              >
                <option value="" className="bg-white text-[#222222]">
                  Seleccionar destino
                </option>
                {branches
                  .filter((b) => b.id !== sourceBranchId)
                  .map((b) => (
                    <option
                      key={b.id}
                      value={b.id}
                      className="bg-white text-[#222222]"
                    >
                      {b.name}
                    </option>
                  ))}
              </select>
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6a6a6a] pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            <p className="block text-xs text-[#6a6a6a] mt-4 mb-2">
              Productos con stock en la sucursal de origen
            </p>

            {productOptions.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#6a6a6a]">
                No hay productos con stock en esta sucursal
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {productOptions.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 min-h-[44px] rounded-xl hover:bg-[#f8f8f8] transition-colors"
                  >
                    <input
                      type="checkbox"
                      id={`ms-check-${p.id}`}
                      checked={selectedIds.includes(p.id)}
                      onChange={() => toggleSelection(p.id)}
                      aria-label={`Seleccionar ${p.name}`}
                      className="w-5 h-5 accent-[#ff385c]"
                    />
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={`ms-check-${p.id}`}
                        className="block text-sm font-medium text-[#222222] truncate cursor-pointer"
                      >
                        {p.name}
                      </label>
                      <span className="block text-xs text-[#6a6a6a]">
                        Stock: {p.stock}
                      </span>
                      {rowErrors[p.id] && (
                        <span className="block text-xs text-[#c13515] mt-1">
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
                      className="w-20 px-3 py-2 rounded-xl border border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-[#ebebeb] py-3 flex items-center justify-between z-10">
              <span className="text-sm font-semibold text-[#222222]">
                {summaryText}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 mt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 min-h-[44px] text-sm font-medium text-[#222222] bg-[#f8f8f8] rounded-xl hover:bg-[#f2f2f2] transition-colors touch-manipulation"
                disabled={pending}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid || pending}
                className="flex-1 py-4 min-h-[48px] bg-[#ff385c] text-white font-medium rounded-xl hover:bg-[#e00b41] transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              >
                {pending ? "Moviendo…" : "Mover Stock"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
