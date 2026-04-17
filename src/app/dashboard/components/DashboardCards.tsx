"use client";

interface Stats {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  accountsReceivable: number;
}

interface DashboardCardsProps {
  stats: Stats | null | undefined;
}

export function DashboardCards({ stats }: DashboardCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-100 animate-pulse rounded-xl h-24" />
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

  const cards = [
    {
      label: "Ingresos",
      value: formatCurrency(stats.totalIncome),
      color: "text-[#22c55e]",
      bg: "bg-green-50",
    },
    {
      label: "Egresos",
      value: formatCurrency(stats.totalExpense),
      color: "text-[#ef4444]",
      bg: "bg-red-50",
    },
    {
      label: "Ganancia Neta",
      value: formatCurrency(stats.netProfit),
      color: stats.netProfit >= 0 ? "text-[#22c55e]" : "text-[#ef4444]",
      bg: stats.netProfit >= 0 ? "bg-green-50" : "bg-red-50",
    },
    {
      label: "Cobrar",
      value: formatCurrency(stats.accountsReceivable),
      color: "text-[#f59e0b]",
      bg: "bg-yellow-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`${card.bg} rounded-xl p-4`}
        >
          <div className="text-xs text-[#6a6a6a] mb-1">{card.label}</div>
          <div className={`text-lg font-bold ${card.color}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}