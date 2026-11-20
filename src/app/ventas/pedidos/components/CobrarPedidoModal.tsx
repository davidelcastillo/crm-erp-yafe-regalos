"use client";

import { useEffect, useState } from "react";
import { cobrarPedido, entregarPedido, getPedido } from "@/app/actions/pedido";

/**
 * Paso de cobro de un pedido reservado (U5, S3): «arrastrar no alcanza para
 * pagar». Los números son los del servidor (`getPedido`): total, señas y saldo.
 * Del cliente solo sale el medio; el saldo lo calcula y lo vuelve a chequear la
 * acción al cobrar, junto con el stock.
 *
 * Con `entregar` es la entrega contra pago (U7, L8-2): mismo saldo y mismo
 * medio, pero el pedido salta a ENTREGADO y la venta se registra en ese momento.
 */
export interface CobrarPedidoModalProps {
  open: boolean;
  pedidoId: number | null;
  onClose: () => void;
  onCobrado: () => void;
  /** Entrega contra pago: cobra y entrega en un solo paso. */
  entregar?: boolean;
}

type PedidoParaCobrar = {
  id: number;
  numero: string;
  total: number;
  senas: number;
  saldo: number;
  customer: { name: string; surname: string };
};

const MEDIOS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
];

const plata = (monto: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(monto);

export const CobrarPedidoModal = ({
  open,
  pedidoId,
  onClose,
  onCobrado,
  entregar = false,
}: CobrarPedidoModalProps) => {
  const [pedido, setPedido] = useState<PedidoParaCobrar | null>(null);
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // El pedido se lee al abrir, con el setState diferido como en el resto de los
  // modales de la casa.
  useEffect(() => {
    if (!open || pedidoId === null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const result = await getPedido(pedidoId);
        if (cancelled) return;
        if (!result.success || !result.data) {
          setError(result.error ?? "Error al obtener el pedido");
          return;
        }
        setPedido(result.data as unknown as PedidoParaCobrar);
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, pedidoId]);

  const handleClose = () => {
    setPedido(null);
    setError(null);
    setMetodo("EFECTIVO");
    onClose();
  };

  const handleCobrar = async () => {
    if (!pedido) return;
    setError(null);
    setPending(true);
    const result = entregar
      ? await entregarPedido({ id: pedido.id, metodo })
      : await cobrarPedido({ id: pedido.id, metodo });
    setPending(false);
    if (!result.success) {
      setError(result.error ?? "Error al cobrar el pedido");
      return;
    }
    setPedido(null);
    onCobrado();
    onClose();
  };

  if (!open) return null;

  const cliente = pedido
    ? `${pedido.customer.name} ${pedido.customer.surname}`.trim()
    : "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-scrim backdrop-blur-md md:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cobrar-pedido-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-6 animate-slide-up md:rounded-2xl md:animate-scale-in">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="cobrar-pedido-title" className="min-w-0 text-xl font-semibold text-ink">
            {entregar ? "Entregar y cobrar" : "Cobrar pedido"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-icon btn-round hover:bg-surface-strong"
            aria-label="Cerrar"
          >
            <svg className="h-6 w-6 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!pedido && !error && <p className="py-8 text-center text-ink-muted">Cargando pedido…</p>}

        {pedido && (
          <>
            <div className="min-w-0">
              <p className="font-semibold text-ink">{pedido.numero}</p>
              <p className="truncate text-sm text-ink-muted">{cliente}</p>
            </div>

            <dl className="mt-4 space-y-1 rounded-xl bg-surface-soft p-4 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Total</dt>
                <dd className="tabular-nums text-ink">{plata(pedido.total)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Señas</dt>
                <dd className="tabular-nums text-ink">{plata(pedido.senas)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 font-semibold">
                <dt className="text-ink">Saldo a cobrar</dt>
                <dd className="tabular-nums text-ink">{plata(pedido.saldo)}</dd>
              </div>
            </dl>

            <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="cobro-medio">
              Medio de pago
            </label>
            <select
              id="cobro-medio"
              value={metodo}
              onChange={(event) => setMetodo(event.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-hairline bg-surface px-3 py-3 text-base text-ink focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none touch-manipulation"
            >
              {MEDIOS.map((medio) => (
                <option key={medio.value} value={medio.value}>
                  {medio.label}
                </option>
              ))}
            </select>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-error-surface px-3 py-2 text-sm text-error-ink">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <button type="button" onClick={handleClose} className="btn btn-ghost">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCobrar}
            disabled={pending || !pedido}
            className="btn btn-primary"
          >
            {pending ? "Cobrando…" : entregar ? "Cobrar y entregar" : "Cobrar"}
          </button>
        </div>
      </div>
    </div>
  );
};
