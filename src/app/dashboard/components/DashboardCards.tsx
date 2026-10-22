"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { Reveal } from "@/components/ui/Reveal";
import { ValueChange } from "@/components/ui/ValueChange";

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
          <div key={i} className="glass rounded-2xl border border-hairline-soft p-4">
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
      color: "text-positive-strong",
    },
    {
      label: "Egresos",
      value: formatCurrency(stats.totalExpense),
      color: "text-negative-strong",
    },
    {
      label: "Ganancia Neta",
      value: formatCurrency(stats.netProfit),
      color: stats.netProfit >= 0 ? "text-positive-strong" : "text-negative-strong",
    },
    {
      label: "Cobrar",
      value: formatCurrency(stats.accountsReceivable),
      color: "text-warning-strong",
    },
  ];

  return (
    <section>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-lg font-semibold text-ink">Resumen</h2>
        <span className="text-sm text-ink-muted break-words">{branchLabel}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* Cada tarjeta entra en cascada con su posición (S7); la raíz de la card
            no cambia. El monto entra animado cuando cambia el período (S9). */}
        {cards.map((card, index) => (
          <Reveal key={index} index={index}>
            <div className="glass rounded-2xl border border-hairline-soft p-4">
              <div className="text-xs text-ink-muted mb-1">{card.label}</div>
              <ValueChange key={card.value} className={`block text-lg font-bold break-words ${card.color}`}>
                {card.value}
              </ValueChange>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}