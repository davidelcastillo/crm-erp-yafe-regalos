"use client";

import { Skeleton } from "@/components/ui/Skeleton";

interface Stats {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  accountsReceivable: number;
}

interface DashboardCardsProps {
  stats: Stats | null | undefined;
  branchLabel?: string;
}

export function DashboardCards({ stats, branchLabel = "(Todas)" }: DashboardCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass rounded-2xl border border-black/5 p-4">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="mt-3 h-6 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // El tono de cada monto es semántico (verde ingreso, rojo egreso, ámbar a cobrar):
  // no se toca aunque la superficie sea la misma para las cuatro tarjetas.
  const cards = [
    {
      label: "Ingresos",
      value: formatCurrency(stats.totalIncome),
      color: "text-[#22c55e]",
    },
    {
      label: "Egresos",
      value: formatCurrency(stats.totalExpense),
      color: "text-[#ef4444]",
    },
    {
      label: "Ganancia Neta",
      value: formatCurrency(stats.netProfit),
      color: stats.netProfit >= 0 ? "text-[#22c55e]" : "text-[#ef4444]",
    },
    {
      label: "Cobrar",
      value: formatCurrency(stats.accountsReceivable),
      color: "text-[#f59e0b]",
    },
  ];

  return (
    <section>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-lg font-semibold text-[#222222]">Resumen</h2>
        <span className="text-sm text-[#6a6a6a] break-words">{branchLabel}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card, index) => (
          <div
            key={index}
            className="glass rounded-2xl border border-black/5 p-4"
          >
            <div className="text-xs text-[#6a6a6a] mb-1">{card.label}</div>
            <div className={`text-lg font-bold break-words ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}