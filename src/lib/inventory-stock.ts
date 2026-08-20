export interface StockSource {
  inventory?: Array<{ stock: number }>;
}

/**
 * Sums stock across all inventory rows. Used by the inventory list to show
 * the aggregate for "Todas las Sucursales". Returns 0 when there is no
 * inventory data.
 */
export function sumStock(p: StockSource): number {
  if (!p.inventory) return 0;
  return p.inventory.reduce((total, row) => total + row.stock, 0);
}
