import { getProducts } from "../actions/product";
import { InventarioList } from "./components/InventarioList";
import { Product } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const result = await getProducts();
  const products: Product[] = result.success && result.data ? result.data : [];

  return (
    <div className="min-h-screen bg-[#ffffff] pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-white z-40 px-6 pt-6 pb-4 shadow-sm">
        <h1 className="text-2xl font-bold text-[#222222]">Inventario</h1>
        <p className="text-sm text-[#6a6a6a] mt-1">Gestión de stock en tiempo real</p>
      </header>

      {/* Inventory List */}
      <main className="px-6">
        <InventarioList products={products} />
      </main>
    </div>
  );
}