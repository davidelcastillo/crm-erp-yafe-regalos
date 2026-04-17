import { getProducts } from "../actions/product";
import { ProductCard } from "./components/ProductCard";
import { AddProductButton } from "./components/AddProductButton";
import { Product } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const result = await getProducts();
  const products: Product[] = result.success && result.data ? result.data : [];

  return (
    <div className="min-h-screen bg-[#ffffff] pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-white z-40 px-6 pt-6 pb-4 shadow-sm">
        <h1 className="text-2xl font-bold text-[#222222]">Productos</h1>
        <p className="text-sm text-[#6a6a6a] mt-1">Gestiona tu inventario</p>
      </header>

      {/* Product List */}
      <main className="px-6">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f2f2f2] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-[#6a6a6a]">No hay productos aún</p>
            <p className="text-sm text-[#6a6a6a]">Toca el botón + para agregar uno</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <AddProductButton />
    </div>
  );
}