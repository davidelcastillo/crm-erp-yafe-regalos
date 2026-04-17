import { getGlobalStats, getPerformanceData } from "../actions/dashboard";
import { getProducts } from "../actions/product";
import { Product } from "@prisma/client";
import { DashboardCards } from "./components/DashboardCards";
import { DashboardChart } from "./components/DashboardChart";
import { ProductAnalytics } from "./components/ProductAnalytics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Fetch all data in parallel
  const [statsResult, performanceResult, productsResult] = await Promise.all([
    getGlobalStats(),
    getPerformanceData(30),
    getProducts(),
  ]);

  const stats = statsResult.success ? statsResult.data : null;
  const performanceData = performanceResult.success ? (performanceResult.data || []) : [];
  const products: Product[] = (productsResult.success && productsResult.data) ? productsResult.data : [];

  return (
    <div className="min-h-screen bg-[#ffffff] pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-white z-40 px-6 pt-6 pb-4 shadow-sm">
        <h1 className="text-2xl font-bold text-[#222222]">Dashboard</h1>
        <p className="text-sm text-[#6a6a6a] mt-1">Resumen financiero de tu negocio</p>
      </header>

      <main className="px-6 space-y-6">
        {/* Stats Cards */}
        <DashboardCards stats={stats} />

        {/* Performance Chart */}
        <DashboardChart data={performanceData} />

        {/* Product Analytics */}
        <ProductAnalytics products={products} />
      </main>
    </div>
  );
}