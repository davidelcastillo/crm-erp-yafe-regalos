// src/lib/validations/purchase.ts
import { z } from "zod";

/**
 * Item de una compra con distribución multi-sucursal.
 * Cada línea especifica el producto, la sucursal destino, la cantidad y el precio.
 */
export const purchaseSplitItemSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
  branchId: z.number().int().positive("Sucursal inválida"),
  quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
  price: z.number().positive("El precio debe ser mayor a 0"),
});

/**
 * Compra con distribución multi-sucursal.
 *
 * Restricción del schema real: `Purchase.branchId` es NOT NULL, por lo que
 * la cabecera toma el `branchId` de la PRIMERA línea. El resto de las líneas
 * incrementan `BranchInventory` en la sucursal correspondiente y generan
 * movimientos `ENTRY` por línea para reflejar la distribución (audit).
 */
export const createPurchaseWithBranchSplitSchema = z.object({
  items: z.array(purchaseSplitItemSchema).min(1, "Se requiere al menos un item"),
  performedBy: z.string().min(1).max(100).optional(),
});

export type PurchaseSplitItem = z.infer<typeof purchaseSplitItemSchema>;
export type CreatePurchaseWithBranchSplitValues = z.infer<
  typeof createPurchaseWithBranchSplitSchema
>;
