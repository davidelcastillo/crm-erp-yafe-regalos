// src/lib/validations/branchMovement.ts
import { z } from "zod";

/**
 * Schema para mover stock entre sucursales.
 *
 * El `performedBy` es un String en el schema (no FK a User); usar el user id
 * corto o email del server context. El `refine` garantiza origen ≠ destino.
 */
export const moveStockSchema = z
  .object({
    productId: z.number().int().positive("Producto inválido"),
    sourceBranchId: z.number().int().positive("Sucursal origen requerida"),
    destBranchId: z.number().int().positive("Sucursal destino requerida"),
    quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
    performedBy: z.string().min(1, "El responsable es requerido").max(100),
  })
  .refine((d) => d.sourceBranchId !== d.destBranchId, {
    message: "Las sucursales de origen y destino deben ser distintas",
    path: ["destBranchId"],
  });

/**
 * Schema para asignar/ajustar stock en una sucursal (upsert).
 */
export const assignStockSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
  branchId: z.number().int().positive("Sucursal inválida"),
  quantity: z.number().int("La cantidad debe ser un entero"),
  performedBy: z.string().min(1, "El responsable es requerido").max(100).optional(),
});

/**
 * Filtros para consultar movimientos por sucursal/producto/fechas.
 */
export const getMovementsFiltersSchema = z.object({
  branchId: z.number().int().positive().optional(),
  productId: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type MoveStockValues = z.infer<typeof moveStockSchema>;
export type AssignStockValues = z.infer<typeof assignStockSchema>;
export type GetMovementsFilters = z.infer<typeof getMovementsFiltersSchema>;
