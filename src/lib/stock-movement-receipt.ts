/** Snapshot de la operación confirmada; descargarlo no vuelve a escribir stock. */
export interface StockMovementReceipt {
  movementType: "ENTRY" | "EXIT" | "TRANSFER";
  /** Sucursal del comprobante: con ella se piden las etiquetas de lo ingresado (S1). */
  branchId: number;
  date: string;
  branchName: string;
  branchCode: string;
  sourceBranchName?: string;
  sourceBranchCode?: string;
  reference: string;
  rows: Array<{
    /** Producto de la fila: las etiquetas se piden por id (S5). */
    productId: number;
    code: string;
    name: string;
    quantity: number;
    stock: number;
    /** Saldo que le queda a la sucursal de origen tras el traslado; solo en traslados. */
    sourceStock?: number;
    price: number;
  }>;
}

/** Lado del movimiento que documenta el comprobante: la sucursal que recibe o la que envía. */
export type StockMovementSide = "SOURCE" | "DESTINATION";
