"use client";

import { useState } from "react";
import { Product } from "@prisma/client";
import { getProductAnalytics } from "../../actions/dashboard";
import { Spinner } from "@/components/ui/Spinner";

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
    <div className="glass rounded-2xl border border-hairline-soft p-4">
      <h2 className="text-lg font-semibold text-ink mb-4">
        Análisis por Producto
      </h2>

      {/* Product Selector */}
      <select
        value={selectedProductId || ""}
        onChange={(e) => handleProductChange(Number(e.target.value))}
        aria-label="Elegir producto"
        className="mb-4 min-h-[44px] w-full rounded-xl bg-surface-soft px-3 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
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
        <Spinner size="sm" label="Cargando análisis..." className="py-4" />
      ) : analytics ? (
        <div className="space-y-4">
          {/* Purchase Stats */}
          <div className="p-3 bg-surface-soft rounded-lg">
            <h3 className="text-sm font-medium text-ink-muted mb-2">Compras</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-ink-muted">Unidades:</span>
                <span className="ml-2 font-medium">{analytics.totalPurchased}</span>
              </div>
              <div>
                <span className="text-ink-muted">Costo total:</span>
                <span className="ml-2 font-medium">{formatCurrency(analytics.totalPurchaseCost)}</span>
              </div>
              <div>
                <span className="text-ink-muted">Precio promedio:</span>
                <span className="ml-2 font-medium">{formatCurrency(analytics.avgPurchasePrice)}</span>
              </div>
            </div>
          </div>

          {/* Sale Stats */}
          <div className="p-3 bg-surface-soft rounded-lg">
            <h3 className="text-sm font-medium text-ink-muted mb-2">Ventas</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-ink-muted">Unidades:</span>
                <span className="ml-2 font-medium">{analytics.totalSold}</span>
              </div>
              <div>
                <span className="text-ink-muted">Ingreso total:</span>
                <span className="ml-2 font-medium">{formatCurrency(analytics.totalSaleRevenue)}</span>
              </div>
              <div>
                <span className="text-ink-muted">Precio promedio:</span>
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
            <div className="text-sm text-ink-muted">Rentabilidad del Producto</div>
            <div
              className={`text-2xl font-bold ${
                analytics.profit >= 0 ? "text-positive" : "text-danger"
              }`}
            >
              {formatCurrency(analytics.profit)}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-ink-muted">
          Selecciona un producto para ver su análisis
        </div>
      )}
    </div>
  );
}