"use client";

import { useEffect, useState } from "react";
import { registerPayment } from "@/app/actions/customer";

/**
 * Pago de un cliente (S5). Modal del sistema, no SweetAlert2.
 *
 * No hay campo de monto: los pagos parciales ya no se aceptan, así que se cobra
 * la deuda completa. La regla del servidor no cambia (`registerPayment` sigue
 * validando monto positivo y el tope de la deuda); esto es solo la interfaz.
 *
 * Sigue el patrón de modales del proyecto: no se cierra al tocar el fondo (es un
 * modal con datos), sí con Escape, con el botón ✕ o con «Cancelar».
 */
export interface RegistrarPagoModalProps {
  open: boolean;
  customer: { id: number; name: string; surname: string; totalBalance: unknown };
  onClose: () => void;
  /** Se llama una sola vez, cuando el servidor confirmó el pago. */
  onPaid: () => void;
}

export const RegistrarPagoModal = ({
  open,
  customer,
  onClose,
  onPaid,
}: RegistrarPagoModalProps) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrado, setRegistrado] = useState(false);

  const deuda = Number(customer.totalBalance);

  // Cada apertura arranca limpia: el modal se reusa entre clientes.
  useEffect(() => {
    if (!open) {
      setPending(false);
      setError(null);
      setRegistrado(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, pending, onClose]);

  if (!open) return null;

  const handlePagar = async () => {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const result = await registerPayment({ customerId: customer.id, amount: deuda });
      if (!result.success) {
        setError(result.error ?? "No se pudo registrar el pago");
        return;
      }
      setRegistrado(true);
      onPaid();
    } catch {
      setError("Error al registrar el pago");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="registrar-pago-title"
    >
      <div className="bg-white w-full max-w-xl md:max-w-md rounded-2xl p-6 animate-scale-in max-h-[90vh] md:max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 gap-3">
          <h2 id="registrar-pago-title" className="text-xl font-semibold text-[#222222]">
            Registrar pago
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="btn btn-icon btn-round hover:bg-[#f2f2f2]"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="rounded-2xl border border-black/10 bg-[#f7f7f7] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6a6a6a]">Cliente</p>
          <p className="text-base font-semibold text-[#222222] break-words">
            {customer.name} {customer.surname}
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[#6a6a6a]">Deuda</p>
          <p className="text-2xl font-bold tabular-nums text-[#b91c1c]">${deuda.toFixed(2)}</p>
          <p className="mt-3 text-sm text-[#6a6a6a]">
            Se registra el pago completo de la deuda. No se aceptan pagos parciales.
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-[#ffe4ea] px-4 py-3 text-sm text-[#8f0020]">
            {error}
          </p>
        )}

        {registrado ? (
          <div className="mt-4 space-y-3">
            <p role="status" className="rounded-xl bg-[#f2f2f2] px-4 py-3 text-sm text-[#15803d]">
              Pago registrado: ${deuda.toFixed(2)} acreditados a la deuda de {customer.name}.
            </p>
            <button type="button" onClick={onClose} className="btn btn-primary w-full md:w-auto">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="btn btn-secondary w-full md:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePagar}
              disabled={pending}
              className="btn btn-primary w-full md:w-auto"
            >
              {pending ? "Registrando…" : "Registrar pago"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
