// src/lib/utils/stock.ts
import { prisma } from "@/lib/prisma";

/**
 * Get the stock level for a product at a specific branch.
 * Returns 0 if no BranchInventory record exists yet.
 */
export async function getBranchStock(productId: number, branchId: number): Promise<number> {
  const inventory = await prisma.branchInventory.findUnique({
    where: {
      branchId_productId: { branchId, productId },
    },
    select: { stock: true },
  });

  return inventory?.stock ?? 0;
}

/**
 * Validate sale lines against branch stock.
 * Throws an error if any line exceeds available stock.
 * @param branchId The branch where the sale will occur.
 * @param lines Array of { productId, quantity } (price not needed for stock check).
 */
export async function validateSaleLines(branchId: number, lines: Array<{ productId: number; quantity: number }>): Promise<void> {
  // We could fetch all needed stocks in parallel, but for simplicity we iterate.
  // In practice, we should batch.
  for (const line of lines) {
    const stock = await getBranchStock(line.productId, branchId);
    if (line.quantity > stock) {
      throw new Error(`INSUFFICIENT_BRANCH_STOCK`);
    }
  }
}