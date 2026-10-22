"use client";

import { useState } from "react";
import { ProductSortToggle } from "@/components/ui/ProductSortToggle";
import { sortProducts, type ProductSortMode } from "@/lib/product-order";

export interface InventoryItem {
  code: string;
  name: string;
  stock: number;
  price: number;
  /** Opcional: el catálogo ordena por esta fecha cuando el payload la trae. */
  updatedAt?: string | null;
}

/** Un movimiento como se publica en el catálogo: fecha, tipo y cantidad (S3). */
export type ExternalMovement = {
  id: string;
  type:
    | "PURCHASE"
    | "SALE"
    | "ENTRY"
    | "EXIT"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "ADJUSTMENT";
  date: string;
  quantity: number;
};

const MOVEMENT_LABELS: Record<ExternalMovement["type"], string> = {
  PURCHASE: "Compra",
  SALE: "Venta",
  ENTRY: "Entrada",
  EXIT: "Salida",
  TRANSFER_IN: "Transferencia entrada",
  TRANSFER_OUT: "Transferencia salida",
  ADJUSTMENT: "Ajuste",
};

interface ExternalInventoryTableProps {
  inventoryData: InventoryItem[];
  showHeaders?: boolean;
  /** Movimientos desde el último control, por código de producto (S3). */
  movementsByCode?: Record<string, ExternalMovement[]>;
  /** Fecha ISO del último control cerrado; sin control no hay sección (S5). */
  controlClosedAt?: string | null;
}

const formatDay = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));

/**
 * Movimientos del producto desde el último control (S3). Se publican fecha, tipo
 * y cantidad: nunca quién lo hizo ni la referencia del documento.
 */
function MovementsDetails({
  movements,
  controlClosedAt,
}: {
  movements: ExternalMovement[];
  controlClosedAt: string;
}) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-brand-rosa-texto">
        {movements.length === 1 ? "1 movimiento" : `${movements.length} movimientos`} desde el
        control del {formatDay(controlClosedAt)}
      </summary>
      <ul className="mt-2 space-y-1">
        {movements.map((movement) => (
          <li
            key={movement.id}
            className="flex items-center justify-between gap-2 text-xs text-ink-muted"
          >
            <span className="shrink-0">{formatDay(movement.date)}</span>
            <span className="min-w-0 flex-1 truncate">{MOVEMENT_LABELS[movement.type]}</span>
            <span className="shrink-0 font-semibold text-ink">{movement.quantity} uds</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function ExternalInventoryTable({
  inventoryData,
  showHeaders = true,
  movementsByCode = {},
  controlClosedAt = null,
}: ExternalInventoryTableProps) {
  const [search, setSearch] = useState("");
  // S4: por código por defecto, con cambio a última modificación.
  const [sortMode, setSortMode] = useState<ProductSortMode>("code");
  const query = search.trim().toLowerCase();
  const visible = sortProducts(
    inventoryData.filter(
      (item) =>
        item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query)
    ),
    sortMode
  );

  if (inventoryData.length === 0) {
    return (
      <div className="text-center py-12 text-ink-muted">
        No hay productos en el inventario de esta sucursal
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* El buscador es un bloque propio, separado de las cards y la tabla. Su
          estado vive acá porque la página del catálogo es un Server Component y
          subirlo a la banda obligaría a volverla cliente (S16). */}
      <div className="mb-4 rounded-2xl glass-strong px-4 py-3">
        <label className="block text-sm font-medium text-ink">
          Buscar productos por código o nombre
          {/* `span` y no `div`: adentro de un `label` solo va contenido en línea. */}
          <span className="relative mt-2 block w-full">
            <svg
              className="w-5 h-5 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={200}
              placeholder="Código o nombre"
              className="w-full min-h-[44px] pl-12 pr-4 py-3 bg-surface-soft rounded-xl text-base text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-accent/30 touch-manipulation"
            />
          </span>
        </label>
      </div>
      <div className="flex justify-center">
        <ProductSortToggle value={sortMode} onChange={setSortMode} />
      </div>
      {visible.length === 0 && (
        <p role="status" className="py-6 text-center text-ink-muted">
          No se encontraron productos para esta búsqueda
        </p>
      )}
      {/* Mobile: una card de vidrio por producto, con la misma forma que las
          listas (nombre, código, stock y precio). */}
      <div className="space-y-4 md:hidden">
        {visible.map((item) => (
          <div key={item.code} className="rounded-2xl glass p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-ink break-words">
                  {item.name}
                </h3>
                <span className="mt-1 inline-block max-w-full break-words px-2 py-0.5 bg-surface-strong rounded text-xs font-mono text-ink-muted">
                  {item.code}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold text-ink">
                  {item.stock} uds
                </span>
                <span className="text-sm font-semibold text-ink">
                  ${item.price.toFixed(2)}
                </span>
              </div>
            </div>
            {controlClosedAt && movementsByCode[item.code]?.length ? (
              <MovementsDetails
                movements={movementsByCode[item.code]}
                controlClosedAt={controlClosedAt}
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* Escritorio: la tabla con las mismas columnas, con scroll propio si el
          ancho no alcanza. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          {showHeaders && (
            <thead className="bg-surface-soft font-medium text-ink-muted">
              <tr>
                <th className="w-[60px] p-3 text-left">Código</th>
                <th className="p-3 text-left">Producto</th>
                <th className="w-[80px] p-3 text-center">Stock</th>
                <th className="w-[100px] p-3 text-right">Precio</th>
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-hairline">
            {visible.map((item) => (
              <tr key={item.code} className="hover:bg-surface-soft">
                <td className="px-4 py-3 font-mono">{item.code}</td>
                <td className="px-4 py-3 break-words text-ink">
                  {item.name}
                  {controlClosedAt && movementsByCode[item.code]?.length ? (
                    <MovementsDetails
                      movements={movementsByCode[item.code]}
                      controlClosedAt={controlClosedAt}
                    />
                  ) : null}
                </td>
                <td className="px-4 py-3 text-center font-semibold text-ink">
                  {item.stock}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-ink">
                  ${item.price.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
