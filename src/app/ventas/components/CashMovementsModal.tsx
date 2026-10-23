"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { getCashMovements, registerCashMovement } from "@/app/actions/cash";
import { getUser } from "@/actions/auth";
import { toLocalDateKey } from "@/lib/dates";
import { BranchPicker } from "@/components/ui/BranchPicker";

/**
 * Plata de la caja de una sucursal: ingresos y egresos que no son ventas
 * (correcciones de dinero, S14). Pide la sucursal primero, después muestra el
 * libro de esa sucursal con sus totales y deja registrar un movimiento.
 *
 * Es hermana de `StockAdjustmentModal` (movimientos de productos, en
 * `/inventario`): mismo libro, otra cosa que se mueve.
 */
export interface CashMovementsModalProps {
  open: boolean;
  onClose: () => void;
  branches: Array<{ id: number; name: string }>;
  onConfirm: () => void;
}

type Tipo = "INGRESO" | "EGRESO";

type Movimiento = {
  id: number;
  type: Tipo;
  method: string;
  amount: number;
  date: string;
  description: string | null;
};

type Totales = { ingresos: number; egresos: number; balance: number };

const METODOS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
];

const TIPOS: Array<{ value: Tipo; label: string; ayuda: string }> = [
  { value: "INGRESO", label: "Ingreso", ayuda: "Entra plata a la caja" },
  { value: "EGRESO", label: "Egreso", ayuda: "Sale plata de la caja" },
];

const plata = (monto: number) => `$${monto.toFixed(2)}`;

