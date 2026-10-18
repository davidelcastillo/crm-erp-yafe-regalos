/** Snapshot de la operación confirmada; descargarlo no vuelve a escribir stock. */
export interface StockMovementReceipt {
  movementType: "ENTRY" | "EXIT" | "TRANSFER";
  date: string;
  branchName: string;
  branchCode: string;
  sourceBranchName?: string;
  sourceBranchCode?: string;
  reference: string;
  rows: Array<{
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
