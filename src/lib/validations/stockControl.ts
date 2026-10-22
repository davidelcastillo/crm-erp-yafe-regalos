// src/lib/validations/stockControl.ts
import { z } from "zod";

/**
 * Control de stock por sucursal (S2, S9). El control es un evento manual: se
 * abre un borrador con el stock del sistema, se cargan los conteos físicos y,
 * al cerrar, solo las diferencias aceptadas ajustan el stock.
 */

/** Sucursal del control. */
export const startStockControlSchema = z.object({
  branchId: z.number().int().positive("Sucursal inválida"),
});

/** Control a consultar / guardar / cerrar. */
const controlIdShape = {
  controlId: z.number().int().positive("Control inválido"),
};

export const getStockControlSchema = z.object(controlIdShape);

export const saveStockControlCountsSchema = z.object({
  ...controlIdShape,
  items: z.array(
    z.object({
      productId: z.number().int().positive("Producto inválido"),
      countedStock: z
        .number()
        .int("La cantidad contada debe ser un número entero")
        .min(0, "La cantidad contada no puede ser negativa"),
      // `PENDING` deja el teórico a la vista para seguir buscando la mercadería;
      // `ACCEPTED` ajusta el stock a lo contado. Nunca se decide solo.
      decision: z.enum(["PENDING", "ACCEPTED"], {
        message: "La decisión debe ser PENDING o ACCEPTED",
      }),
    })
  ),
});

export const closeStockControlSchema = z.object({
  ...controlIdShape,
  /** Motivo del ajuste: obligatorio si se acepta alguna diferencia (S10). */
  reason: z.string().max(500, "El motivo es demasiado largo").optional(),
});

export const getLastClosedStockControlSchema = z.object({
  branchId: z.number().int().positive("Sucursal inválida"),
});

export type StartStockControlValues = z.infer<typeof startStockControlSchema>;
export type SaveStockControlCountsValues = z.infer<
  typeof saveStockControlCountsSchema
>;
export type CloseStockControlValues = z.infer<typeof closeStockControlSchema>;
