import { getProducts } from "../actions/product";
import { PurchasesList } from "./components/PurchasesList";
import { AddPurchaseButton } from "./components/AddPurchaseButton";

export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  const result = await getProducts();
  const products = result.success && result.data ? result.data : [];

  const { getPurchases } = await import("../actions/purchase");
  const purchasesResult = await getPurchases();
  const purchases = purchasesResult.success && purchasesResult.data ? purchasesResult.data : [];

  return (
    <div className="min-h-screen bg-[#ffffff] pb-20">
      <header className="sticky top-0 bg-white z-40 px-6 pt-6 pb-4 shadow-sm">
        <h1 className="text-2xl font-bold text-[#222222]">Compras</h1>
        <p className="text-sm text-[#6a6a6a] mt-1">Historial de ingresos</p>
      </header>

      <main className="px-6">
        {purchases.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f2f2f2] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-[#6a6a6a]">No hay compras aún</p>
            <p className="text-sm text-[#6a6a6a]">Toca el botón + para registrar una compra</p>
          </div>
        ) : (
          <PurchasesList purchases={purchases as never[]} />
        )}
      </main>

      <AddPurchaseButton products={products} />
    </div>
  );
}