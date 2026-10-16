"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { getCashClosePreview, closeCash } from "@/app/actions/cash";
import { getUser } from "@/actions/auth";

/**
 * Cierre de caja de una sucursal (S9/S17): pide la sucursal, muestra el total
 * **en efectivo a retirar**, el **de transferencia a verificar** y el mixto, y
 * guarda el corte. Los métodos con total 0 no se muestran, porque no hay nada
 * que retirar ni verificar (S9). No toca stock: ordena la plata.
 *
 * Es hermana de `CashMovementsModal` (el libro de plata de la misma sucursal).
 */
export interface CashCloseModalProps {
  open: boolean;
  onClose: () => void;
  branches: Array<{ id: number; name: string }>;
  onConfirm: () => void;
}

type Resumen = {
  branchName: string;
  since: string | null;
  cashTotal: number;
  transferTotal: number;
  mixedTotal: number;
  total: number;
  salesCount: number;
};

const plata = (monto: number) => `$${monto.toFixed(2)}`;

const fechaCierre = (iso: string) => {
  const [fecha, hora] = iso.split("T");
  return `${fecha.split("-").reverse().join("/")} ${hora.slice(0, 5)}`;
};

export const CashCloseModal = ({
  open,
  onClose,
  branches,
  onConfirm,
}: CashCloseModalProps) => {
  const [branchId, setBranchId] = useState<number | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reset = () => {
    setBranchId(null);
    setResumen(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleContinuar = async () => {
    if (branchId === null) return;

    setLoading(true);
    setError(null);
    setResumen(null);

    const result = await getCashClosePreview({ branchId });
    setLoading(false);

    if (!result?.success || !result.data) {
      setError(result?.error ?? "Error al calcular el cierre de caja");
      return;
    }

    setResumen(result.data as unknown as Resumen);
  };

  const handleConfirmar = async () => {
    if (branchId === null) return;

    setPending(true);
    const user = await getUser();
    const result = await closeCash({
      branchId,
      ...(user?.email ? { performedBy: user.email } : {}),
    });
    setPending(false);

    if (result.success) {
      await Swal.fire({
        title: "Caja cerrada",
        text: `Se guardó el corte de ${resumen?.branchName ?? "la sucursal"} por ${plata(resumen?.total ?? 0)}`,
        icon: "success",
        confirmButtonColor: "#ff385c",
        background: "#ffffff",
        color: "#222222",
      });
      reset();
      onConfirm();
      onClose();
      return;
    }

    setError(result.error ?? "Error al cerrar la caja");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-[60] flex items-center justify-center"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-close-title"
    >
      <div
        className="bg-white w-full max-w-xl rounded-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="cash-close-title" className="text-xl font-semibold text-[#222222]">
            Cerrar caja
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[#f2f2f2] transition-colors touch-manipulation"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label htmlFor="cc-sucursal" className="block text-xs text-[#6a6a6a] mb-2">
          Sucursal
        </label>
        <div className="relative">
          <select
            id="cc-sucursal"
            value={branchId ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setBranchId(value === "" ? null : Number(value));
              setResumen(null);
              setError(null);
            }}
            className="w-full px-3 py-3 min-h-[48px] rounded-xl border border-gray-200 bg-white focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all text-sm touch-manipulation appearance-none cursor-pointer pr-10"
          >
            <option value="" className="bg-white text-[#222222]">
              Seleccionar sucursal
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="bg-white text-[#222222]">
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {error && <p className="mt-3 text-sm text-[#c13515]">{error}</p>}

        {loading && <p className="mt-4 text-sm text-[#6a6a6a]">Calculando el cierre...</p>}

        {!resumen && !loading && (
          <button
            type="button"
            onClick={handleContinuar}
            disabled={branchId === null}
            className="w-full py-4 mt-6 min-h-[48px] bg-[#ff385c] text-white font-medium rounded-xl hover:bg-[#e00b41] transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            Continuar
          </button>
        )}

        {resumen && !loading && (
          <>
            <p className="mt-4 text-sm text-[#6a6a6a]">
              {resumen.since
                ? `Ventas desde el último cierre (${fechaCierre(resumen.since)})`
                : "Es el primer cierre de esta sucursal"}
            </p>

            <div className="mt-3 space-y-2">
              {resumen.cashTotal > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f7f7] px-4 py-3">
                  <span className="text-sm text-[#222222]">Efectivo a retirar</span>
                  <span className="text-sm font-semibold text-green-700">
                    {plata(resumen.cashTotal)}
                  </span>
                </div>
              )}

              {resumen.transferTotal > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f7f7] px-4 py-3">
                  <span className="text-sm text-[#222222]">Transferencia a verificar</span>
                  <span className="text-sm font-semibold text-green-700">
                    {plata(resumen.transferTotal)}
                  </span>
                </div>
              )}

              {resumen.mixedTotal > 0 && (
                <div className="rounded-xl bg-[#f7f7f7] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[#222222]">Mixto</span>
                    <span className="text-sm font-semibold text-green-700">
                      {plata(resumen.mixedTotal)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6a6a6a]">
                    La venta no guarda cuánto fue de cada medio: verificá el total aparte.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f2f2f2] px-4 py-3">
                <span className="text-sm font-medium text-[#222222]">Total de ventas</span>
                <span className="text-sm font-semibold text-[#222222]">
                  {plata(resumen.total)}
                </span>
              </div>
              <p className="text-xs text-[#6a6a6a]">
                {resumen.salesCount} {resumen.salesCount === 1 ? "venta" : "ventas"} desde el
                último cierre
              </p>
            </div>

            <button
              type="button"
              onClick={handleConfirmar}
              disabled={pending}
              className="w-full py-4 mt-6 min-h-[48px] bg-[#ff385c] text-white font-medium rounded-xl hover:bg-[#e00b41] transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {pending ? "Cerrando..." : "Cerrar caja"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
