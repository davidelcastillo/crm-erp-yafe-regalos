"use client";

import { useState } from "react";
import { Customer } from "@prisma/client";
import { getCustomerHistory } from "@/app/actions/customer";
import { RegistrarPagoModal } from "./RegistrarPagoModal";

interface Sale {
  id: number;
  date: string;
  totalAmount: number;
  amountPaid: number;
  pendingBalance: number;
}

interface Payment {
  id: number;
  date: string;
  amount: number;
}

interface CustomerHistory {
  sales: Sale[];
  payments: Payment[];
}

interface ClienteCardProps {
  customer: Customer;
}

export function ClienteCard({ customer }: ClienteCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyData, setHistoryData] = useState<CustomerHistory | null>(null);
  const [activeTab, setActiveTab] = useState<"sales" | "payments">("sales");
  const [pagoOpen, setPagoOpen] = useState(false);

  const balance = Number(customer.totalBalance);
  const hasDebt = balance > 0;

  // Load history when expanded
  const handleToggleHistory = async () => {
    if (!showHistory && !historyData) {
      setLoadingHistory(true);
      const result = await getCustomerHistory({ customerId: customer.id });
      if (result.success && result.data) {
        setHistoryData(result.data as unknown as CustomerHistory);
      }
      setLoadingHistory(false);
    }
    setShowHistory(!showHistory);
  };

  // El pago lo registra `RegistrarPagoModal`; acá solo se refresca la lista,
  // que es un Server Component con la deuda ya recalculada.
  const handlePaid = () => {
    window.location.reload();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="glass rounded-2xl border border-black/5 p-4">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-ink break-words">
            {customer.name} {customer.surname}
          </h3>
          <p className="text-sm text-ink-muted">
            Deuda:{" "}
            <span className={hasDebt ? "text-[#b91c1c] font-medium" : "text-[#15803d]"}>
              ${balance.toFixed(2)}
            </span>
          </p>
        </div>
        <div
          className={`shrink-0 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${
            hasDebt ? "bg-[#b91c1c]" : "bg-[#15803d]"
          }`}
        >
          {hasDebt ? "Deudor" : "Al día"}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-black/5">
        <button
          onClick={handleToggleHistory}
          disabled={loadingHistory}
          className="btn btn-secondary flex-1 whitespace-nowrap"
        >
          {loadingHistory ? "Cargando..." : showHistory ? "Ocultar" : "Ver Historial"}
        </button>
        {hasDebt && (
          <button
            onClick={() => setPagoOpen(true)}
            className="btn btn-primary flex-1 whitespace-nowrap"
          >
            Registrar Pago
          </button>
        )}
      </div>

      {showHistory && historyData && (
        <div className="mt-3 pt-3 border-t border-black/5">
          <div className="flex gap-1 mb-3">
            {/* Control segmentado: la pestaña elegida va `btn-active`, la otra `btn-secondary`. */}
            <button
              onClick={() => setActiveTab("sales")}
              className={`btn flex-1 ${activeTab === "sales" ? "btn-active" : "btn-secondary"}`}
            >
              Ventas ({historyData.sales.length})
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`btn flex-1 ${activeTab === "payments" ? "btn-active" : "btn-secondary"}`}
            >
              Pagos ({historyData.payments.length})
            </button>
          </div>

          {activeTab === "sales" && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {historyData.sales.length === 0 ? (
                <p className="text-sm text-ink-muted text-center py-2">
                  Sin ventas registradas
                </p>
              ) : (
                historyData.sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-2 bg-[#f9f9f9] rounded-lg text-sm"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-ink-muted">{formatDate(sale.date)}</span>
                      <span className="font-medium shrink-0">${sale.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 text-xs text-ink-muted">
                      <span>Pagado: ${sale.amountPaid.toFixed(2)}</span>
                      <span
                        className={`shrink-0 ${
                          sale.pendingBalance > 0
                            ? "text-[#b91c1c]"
                            : "text-[#15803d]"
                        }`}
                      >
                        Pendiente: ${sale.pendingBalance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {historyData.payments.length === 0 ? (
                <p className="text-sm text-ink-muted text-center py-2">
                  Sin pagos registrados
                </p>
              ) : (
                historyData.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="p-2 bg-[#f9f9f9] rounded-lg text-sm flex justify-between items-center gap-2"
                  >
                    <span className="text-ink-muted">
                      {formatDate(payment.date)}
                    </span>
                    <span className="font-medium text-[#15803d] shrink-0">
                      +${payment.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <RegistrarPagoModal
        open={pagoOpen}
        customer={customer}
        onClose={() => setPagoOpen(false)}
        onPaid={handlePaid}
      />
    </div>
  );
}