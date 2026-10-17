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
    price: number;
  }>;
}
