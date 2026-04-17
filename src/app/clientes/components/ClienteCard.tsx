"use client";

import { useState } from "react";
import { Customer } from "@prisma/client";
import { registerPayment, getCustomerHistory } from "@/app/actions/customer";
import Swal from "sweetalert2";

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

  const handlePayment = async () => {
    const result = await Swal.fire({
      title: "Registrar Pago",
      html: `
        <p class="text-sm text-[#6a6a6a] mb-2">Cliente: <strong>${customer.name} ${customer.surname}</strong></p>
        <p class="text-lg font-bold text-[#ef4444] mb-4">Deuda actual: $${balance.toFixed(2)}</p>
        <input type="number" id="paymentAmount" name="amount" class="swal2-input" placeholder="Monto a pagar" min="0" step="0.01">
      `,
      preConfirm: () => {
        const inputValue = (document.getElementById("paymentAmount") as HTMLInputElement)?.value;
        
        // Debug log
        console.log("Input value (raw):", inputValue);
        
        const amount = Number(inputValue);
        console.log("Amount converted:", amount, "Type:", typeof amount);
        
        if (!inputValue || inputValue.trim() === "") {
          Swal.showValidationMessage("Ingrese un monto");
          return false;
        }
        
        if (!amount || amount <= 0) {
          Swal.showValidationMessage("El monto debe ser mayor a 0");
          return false;
        }
        
        if (amount > balance) {
          Swal.showValidationMessage("El monto no puede exceder la deuda");
          return false;
        }
        
        console.log("Returning amount:", amount);
        return amount;
      },
      confirmButtonText: "Registrar Pago",
      confirmButtonColor: "#22c55e",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      cancelButtonColor: "#6b7280",
    });

    if (result.isConfirmed && result.value) {
      try {
        const amount = Number(result.value);
        
        console.log("Sending to server:", {
          customerId: customer.id,
          amount: amount,
          amountType: typeof amount
        });
        
        const res = await registerPayment({
          customerId: customer.id,
          amount: amount,
        });

        if (res.success) {
          await Swal.fire({
            title: "¡Pago registrado!",
            text: `Se registraron $${amount.toFixed(2)} de deuda`,
            icon: "success",
            confirmButtonColor: "#22c55e",
            timer: 1500,
            showConfirmButton: false,
          });
          window.location.reload();
        } else {
          await Swal.fire({
            title: "Error",
            text: res.error || "No se pudo registrar el pago",
            icon: "error",
            confirmButtonColor: "#ef4444",
          });
        }
      } catch (error) {
        console.error("Error registering payment:", error);
        await Swal.fire({
          title: "Error",
          text: "Error al registrar el pago",
          icon: "error",
          confirmButtonColor: "#ef4444",
        });
      }
    }
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
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-[#222222]">
            {customer.name} {customer.surname}
          </h3>
          <p className="text-sm text-[#6a6a6a]">
            Deuda:{" "}
            <span className={hasDebt ? "text-[#ef4444] font-medium" : "text-[#22c55e]"}>
              ${balance.toFixed(2)}
            </span>
          </p>
        </div>
        <div
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${
            hasDebt ? "bg-[#ef4444]" : "bg-[#22c55e]"
          }`}
        >
          {hasDebt ? "Deudor" : "Al día"}
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={handleToggleHistory}
          disabled={loadingHistory}
          className="flex-1 py-2 px-3 text-sm font-medium text-[#3f3f3f] bg-[#f2f2f2] rounded-lg hover:bg-[#e5e5e5] transition-colors disabled:opacity-50"
        >
          {loadingHistory ? "Cargando..." : showHistory ? "Ocultar" : "Ver Historial"}
        </button>
        {hasDebt && (
          <button
            onClick={handlePayment}
            className="flex-1 py-2 px-3 text-sm font-medium text-white bg-[#22c55e] rounded-lg hover:bg-[#16a34a] transition-colors"
          >
            Registrar Pago
          </button>
        )}
      </div>

      {showHistory && historyData && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => setActiveTab("sales")}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "sales"
                  ? "bg-[#222222] text-white"
                  : "bg-[#f2f2f2] text-[#6a6a6a]"
              }`}
            >
              Ventas ({historyData.sales.length})
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "payments"
                  ? "bg-[#222222] text-white"
                  : "bg-[#f2f2f2] text-[#6a6a6a]"
              }`}
            >
              Pagos ({historyData.payments.length})
            </button>
          </div>

          {activeTab === "sales" && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {historyData.sales.length === 0 ? (
                <p className="text-sm text-[#6a6a6a] text-center py-2">
                  Sin ventas registradas
                </p>
              ) : (
                historyData.sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-2 bg-[#f9f9f9] rounded-lg text-sm"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[#6a6a6a]">{formatDate(sale.date)}</span>
                      <span className="font-medium">${sale.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-[#6a6a6a]">
                      <span>Pagado: ${sale.amountPaid.toFixed(2)}</span>
                      <span
                        className={
                          sale.pendingBalance > 0
                            ? "text-[#ef4444]"
                            : "text-[#22c55e]"
                        }
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
                <p className="text-sm text-[#6a6a6a] text-center py-2">
                  Sin pagos registrados
                </p>
              ) : (
                historyData.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="p-2 bg-[#f9f9f9] rounded-lg text-sm flex justify-between items-center"
                  >
                    <span className="text-[#6a6a6a]">
                      {formatDate(payment.date)}
                    </span>
                    <span className="font-medium text-[#22c55e]">
                      +${payment.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}