// src/lib/validations/sale.ts
import { z } from "zod";
import { PaymentMethod, computePayment } from "@/lib/utils/payment";

/**
 * Export del schema de venta que ya existía inline en `src/app/actions/sale.ts`.
 *
 * Se mantiene también el schema inline en `src/app/actions/sale.ts` (es el que
 * valida el alta de venta): si cambia uno, el otro tiene que cambiar también.
 */
export const saleItemSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
  price: z.number().positive("El precio debe ser mayor a 0"),
  quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
});

export const registerSaleSchema = z
  .object({
    items: z.array(saleItemSchema).min(1),
    branchId: z.number().int().positive("La sucursal es requerida"),
    customerId: z.number().int().positive().optional(),
    amountPaid: z.number().min(0).default(0),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    cashAmount: z.number().min(0).optional(),
    transferAmount: z.number().min(0).optional(),
  })
  .refine(
    (data) =>
      data.paymentMethod !== PaymentMethod.MIXTO ||
      (data.cashAmount ?? 0) + (data.transferAmount ?? 0) > 0,
    {
      message: "MIXTO requiere cashAmount o transferAmount mayor a 0",
      path: ["cashAmount"],
    }
  );

export type SaleItem = z.infer<typeof saleItemSchema>;
export type RegisterSaleValues = z.infer<typeof registerSaleSchema>;

// Re-export de las utilidades de pago
export { PaymentMethod, computePayment };