export const CashMovementsModal = ({
  open,
  onClose,
  branches,
  onConfirm,
}: CashMovementsModalProps) => {
  const [branchId, setBranchId] = useState<number | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [totales, setTotales] = useState<Totales>({ ingresos: 0, egresos: 0, balance: 0 });
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("INGRESO");
  const [method, setMethod] = useState("EFECTIVO");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => toLocalDateKey(new Date()));
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const cargar = async (branch: number) => {
    setLoading(true);
    setError(null);

    const result = await getCashMovements({ branchId: branch });
    setLoading(false);

    if (!result?.success || !result.data) {
      setError(result?.error ?? "Error al obtener los movimientos de caja");
      setMovimientos([]);
      return;
    }

    setMovimientos(result.data.items as unknown as Movimiento[]);
    setTotales(result.data.totals);
  };

  const reset = () => {
    setBranchId(null);
    setMovimientos([]);
    setTotales({ ingresos: 0, egresos: 0, balance: 0 });
    setTipo("INGRESO");
    setMethod("EFECTIVO");
    setAmount("");
    setDate(toLocalDateKey(new Date()));
    setDetalle("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (branchId === null) return;

    const monto = Number(amount);
    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }

    setPending(true);
    const user = await getUser();
    const result = await registerCashMovement({
      branchId,
      type: tipo,
      method,
      amount: monto,
      date,
      ...(detalle.trim() ? { description: detalle.trim() } : {}),
      ...(user?.email ? { performedBy: user.email } : {}),
    });
    setPending(false);

    if (result.success) {
      await Swal.fire({
        title: tipo === "INGRESO" ? "Ingreso registrado" : "Egreso registrado",
        text: `${plata(monto)} en la caja de la sucursal`,
        icon: "success",
        confirmButtonColor: "#6d28d9",
      });
      setAmount("");
      setDetalle("");
      setError(null);
      await cargar(branchId);
      onConfirm();
      return;
    }

    setError(result.error ?? "Error al registrar el movimiento de caja");
  };

  if (!open) return null;

  const sucursalElegida = branches.find((b) => b.id === branchId);

  return (
    <div
      className="fixed inset-0 bg-scrim backdrop-blur-md z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-movements-title"
    >
      <div
        className="bg-surface w-full max-w-xl md:max-w-3xl rounded-2xl p-6 animate-scale-in max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="cash-movements-title" className="text-xl font-semibold text-ink">
            Movimientos de caja
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

        <p className="block text-xs text-ink-muted mb-2">Sucursal</p>
        <BranchPicker
          branches={branches}
          value={branchId}
          onChange={(id) => {
            setBranchId(id);
            setError(null);
            void cargar(id);
          }}
          label="Sucursal"
        />

        {branchId === null && (
          <p className="mt-4 text-sm text-ink-muted">
            Elegí la sucursal para ver su caja y registrar plata.
          </p>
        )}

        {/* Desde `md` el registro va a la izquierda y el libro de la sucursal con
            sus totales a la derecha. En celular se apila en el orden de siempre:
            primero el contexto (los totales del libro) y después la acción, por eso
            el `order` invertido. */}
        {branchId !== null && (
          <div className="mt-4 md:grid md:grid-cols-2 md:gap-5 md:items-start">
            {/* En este modal la lista larga es el libro de la derecha, así que la
                columna que se pega es la del registro: la acción queda a la vista
                en lugar de la franja en blanco debajo del formulario. */}
            <form
              onSubmit={handleSubmit}
              className="order-2 rounded-2xl border border-hairline bg-surface-soft p-4 md:order-1 md:sticky md:top-4"
            >
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                ¿Entra o sale plata?
              </h3>
              <div className="mt-3 flex gap-2">
                {TIPOS.map((opcion) => (
                  <button
                    key={opcion.value}
                    type="button"
                    onClick={() => setTipo(opcion.value)}
                    aria-pressed={tipo === opcion.value}
                    className={`btn flex-1 ${
                      tipo === opcion.value ? "btn-active" : "btn-ghost"
                    }`}
                  >
                    {opcion.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                {TIPOS.find((t) => t.value === tipo)?.ayuda}
              </p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cm-metodo" className="block text-xs text-ink-muted mb-2">
                    Medio
                  </label>
                  <select
                    id="cm-metodo"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full px-3 py-3 min-h-[48px] rounded-xl border border-hairline bg-surface focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none transition-all text-sm touch-manipulation appearance-none cursor-pointer"
                  >
                    {METODOS.map((m) => (
                      <option key={m.value} value={m.value} className="bg-surface text-ink">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cm-monto" className="block text-xs text-ink-muted mb-2">
                    Monto
                  </label>
                  <input
                    id="cm-monto"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-3 min-h-[48px] rounded-xl border border-hairline bg-surface focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none transition-all text-sm touch-manipulation"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label htmlFor="cm-fecha" className="block text-xs text-ink-muted mb-2">
                  Fecha
                </label>
                <input
                  id="cm-fecha"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-3 min-h-[48px] rounded-xl border border-hairline bg-surface focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none transition-all text-sm touch-manipulation"
                />
              </div>

              <div className="mt-3">
                <label htmlFor="cm-detalle" className="block text-xs text-ink-muted mb-2">
                  Detalle (opcional)
                </label>
                <input
                  id="cm-detalle"
                  type="text"
                  value={detalle}
                  onChange={(e) => setDetalle(e.target.value)}
                  maxLength={200}
                  placeholder="Motivo del movimiento"
                  className="w-full px-3 py-3 min-h-[48px] rounded-xl border border-hairline bg-surface focus:border-accent focus:ring-2 focus:ring-accent/30 outline-none transition-all text-sm touch-manipulation"
                />
              </div>

              {error && <p className="mt-3 text-sm text-error">{error}</p>}

              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary mt-4 w-full md:w-auto"
              >
                {pending ? "Registrando..." : `Registrar ${tipo === "INGRESO" ? "ingreso" : "egreso"}`}
              </button>
            </form>

            <section className="order-1 mt-4 rounded-2xl border border-hairline bg-surface-soft p-4 md:order-2 md:mt-0">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Últimos movimientos de {sucursalElegida?.name ?? "la sucursal"}
              </h3>

              {/* Totales del libro: etiqueta a la izquierda, monto a la derecha. */}
              <dl className="mt-3 space-y-2">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-ink-body">Ingresos</dt>
                  <dd className="text-sm font-semibold text-positive tabular-nums">
                    {plata(totales.ingresos)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-ink-body">Egresos</dt>
                  <dd className="text-sm font-semibold text-error tabular-nums">
                    {plata(totales.egresos)}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-hairline pt-3">
                <span className="text-sm font-medium text-ink">Saldo</span>
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {plata(totales.balance)}
                </span>
              </div>

              {loading && (
                <p className="mt-3 text-sm text-ink-muted">Cargando movimientos...</p>
              )}

              {!loading && movimientos.length === 0 && (
                <p className="mt-3 text-sm text-ink-muted">
                  Todavía no hay movimientos de caja en esta sucursal.
                </p>
              )}

              <ul className="mt-3 space-y-2">
                {movimientos.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-hairline bg-surface px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        {m.date.slice(0, 10).split("-").reverse().join("/")} ·{" "}
                        {m.method === "EFECTIVO" ? "Efectivo" : "Transferencia"}
                      </p>
                      {m.description && (
                        <p className="text-xs text-ink-muted truncate">{m.description}</p>
                      )}
                    </div>
                    <span
                      className={`text-sm font-semibold whitespace-nowrap tabular-nums ${
                        m.type === "INGRESO" ? "text-positive" : "text-error"
                      }`}
                    >
                      {m.type === "INGRESO" ? "+" : "-"}
                      {plata(m.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
