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
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { useBranch } from "@/lib/context/BranchContext";
import { toFullLabel } from "@/lib/dates";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

type PeriodType = "cierre" | "7" | "30" | "90" | "custom";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "cierre", label: "Desde el último cierre" },
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

/**
 * Carga: la banda de marca, la forma del encabezado y la hoja con la forma de
 * las tarjetas que van a llegar, en el mismo orden y con las mismas medidas que
 * la página, para que no salte al terminar (S2).
 */
const DashboardLoading = () => (
  <div className="min-h-screen bg-surface pb-20">
    <div className="pb-16 brand-gradient">
      <div className="px-3 pt-6" aria-hidden="true">
        <Skeleton className="h-[60px] rounded-2xl" />
      </div>
    </div>
    <div className="glass rounded-t-[2.5rem] -mt-12 px-5 pt-6">
      <Spinner label="Cargando dashboard..." />
      {/* La fila del período, que es el filtro que la página tiene arriba. */}
      <div className="mt-4">
        <Skeleton className="h-[44px] rounded-xl" />
      </div>
      <div className="mt-6 space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  </div>
);

export default function DashboardPage() {
  const { branches } = useBranch();
  const [branchId, setBranchId] = useState<number | null>(null);
  const [period, setPeriod] = useState<PeriodType>("cierre");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [performanceData, setPerformanceData] = useState<
    { date: string; income: number; expense: number }[]
  >([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Movimiento de la página: el encabezado se mueve solo y el degradé de marca
  // se retira cuando la hoja lo tapa (S10, S11). Con movimiento reducido queda
  // quieto; los controles nunca se atenúan.
  const { scrollY } = useScroll();
  const headerY = useTransform(scrollY, [0, 160], [0, 16]);
  const brandOpacity = useTransform(scrollY, [0, 140], [1, 0.45]);
  const reduceMotion = useReducedMotion();

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

      // El mismo período gobierna los dos: las tarjetas y el gráfico. En «cierre»
      // el rango lo resuelve el servidor con el último cierre de caja.
      const performanceParam = {
        type: period,
        branchId: branchParam,
        ...(period === "custom" ? { startDate, endDate } : {}),
      };

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
    period === "cierre"
      ? "Desde el último cierre de caja"
      : period === "custom"
        ? startDate && endDate
          ? `Del ${toFullLabel(startDate)} al ${toFullLabel(endDate)}`
          : "Sin rango elegido"
        : `Últimos ${period} días`;

  if (loading) {
    return <DashboardLoading />;
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <main>
        <div className="relative isolate pb-16">
          {/* El degradé de marca es una capa de fondo: se retira al hacer scroll
              (S10), pero el selector y los filtros no se tocan. */}
          <motion.div
            className="brand-gradient pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={reduceMotion ? undefined : { opacity: brandOpacity }}
          />

          <motion.div style={reduceMotion ? undefined : { y: headerY }}>
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
          </motion.div>
        </div>

        <div className="glass rounded-t-[2.5rem] border-t border-white/80 -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="space-y-6">
            {/* Selector de período: el mismo rango gobierna las tarjetas y el gráfico. */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-xs text-ink-muted font-medium">Periodo</span>
                <div className="flex flex-wrap gap-2">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPeriod(opt.value)}
                      aria-pressed={period === opt.value}
                      className={`btn whitespace-nowrap ${
                        period === opt.value ? "btn-active" : "btn-secondary"
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
                    <span className="text-xs text-ink-muted font-medium">Desde</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-11 px-3 bg-surface border border-hairline rounded-xl text-sm text-ink touch-manipulation"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-ink-muted font-medium">Hasta</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-11 px-3 bg-surface border border-hairline rounded-xl text-sm text-ink touch-manipulation"
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
