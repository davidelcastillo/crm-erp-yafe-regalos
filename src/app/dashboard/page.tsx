// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getStats, getPerformanceData } from "../actions/dashboard";
import { getProducts } from "../actions/product";
import { Product } from "@prisma/client";
import { DashboardCards } from "./components/DashboardCards";
import { DashboardChart } from "./components/DashboardChart";
import { ProductAnalytics } from "./components/ProductAnalytics";
import { BranchSelector } from "@/components/ui/BranchSelector";
import { useBranch } from "@/lib/context/BranchContext";

type PeriodType = "7" | "30" | "90" | "custom";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "custom", label: "Personalizado" },
];

interface Stats {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  accountsReceivable: number;
}

export default function DashboardPage() {
  const { branches } = useBranch();
  const [branchId, setBranchId] = useState<number | null>(null);
  const [period, setPeriod] = useState<PeriodType>("30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [performanceData, setPerformanceData] = useState<
    { date: string; income: number; expense: number }[]
  >([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const branchParam = branchId ?? undefined;

      if (period === "custom" && (!startDate || !endDate)) {
        await Promise.resolve();
        setStats(null);
        setLoading(false);
        return;
      }

      const statsParam: {
        type: PeriodType;
        branchId?: number;
        startDate?: string;
        endDate?: string;
      } = {
        type: period,
        branchId: branchParam,
      };
      if (period === "custom") {
        statsParam.startDate = startDate;
        statsParam.endDate = endDate;
      }

      const [statsResult, performanceResult, productsResult] = await Promise.all([
        getStats(statsParam),
        getPerformanceData({ days: 30, branchId: branchParam }),
        getProducts(branchId ?? undefined),
      ]);
      if (cancelled) return;
      setStats(statsResult.success ? (statsResult.data as Stats) : null);
      setPerformanceData(
        performanceResult.success ? performanceResult.data || [] : []
      );
      setProducts(
        productsResult.success && productsResult.data
          ? (productsResult.data as Product[])
          : []
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, period, startDate, endDate]);

  const selectedBranchName =
    branchId === null
      ? null
      : branches.find((b) => b.id === branchId)?.name ?? null;
  const branchLabel = selectedBranchName
    ? `(Sucursal ${selectedBranchName})`
    : "(Todas)";

  return (
    <div className="min-h-screen bg-[#ffffff] pb-20">
      <main className="px-6 space-y-6">
        {/* Branch selector header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-[#222222]">Dashboard</h1>
          <BranchSelector
            onChange={(id) => setBranchId(id)}
            label="Filtrar por sucursal"
          />
        </div>

        {/* Period selector */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#6a6a6a] font-medium">Periodo</span>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPeriod(opt.value)}
                  className={`min-h-11 px-4 rounded-xl text-sm transition-colors touch-manipulation ${
                    period === opt.value
                      ? "bg-[#222222] text-white"
                      : "bg-[#f7f7f7] text-[#222222] hover:bg-[#f2f2f2]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {period === "custom" && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[#6a6a6a] font-medium">Desde</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11 px-3 bg-[#ffffff] border border-[#dddddd] rounded-xl text-sm text-[#222222] touch-manipulation"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[#6a6a6a] font-medium">Hasta</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-11 px-3 bg-[#ffffff] border border-[#dddddd] rounded-xl text-sm text-[#222222] touch-manipulation"
                />
              </label>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <div className="flex items-center gap-2 animate-spin">
              <svg className="w-8 h-8 text-[#3b82f6]" viewBox="0 0 24 24" stroke="currentColor">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-[#6a6a6a]">Cargando...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <DashboardCards stats={stats} branchLabel={branchLabel} />

            {/* Performance Chart */}
            <DashboardChart data={performanceData} />

            {/* Product Analytics */}
            <ProductAnalytics products={products} />
          </>
        )}
      </main>
    </div>
  );
}
