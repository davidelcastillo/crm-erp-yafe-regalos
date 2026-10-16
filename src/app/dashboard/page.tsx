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
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { useBranch } from "@/lib/context/BranchContext";
import { toFullLabel } from "@/lib/dates";

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

      // El mismo período gobierna los dos: las tarjetas y el gráfico.
      const performanceParam =
        period === "custom"
          ? { startDate, endDate, branchId: branchParam }
          : { days: Number(period), branchId: branchParam };

      const [statsResult, performanceResult, productsResult] = await Promise.all([
        getStats(statsParam),
        getPerformanceData(performanceParam),
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

  const rangeLabel =
    period === "custom"
      ? startDate && endDate
        ? `Del ${toFullLabel(startDate)} al ${toFullLabel(endDate)}`
        : "Sin rango elegido"
      : `Últimos ${period} días`;

  // Carga: la banda de marca y la hoja con la forma de las tarjetas que van a llegar.
  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <div className="h-28 brand-gradient" />
        <div className="glass rounded-t-[2.5rem] -mt-12 px-5 pt-8">
          <Spinner label="Cargando dashboard..." />
          <div className="mt-6 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <main>
        <div className="pb-16 brand-gradient">
          <PageHeader
            title="Dashboard"
            right={
              <BranchSelector
                block
                onChange={(id) => setBranchId(id)}
                label="Filtrar por sucursal"
              />
            }
          />
        </div>

        <div className="glass rounded-t-[2.5rem] border-t border-white/80 -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="space-y-6">
            {/* Selector de período: el mismo rango gobierna las tarjetas y el gráfico. */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-xs text-[#6a6a6a] font-medium">Periodo</span>
                <div className="flex flex-wrap gap-2">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPeriod(opt.value)}
                      className={`min-h-[44px] px-4 whitespace-nowrap rounded-xl text-sm transition-colors touch-manipulation ${
                        period === opt.value
                          ? "bg-[#222222] text-white"
                          : "bg-[#f2f2f2] text-[#222222] hover:bg-[#e5e5e5]"
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

            {/* Stats Cards */}
            <DashboardCards stats={stats} branchLabel={branchLabel} />

            {/* Performance Chart */}
            <DashboardChart data={performanceData} rangeLabel={rangeLabel} />

            {/* Product Analytics */}
            <ProductAnalytics products={products} />
          </div>
        </div>
      </main>
    </div>
  );
}
