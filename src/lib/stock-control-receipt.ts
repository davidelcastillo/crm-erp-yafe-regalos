/**
 * Snapshot del cierre de un control de stock. Descargar el PDF no vuelve a
 * tocar stock: el ajuste ya se aplicó (o quedó pendiente) al cerrar el control.
 *
 * Sólo entran los ítems con diferencia ≠ 0: los que no tienen diferencia no
 * aportan nada al documento.
 */
export type StockControlDecision = "PENDING" | "ACCEPTED";

// Se declaran como `type` y no `interface` a propósito: así el objeto del cierre
// se puede pasar por `parseObject` (que exige `Record<string, unknown>`) sin
// casteos, y el comprobante del cierre y este tipo no pueden divergir.
export type StockControlReceiptItem = {
  code: string;
  name: string;
  systemStock: number;
  countedStock: number;
  /** `countedStock - systemStock`, con signo: negativo si faltó, positivo si sobró. */
  difference: number;
  decision: StockControlDecision;
};

export type StockControlReceipt = {
  controlId: number;
  branchId: number;
  branchName: string;
  branchCode: string;
  /** ISO 8601. */
  closedAt: string;
  /** Motivo del ajuste escrito al cerrar; obligatorio si hay algo ajustado (S9/S10). */
  reason: string | null;
  adjustedCount: number;
  pendingCount: number;
  items: StockControlReceiptItem[];
}
