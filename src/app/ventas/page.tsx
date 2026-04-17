import { getProducts } from "../actions/product";
import { SalesList } from "./components/SalesList";
import { AddSaleButton } from "./components/AddSaleButton";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const result = await getProducts();
  const products = result.success && result.data ? result.data : [];

  const { getSales } = await import("../actions/sale");
  const salesResult = await getSales();
  const sales = salesResult.success && salesResult.data ? salesResult.data : [];

  return (
    <div className="min-h-screen bg-[#ffffff] pb-20">
      <header className="sticky top-0 bg-white z-40 px-6 pt-6 pb-4 shadow-sm">
        <h1 className="text-2xl font-bold text-[#222222]">Ventas</h1>
        <p className="text-sm text-[#6a6a6a] mt-1">Historial de egresos</p>
      </header>

      <main className="px-6">
        {sales.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f2f2f2] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 3s1.343 3 3 3 3 .895 3 3-1.343 3-3 3-3 .895-3 3zm0 8c1.11 0 2.08-.402 2.599-1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[#6a6a6a]">No hay ventas aún</p>
            <p className="text-sm text-[#6a6a6a]">Toca el botón + para registrar una venta</p>
          </div>
        ) : (
          <SalesList sales={sales as never[]} />
        )}
      </main>

      <AddSaleButton products={products} />
    </div>
  );
}