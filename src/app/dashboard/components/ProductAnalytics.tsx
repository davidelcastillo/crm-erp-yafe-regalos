"use client";

import { useEffect, useRef, useState } from "react";
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
  // El `<select>` nativo lo dibuja el sistema operativo: con un nombre de
  // producto largo la lista se abría más ancha que la pantalla y no se podía
  // acotar. Este desplegable es del sistema, con alto máximo y scroll adentro.
  const [open, setOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) setOpen(false);
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

      {/* Product Selector: ancho de la tarjeta, alto máximo y scroll adentro. */}
      <div className="relative mb-4 min-w-0" ref={selectorRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Elegir producto"
          className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl bg-surface-soft px-3 py-2.5 text-base text-ink transition-colors hover:bg-surface-strong touch-manipulation"
        >
          <span className="truncate">
            {selectedProductId === null
              ? "Seleccionar producto..."
              : products.find((p) => p.id === selectedProductId)?.name ??
                "Seleccionar producto..."}
          </span>
          <svg
            className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div
            className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-hairline bg-surface shadow-lg"
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                handleProductChange(0);
              }}
              aria-current={selectedProductId === null ? "true" : undefined}
              className={`block w-full min-h-[44px] truncate px-4 py-3 text-left text-sm transition-colors hover:bg-surface-soft ${
                selectedProductId === null
                  ? "bg-accent/10 text-brand-rosa-texto font-medium"
                  : "text-ink"
              }`}
            >
              Seleccionar producto...
            </button>
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  handleProductChange(product.id);
                }}
                aria-current={selectedProductId === product.id ? "true" : undefined}
                className={`block w-full min-h-[44px] truncate px-4 py-3 text-left text-sm transition-colors hover:bg-surface-soft ${
                  selectedProductId === product.id
                    ? "bg-accent/10 text-brand-rosa-texto font-medium"
                    : "text-ink"
                }`}
              >
                {product.name}
              </button>
            ))}
            {products.length === 0 && (
              <div className="px-4 py-3 text-sm text-ink-muted">No hay productos activos</div>
            )}
          </div>
        )}
      </div>

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