"use client";

import { useState } from "react";
import { Product } from "@prisma/client";
import { getProductAnalytics } from "../../actions/dashboard";

interface ProductAnalyticsProps {
  products: Product[];
}

interface Analytics {
  productId: number;
  totalPurchased: number;
  totalPurchaseCost: number;
  avgPurchasePrice: number;
  totalSold: number;
  totalSaleRevenue: number;
  avgSalePrice: number;
  profit: number;
}

export function ProductAnalytics({ products }: ProductAnalyticsProps) {
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  const handleProductChange = async (productId: number) => {
    setSelectedProductId(productId);
    if (!productId) {
      setAnalytics(null);
      return;
    }

    setLoading(true);
    const result = await getProductAnalytics(productId);
    if (result.success && result.data) {
      setAnalytics(result.data as unknown as Analytics);
    }
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-[#222222] mb-4">
        Análisis por Producto
      </h2>

      {/* Product Selector */}
      <select
        value={selectedProductId || ""}
        onChange={(e) => handleProductChange(Number(e.target.value))}
        className="w-full px-4 py-3 bg-[#f8f8f8] rounded-xl text-base text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 mb-4"
      >
        <option value="">Seleccionar producto...</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </select>

      {/* Analytics Display */}
      {loading ? (
        <div className="text-center py-4 text-[#6a6a6a]">Cargando...</div>
      ) : analytics ? (
        <div className="space-y-4">
          {/* Purchase Stats */}
          <div className="p-3 bg-[#f9f9f9] rounded-lg">
            <h3 className="text-sm font-medium text-[#6a6a6a] mb-2">Compras</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-[#6a6a6a]">Unidades:</span>
                <span className="ml-2 font-medium">{analytics.totalPurchased}</span>
              </div>
              <div>
                <span className="text-[#6a6a6a]">Costo total:</span>
                <span className="ml-2 font-medium">{formatCurrency(analytics.totalPurchaseCost)}</span>
              </div>
              <div>
                <span className="text-[#6a6a6a]">Precio promedio:</span>
                <span className="ml-2 font-medium">{formatCurrency(analytics.avgPurchasePrice)}</span>
              </div>
            </div>
          </div>

          {/* Sale Stats */}
          <div className="p-3 bg-[#f9f9f9] rounded-lg">
            <h3 className="text-sm font-medium text-[#6a6a6a] mb-2">Ventas</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-[#6a6a6a]">Unidades:</span>
                <span className="ml-2 font-medium">{analytics.totalSold}</span>
              </div>
              <div>
                <span className="text-[#6a6a6a]">Ingreso total:</span>
                <span className="ml-2 font-medium">{formatCurrency(analytics.totalSaleRevenue)}</span>
              </div>
              <div>
                <span className="text-[#6a6a6a]">Precio promedio:</span>
                <span className="ml-2 font-medium">{formatCurrency(analytics.avgSalePrice)}</span>
              </div>
            </div>
          </div>

          {/* Profit */}
          <div
            className={`p-4 rounded-lg ${
              analytics.profit >= 0 ? "bg-green-50" : "bg-red-50"
            }`}
          >
            <div className="text-sm text-[#6a6a6a]">Rentabilidad del Producto</div>
            <div
              className={`text-2xl font-bold ${
                analytics.profit >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
              }`}
            >
              {formatCurrency(analytics.profit)}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-[#6a6a6a]">
          Selecciona un producto para ver su análisis
        </div>
      )}
    </div>
  );
}