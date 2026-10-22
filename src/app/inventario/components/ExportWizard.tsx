"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import type { ExportProductRow } from "@/app/actions/inventory";
import {
  getBranchProductsForExport,
  exportBranchProductsPdf,
} from "@/app/actions/inventory";
import { BranchPicker } from "@/components/ui/BranchPicker";
import { sortProducts } from "@/lib/product-order";

type BranchOption = { id: number; name: string };

type WizardStep = 1 | 2 | 3;

interface ExportWizardProps {
  open: boolean;
  onClose: () => void;
  branches: BranchOption[];
}

/**
 * Wizard de 3 pasos para exportar el inventario de una sucursal a PDF:
 *   1. Seleccionar sucursal (obligatorio, botón deshabilitado hasta elegir).
 *   2. Seleccionar productos con stock (checkboxes + contador).
 *   3. Generar PDF (descarga vía Blob). Los errores no pierden el estado del wizard.
 */
export function ExportWizard({ open, onClose, branches }: ExportWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [rows, setRows] = useState<ExportProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [generating, setGenerating] = useState(false);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === branchId) ?? null,
    [branches, branchId]
  );

  // Al entrar al paso 2 se cargan los productos con stock de la sucursal.
  // getBranchProductsForExport devuelve las filas con su id numérico,
  // que exportBranchProductsPdf usa para re-validar membresía server-side.
  useEffect(() => {
    if (!open || step !== 2 || branchId === null) return;

    let cancelled = false;

    (async () => {
      const rowsResult = await getBranchProductsForExport({ branchId });
      if (cancelled) return;
      setProductsLoading(false);

      if (rowsResult?.success && Array.isArray(rowsResult.data)) {
        setRows(rowsResult.data as ExportProductRow[]);
      } else {
        setProductsError(rowsResult?.error ?? "Error al obtener los productos");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, step, branchId, loadAttempt]);

  const availableProducts = useMemo(
    () => sortProducts(rows.filter((row) => row.stock > 0), "code"),
    [rows]
  );

  const selectedCount = selectedIds.length;

  const allSelected =
    availableProducts.length > 0 && selectedIds.length === availableProducts.length;

  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : availableProducts.map((row) => row.id));

  const handleContinue = () => {
    if (branchId === null) {
      setBranchError("Seleccioná una sucursal para continuar");
      return;
    }
    setProductsLoading(true);
    setProductsError(null);
    setStep(2);
  };

  const toggleProduct = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const downloadPdf = (pdfBase64: string, filename: string) => {
    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], {
      type: "application/pdf",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    if (branchId === null || selectedIds.length === 0) return;
    setGenerating(true);
    const result = await exportBranchProductsPdf({
      branchId,
      selectedProductIds: selectedIds,
      sortBy: "code",
    });
    if (result.success && result.data) {
      downloadPdf(result.data.pdfBase64, result.data.filename);
      await Swal.fire({
        title: "PDF generado",
        text: "El inventario se exportó correctamente",
        icon: "success",
        confirmButtonColor: "#6d28d9",
        background: "#ffffff",
        color: "#222222",
      });
    } else {
      await Swal.fire({
        title: "Error",
        text: result.error || "Error al generar el PDF",
        icon: "error",
        confirmButtonColor: "#dc2626",
        color: "#222222",
      });
    }
    setGenerating(false);
  };

  if (!open) return null;

  const backButton = (target: WizardStep) => (
    <button
      type="button"
      onClick={() => {
        if (target === 2) {
          setProductsLoading(true);
          setProductsError(null);
        }
        setStep(target);
      }}
      className="btn btn-secondary"
    >
      Volver
    </button>
  );

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-wizard-title"
    >
      <div
        className="bg-white w-full max-w-xl md:max-w-4xl rounded-2xl p-6 animate-scale-in max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2
            id="export-wizard-title"
            className="text-xl font-semibold text-[#222222]"
          >
            Exportar productos
          </h2>
          <button
            type="button"
            onClick={onClose}
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

        {step === 1 && (
          <div>
            <h3 className="text-base font-semibold text-[#222222] mb-3">
              Elegí la sucursal
            </h3>
            <p className="block text-xs text-[#6a6a6a] mb-2">Sucursal a exportar</p>
            <BranchPicker
              branches={branches}
              value={branchId}
              onChange={(id) => {
                setBranchId(id);
                setBranchError(null);
              }}
              columns={2}
              label="Sucursal a exportar"
            />
            {branchError && (
              <p className="mt-2 text-sm text-red-600">{branchError}</p>
            )}
            <div className="md:flex md:justify-end">
              <button
                type="button"
                onClick={handleContinue}
                disabled={branchId === null}
                className="btn btn-primary w-full mt-6 md:w-auto"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-base font-semibold text-[#222222] mb-3">
              Seleccionar productos
            </h3>

            <div className="md:grid md:grid-cols-2 md:gap-5 md:items-start">
              <div className="min-w-0">
                {!productsLoading &&
                  !productsError &&
                  availableProducts.length > 0 && (
                    <label className="flex items-center gap-3 p-3 mb-2 min-h-[44px] rounded-xl bg-[#f8f8f8] cursor-pointer touch-manipulation">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="w-5 h-5 accent-[#ec4899]"
                      />
                      <span className="text-sm font-medium text-[#222222]">
                        Todos
                      </span>
                    </label>
                  )}

                {productsLoading && (
                  <div className="flex items-center justify-center py-10">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-[#3b82f6] animate-spin"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      <span className="text-sm text-[#6a6a6a]">
                        Cargando productos...
                      </span>
                    </div>
                  </div>
                )}

                {!productsLoading && productsError && (
                  <div className="text-center py-8">
                    <p className="text-sm text-red-600 mb-4">{productsError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setProductsLoading(true);
                        setProductsError(null);
                        setLoadAttempt((attempt) => attempt + 1);
                      }}
                      className="btn btn-secondary"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {!productsLoading &&
                  !productsError &&
                  availableProducts.length === 0 && (
                    <p className="py-8 text-center text-sm text-[#6a6a6a]">
                      No hay productos con stock en esta sucursal
                    </p>
                  )}

                {!productsLoading &&
                  !productsError &&
                  availableProducts.length > 0 && (
                    <div
                      role="group"
                      aria-label="Productos con stock"
                      className="space-y-2 max-h-60 overflow-y-auto"
                    >
                      {availableProducts.map((row) => (
                        <label
                          key={row.id}
                          className="flex items-center gap-3 p-3 min-h-[44px] rounded-xl hover:bg-[#f8f8f8] transition-colors cursor-pointer touch-manipulation"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            onChange={() => toggleProduct(row.id)}
                            className="w-5 h-5 accent-[#ec4899]"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-[#222222] truncate">
                              {row.name}
                            </span>
                            <span className="block text-xs text-[#6a6a6a]">
                              {row.code} · Stock: {row.stock}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-medium text-[#6a6a6a] tabular-nums">
                            ${row.price.toFixed(2)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
              </div>

              {/* Resumen de lo seleccionado: en celular cae debajo de la lista;
                  desde `md` va a la derecha. */}
              <aside className="mt-4 rounded-2xl border border-black/10 bg-[#f7f7f7] p-4 md:mt-0 md:sticky md:top-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-[#6a6a6a]">
                  Selección
                </h3>
                <p className="mt-2 text-sm font-semibold text-brand-rosa-texto tabular-nums">
                  {selectedCount} seleccionados
                </p>
              </aside>
            </div>

            <div className="flex items-center justify-between gap-3 mt-6 md:justify-end">
              {backButton(1)}
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn btn-primary flex-1 md:flex-none md:w-auto"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="md:max-w-md">
            <h3 className="text-base font-semibold text-[#222222] mb-3">
              Generar PDF
            </h3>

            <div className="rounded-2xl border border-black/10 bg-[#f7f7f7] p-4 space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[#6a6a6a]">
                Resumen
              </h3>
              <div className="flex justify-between items-baseline gap-4">
                <span className="text-sm text-[#6a6a6a]">Sucursal</span>
                <span className="text-sm font-semibold text-[#222222] break-words">
                  {selectedBranch?.name ?? "-"}
                </span>
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <span className="text-sm text-[#6a6a6a]">Seleccionados</span>
                <span className="text-sm font-semibold text-[#222222] tabular-nums">
                  {selectedCount} seleccionados
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-6 md:justify-end">
              {backButton(2)}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={selectedCount === 0 || generating}
                className="btn btn-primary flex-1 md:flex-none md:w-auto"
              >
                {generating ? "Generando..." : "Generar PDF"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
