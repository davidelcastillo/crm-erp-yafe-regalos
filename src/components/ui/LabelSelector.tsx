"use client";

import { useMemo, useState } from "react";
import { getBranchProductsForExport, type ExportProductRow } from "@/app/actions/inventory";
import { generateProductLabels } from "@/actions/label-print";
import { calculateSheetCount } from "@/lib/label-layout";
import { BranchPicker } from "@/components/ui/BranchPicker";
import { Spinner } from "@/components/ui/Spinner";

type BranchOption = { id: number; name: string };
type Step = 1 | 2;

export interface LabelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  branches: BranchOption[];
}

/**
 * Wizard de etiquetas de precio (S3/S6):
 *   1. Elegir la sucursal (botón deshabilitado hasta elegir).
 *   2. Elegir los productos **activos con stock > 0** de esa sucursal, con
 *      cantidad por producto y «Todos». La cantidad arranca en el **stock de esa
 *      sucursal** (es lo que se va a etiquetar) y el usuario la puede corregir;
 *      lo escrito a mano manda sobre el stock. El resumen muestra en vivo
 *      cuántas etiquetas y hojas A4 salen.
 */
export function LabelSelector({ isOpen, onClose, branches }: LabelSelectorProps) {
  const [step, setStep] = useState<Step>(1);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [rows, setRows] = useState<ExportProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const cargarProductos = async (branch: number) => {
    setLoading(true);
    setLoadError(null);
    setRows([]);

    const result = await getBranchProductsForExport({ branchId: branch });
    setLoading(false);

    if (!result?.success || !Array.isArray(result.data)) {
      setLoadError(result?.error ?? "Error al obtener los productos");
      return;
    }

    setRows(result.data as ExportProductRow[]);
  };

  const handleContinue = () => {
    if (branchId === null) return;
    setSelectedIds([]);
    setQuantities({});
    setSearch("");
    setGenerateError(null);
    setStep(2);
    void cargarProductos(branchId);
  };

  const handleClose = () => {
    setStep(1);
    setBranchId(null);
    setRows([]);
    setLoadError(null);
    setSearch("");
    setSelectedIds([]);
    setQuantities({});
    setGenerateError(null);
    onClose();
  };

  const visibles = useMemo(() => {
    const texto = search.trim().toLowerCase();
    if (!texto) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(texto) ||
        row.code.toLowerCase().includes(texto)
    );
  }, [rows, search]);

  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  /**
   * Cantidad que propone el wizard: el stock de esa sucursal, acotado al rango
   * que valida el servidor (1..999). El campo arranca con este valor, así
   * «Todos» imprime tantas etiquetas como unidades hay y no una sola.
   */
  const cantidadSugerida = (row: ExportProductRow) =>
    Math.min(Math.max(row.stock, 1), 999);

  /** Lo que el usuario escribió si escribió algo; si no, el stock. */
  const cantidadDe = (id: number) => {
    const row = rows.find((fila) => fila.id === id);
    const escrito = quantities[id];
    const cantidad =
      escrito === undefined
        ? cantidadSugerida(row ?? ({ stock: 1 } as ExportProductRow))
        : parseInt(escrito, 10);
    return Number.isInteger(cantidad) && cantidad > 0 ? cantidad : 0;
  };

  // Cantidad de etiquetas: solo cuentan las filas tildadas con cantidad válida.
  const totalLabels = selectedIds.reduce((total, id) => total + cantidadDe(id), 0);
  const totalSheets = calculateSheetCount(totalLabels);

  // Tildar no escribe cantidades: el campo muestra el stock y `quantities` sólo
  // guarda lo que el usuario corrigió, así destildar y volver a tildar no lo pierde.
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selected) => selected !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : rows.map((row) => row.id));
  };

  const downloadPdf = (pdfBase64: string, filename: string) => {
    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
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
    if (branchId === null || totalLabels === 0) return;
    setGenerating(true);
    setGenerateError(null);

    // Las selecciones van en el orden de la lista, con su cantidad.
    const result = await generateProductLabels({
      branchId,
      selections: rows
        .filter((row) => selectedIds.includes(row.id))
        .map((row) => ({ productId: row.id, quantity: cantidadDe(row.id) })),
    });

    if (result.success) {
      downloadPdf(result.data.pdfBase64, result.data.filename);
    } else {
      setGenerateError(result.error);
    }
    setGenerating(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-selector-title"
    >
      <div
        className="bg-white w-full max-w-xl md:max-w-4xl rounded-2xl p-6 animate-scale-in max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="label-selector-title" className="text-xl font-semibold text-[#222222]">
            Etiquetas de precio
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-icon btn-round hover:bg-[#f2f2f2]"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs font-medium uppercase tracking-wide text-[#6a6a6a] mb-4">
          Paso {step} de 2
        </p>

        {step === 1 && (
          <div>
            <h3 className="text-base font-semibold text-[#222222] mb-3">Elegí la sucursal</h3>
            <BranchPicker
              branches={branches}
              value={branchId}
              onChange={(id) => setBranchId(id)}
              columns={2}
              label="Sucursal"
            />
            <div className="md:flex md:justify-end">
              <button
                type="button"
                onClick={handleContinue}
                disabled={branchId === null}
                className="btn btn-primary w-full mt-6 md:w-auto"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="md:grid md:grid-cols-2 md:gap-5 md:items-start">
            <section className="min-w-0">
              <h3 className="text-base font-semibold text-[#222222] mb-3">
                Elegí los productos
              </h3>

              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o código"
                aria-label="Buscar producto"
                className="w-full px-3 py-3 mb-3 min-h-[48px] rounded-xl border border-gray-200 focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/30 outline-none transition-all text-sm touch-manipulation"
              />

              {loading && <Spinner label="Cargando productos..." />}

              {!loading && loadError && (
                <p className="py-8 text-center text-sm text-[#c13515]">{loadError}</p>
              )}

              {!loading && !loadError && rows.length === 0 && (
                <p className="py-8 text-center text-sm text-[#6a6a6a]">
                  No hay productos con stock en esta sucursal
                </p>
              )}

              {!loading && !loadError && rows.length > 0 && (
                <label className="flex items-center gap-3 p-3 mb-2 min-h-[44px] rounded-xl bg-[#f8f8f8] cursor-pointer touch-manipulation">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-5 h-5 accent-[#ec4899]"
                  />
                  <span className="text-sm font-medium text-[#222222]">Todos</span>
                </label>
              )}

              {!loading && !loadError && visibles.length > 0 && (
                <div
                  role="group"
                  aria-label="Productos con stock"
                  className="space-y-2 max-h-60 overflow-y-auto"
                >
                  {visibles.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-3 p-3 min-h-[44px] rounded-xl hover:bg-[#f8f8f8] transition-colors"
                    >
                      <input
                        type="checkbox"
                        id={`label-check-${row.id}`}
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelection(row.id)}
                        aria-label={`Seleccionar ${row.name}`}
                        className="w-5 h-5 accent-[#ec4899]"
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`label-check-${row.id}`}
                          className="block text-sm font-medium text-[#222222] truncate cursor-pointer"
                        >
                          {row.name}
                        </label>
                        <span className="block text-xs text-[#6a6a6a]">
                          {row.code} · Stock: {row.stock}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={quantities[row.id] ?? String(cantidadSugerida(row))}
                        onChange={(e) =>
                          setQuantities((prev) => ({ ...prev, [row.id]: e.target.value }))
                        }
                        disabled={!selectedIds.includes(row.id) || generating}
                        aria-label={`Cantidad ${row.name}`}
                        className="w-20 px-3 py-3 rounded-xl border border-gray-200 focus:border-[#ec4899] focus:ring-2 focus:ring-[#ec4899]/30 outline-none transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed tabular-nums text-right"
                      />
                    </div>
                  ))}
                </div>
              )}

              {!loading && !loadError && rows.length > 0 && visibles.length === 0 && (
                <p className="py-6 text-center text-sm text-[#6a6a6a]">
                  No hay productos que coincidan con la búsqueda
                </p>
              )}
            </section>

            {/* Resumen en vivo: en celular cae debajo de la lista; desde `md`
                va a la derecha y queda pegado. */}
            <aside className="mt-4 rounded-2xl border border-black/10 bg-[#f7f7f7] p-4 md:mt-0 md:sticky md:top-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[#6a6a6a]">
                Resumen
              </h3>

              <p className="mt-2 text-sm font-semibold text-brand-rosa-texto tabular-nums">
                {totalLabels} {totalLabels === 1 ? "etiqueta" : "etiquetas"} en {totalSheets}{" "}
                {totalSheets === 1 ? "hoja" : "hojas"} A4
              </p>

              {generateError && (
                <p className="mt-3 text-sm text-[#c13515]" role="alert">
                  {generateError}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn btn-secondary">
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={totalLabels === 0 || generating}
                  className="btn btn-primary flex-1 md:flex-none"
                >
                  {generating ? "Generando..." : "Descargar PDF"}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
