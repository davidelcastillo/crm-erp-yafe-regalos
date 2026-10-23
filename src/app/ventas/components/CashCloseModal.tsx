"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { getCashClosePreview, closeCash } from "@/app/actions/cash";
import { getUser } from "@/actions/auth";
import { BranchPicker } from "@/components/ui/BranchPicker";

/**
 * Cierre de caja de una sucursal (S9/S17): pide la sucursal, muestra el total
 * **en efectivo a retirar**, el **de transferencia a verificar** y el mixto, y
 * guarda el corte. Los métodos con total 0 no se muestran, porque no hay nada
 * que retirar ni verificar (S9). No toca stock: ordena la plata.
 *
 * Cada medio muestra su desglose «ventas + ingresos − egresos» (S3), porque el
 * corte suma y resta los movimientos de caja del período. Un egreso puede dejar
 * el medio en negativo y se muestra así: la caja quedó corta (S5).
 *
 * Es hermana de `CashMovementsModal` (el libro de plata de la misma sucursal).
 */
export interface CashCloseModalProps {
  open: boolean;
  onClose: () => void;
  branches: Array<{ id: number; name: string }>;
  onConfirm: () => void;
}

type Desglose = {
  ventas: number;
  ingresos: number;
  egresos: number;
  total: number;
};

type Resumen = {
  branchName: string;
  since: string | null;
  cashTotal: number;
  transferTotal: number;
  mixedTotal: number;
  total: number;
  salesCount: number;
  desglose: { efectivo: Desglose; transferencia: Desglose; mixto: Desglose };
};

// El menos va adelante del símbolo: `-$75.00`, no `$-75.00`.
const plata = (monto: number) =>
  `${monto < 0 ? "-" : ""}$${Math.abs(monto).toFixed(2)}`;

/** De dónde sale el total del medio: es lo que cierra contra el listado (S3). */
const desgloseTexto = (d: Desglose) =>
  `Ventas ${plata(d.ventas)} + ingresos ${plata(d.ingresos)} − egresos ${plata(d.egresos)}`;

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
        confirmButtonColor: "#6d28d9",
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
      className="fixed inset-0 bg-scrim backdrop-blur-md z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-close-title"
    >
      <div
        className="bg-surface w-full max-w-xl md:max-w-3xl rounded-2xl p-6 animate-scale-in max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="cash-close-title" className="text-xl font-semibold text-ink">
            Cerrar caja
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-icon btn-round hover:bg-surface-strong"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Paso 1: el bloque desaparece cuando ya hay un resumen (antes quedaba
            la lista de sucursales visible en el paso 2). Desde `md` usa el ancho
            en dos columnas en vez de dejar media pantalla en blanco. */}
        {!resumen && (
          <div>
            <p className="block text-xs text-ink-muted mb-2">Sucursal a cerrar</p>
            <BranchPicker
              branches={branches}
              value={branchId}
              onChange={(id) => {
                setBranchId(id);
                setResumen(null);
                setError(null);
              }}
              columns={2}
              label="Sucursal a cerrar"
              emptyLabel="No hay sucursales activas para elegir."
            />

            {error && <p className="mt-3 text-sm text-error">{error}</p>}

            {loading && <p className="mt-4 text-sm text-ink-muted">Calculando el cierre...</p>}

            {!loading && (
              <div className="md:flex md:justify-end">
                <button
                  type="button"
                  onClick={handleContinuar}
                  disabled={branchId === null}
                  className="btn btn-primary w-full mt-6 md:w-auto"
                >
                  Continuar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Paso 2: en celular sigue siendo una sola columna con el botón al final;
            desde `md` los totales a la izquierda y la tarjeta del corte a la derecha. */}
        {resumen && !loading && (
          <>
            {/* Contexto del corte, arriba de las columnas para que las dos
                arranquen alineadas. */}
            <div className="mt-4">
              <p className="text-sm font-semibold text-ink break-words">
                {resumen.branchName}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {resumen.since
                  ? `Ventas desde el último cierre (${fechaCierre(resumen.since)})`
                  : "Es el primer cierre de esta sucursal"}
              </p>
            </div>

            <div className="mt-4 md:grid md:grid-cols-2 md:gap-5 md:items-start">
              {/* Detalle del corte: etiqueta chica y montos alineados a la derecha. */}
              <section className="rounded-2xl border border-hairline bg-surface-soft p-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Detalle del corte
                </h3>

                <dl className="mt-3 space-y-2">
                  {/* 0 = no hay nada que retirar ni verificar; un negativo sí se
                      muestra (S5). */}
                  {resumen.cashTotal !== 0 && (
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-sm text-ink-body">
                        Efectivo
                        <span className="block text-xs text-ink-muted">
                          {desgloseTexto(resumen.desglose.efectivo)}
                        </span>
                      </dt>
                      <dd className="text-sm font-semibold text-ink tabular-nums">
                        {plata(resumen.cashTotal)}
                      </dd>
                    </div>
                  )}

                  {resumen.transferTotal !== 0 && (
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-sm text-ink-body">
                        Transferencia
                        <span className="block text-xs text-ink-muted">
                          {desgloseTexto(resumen.desglose.transferencia)}
                        </span>
                      </dt>
                      <dd className="text-sm font-semibold text-ink tabular-nums">
                        {plata(resumen.transferTotal)}
                      </dd>
                    </div>
                  )}

                  {resumen.mixedTotal !== 0 && (
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-sm text-ink-body">
                        Mixto
                        <span className="block text-xs text-ink-muted">
                          {desgloseTexto(resumen.desglose.mixto)}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          La venta no guarda cuánto fue de cada medio: verificá ese total aparte.
                        </span>
                      </dt>
                      <dd className="text-sm font-semibold text-ink tabular-nums">
                        {plata(resumen.mixedTotal)}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-hairline pt-3">
                  <span className="text-sm font-medium text-ink">Total del corte</span>
                  <span className="text-base font-semibold text-ink tabular-nums">
                    {plata(resumen.total)}
                  </span>
                </div>

                <p className="mt-2 text-xs text-ink-muted">
                  {resumen.salesCount} {resumen.salesCount === 1 ? "venta" : "ventas"} desde el
                  último cierre
                </p>
              </section>

              {/* Lo que se retira: el número que importa, grande, y la acción. */}
              <section className="mt-4 rounded-2xl border border-hairline bg-surface-soft p-4 md:mt-0">
                <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  A retirar
                </h3>
                <p className="mt-1 text-3xl font-bold text-ink tabular-nums">
                  {plata(resumen.cashTotal)}
                </p>
                <p className="mt-1 text-xs text-ink-muted">Efectivo del período</p>

                {resumen.transferTotal > 0 && (
                  <p className="mt-3 text-sm text-ink-body">
                    Verificá{" "}
                    <span className="font-semibold tabular-nums">
                      {plata(resumen.transferTotal)}
                    </span>{" "}
                    por transferencia
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleConfirmar}
                  disabled={pending}
                  className="btn btn-primary mt-4 w-full"
                >
                  {pending ? "Cerrando..." : "Cerrar caja"}
                </button>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
