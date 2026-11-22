// src/app/dashboard/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getResumenPanel, getPerformanceData } from "../actions/dashboard";
import { getProducts } from "../actions/product";
import { Product } from "@prisma/client";
import { DashboardChart } from "./components/DashboardChart";
import { ProductAnalytics } from "./components/ProductAnalytics";
import { ResumenPanel, type ResumenPanelData } from "./components/ResumenPanel";
import { BranchSelector } from "@/components/ui/BranchSelector";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { toFullLabel } from "@/lib/dates";

type PeriodType = "cierre" | "7" | "30" | "90" | "custom";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "cierre", label: "Desde el último cierre" },
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "custom", label: "Personalizado" },
];

/**
 * Home interna calcada de `polkalinas-html/sistema/panel.html`: el saludo con la
 * sucursal y «Nueva venta», el resumen de `getResumenPanel` y —al final, para no
 * romper el look— el período con el gráfico de ingresos vs egresos y el
 * analizador de productos que ya vivían acá.
 */
const DashboardLoading = () => (
  <div className="min-h-screen bg-surface-strong pb-24">
    <div className="px-4 pt-6">
      <Spinner label="Cargando dashboard..." />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  </div>
);

export default function DashboardPage() {
  const [branchId, setBranchId] = useState<number | null>(null);
  const [period, setPeriod] = useState<PeriodType>("cierre");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [resumen, setResumen] = useState<ResumenPanelData | null>(null);
  const [performanceData, setPerformanceData] = useState<
    { date: string; income: number; expense: number }[]
  >([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const branchParam = branchId ?? undefined;

      // El rango personalizado necesita las dos fechas: sin ellas no se pide nada.
      if (period === "custom" && (!startDate || !endDate)) {
        await Promise.resolve();
        setResumen(null);
        setLoading(false);
        return;
      }

      // El mismo período gobierna el resumen, el gráfico y el análisis.
      const param = {
        type: period,
        branchId: branchParam,
        ...(period === "custom" ? { startDate, endDate } : {}),
      };

      const [resumenResult, performanceResult, productsResult] = await Promise.all([
        getResumenPanel(param),
        getPerformanceData(param),
        getProducts(branchParam),
      ]);
      if (cancelled) return;
      setResumen(resumenResult.success ? resumenResult.data : null);
      setPerformanceData(performanceResult.success ? performanceResult.data || [] : []);
      setProducts(
        productsResult.success && productsResult.data ? (productsResult.data as Product[]) : []
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, period, startDate, endDate]);

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
    <div className="min-h-screen bg-surface-strong pb-24">
      <PageHeader
        title="Hola ♡"
        right={
          <div className="flex items-center gap-2">
            <BranchSelector
              onChange={(id) => setBranchId(id)}
              label="Filtrar por sucursal"
            />
            <Link href="/ventas" className="btn btn-primary whitespace-nowrap">
              Nueva venta
            </Link>
          </div>
        }
      />

      <main className="flex flex-col gap-3 px-4 pt-4 md:gap-5 md:px-8 md:pt-6">
        <p className="-mt-1 text-sm text-ink-muted">Así viene el negocio en este período</p>

        <ResumenPanel data={resumen} />

        <section className="min-w-0 rounded-[18px] border border-hairline bg-surface p-5">
          <h2 className="mb-3 text-[17px] font-semibold text-ink">Período</h2>
          <div className="flex flex-wrap items-end gap-3">
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
        </section>

        <DashboardChart data={performanceData} rangeLabel={rangeLabel} />

        <ProductAnalytics products={products} />
      </main>
    </div>
  );
}
