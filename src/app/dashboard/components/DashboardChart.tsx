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
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-[#222222] mb-4">
          Ingresos vs Egresos ({rangeLabel})
        </h2>
        <div className="h-64 flex items-center justify-center text-[#6a6a6a]">
          No hay datos disponibles
        </div>
      </div>
    );
  }

  const chartData = toChartPoints(data);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-[#222222] mb-4">
        Ingresos vs Egresos ({rangeLabel})
      </h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              stroke="#9ca3af" />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
              tickFormatter={(value) => `$${value}`} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e5e5",
                borderRadius: "8px",
              }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]} />
            <Legend />
            <Bar dataKey="income" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}