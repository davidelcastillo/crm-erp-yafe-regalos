// src/app/dashboard/components/DashboardChart.tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toShortLabel } from "@/lib/dates";

interface DayData {
  date: string;
  income: number;
  expense: number;
}

interface DashboardChartProps {
  data: DayData[] | undefined;
  rangeLabel: string;
}

// El eje llega como claves de día local ("YYYY-MM-DD"), así que el rótulo sale del
// string: pasarlo por `new Date` mostraba el día anterior en UTC-3.
export function toChartPoints(data: DayData[]) {
  return data.map((d) => ({ ...d, date: toShortLabel(d.date) }));
}

export function DashboardChart({ data, rangeLabel }: DashboardChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="glass rounded-2xl border border-hairline-soft p-4">
        <h2 className="text-lg font-semibold text-ink mb-4 break-words">
          Ingresos vs Egresos ({rangeLabel})
        </h2>
        <div className="h-64 flex items-center justify-center text-ink-muted">
          No hay datos disponibles
        </div>
      </div>
    );
  }

  const chartData = toChartPoints(data);

  return (
    <div className="glass min-w-0 rounded-2xl border border-hairline-soft p-4">
      <h2 className="text-lg font-semibold text-ink mb-4 break-words">
        Ingresos vs Egresos ({rangeLabel})
      </h2>
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              stroke="var(--ink-soft)" />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="var(--ink-soft)"
              tickFormatter={(value) => `$${value}`} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderRadius: "12px",
                fontSize: 12,
                color: "var(--ink)",
              }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]} />
            <Legend />
            <Bar dataKey="income" name="Ingresos" fill="var(--positive-strong)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Egresos" fill="var(--negative-strong)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}