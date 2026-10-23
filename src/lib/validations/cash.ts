import { z } from "zod";
import { inicioDelDia, toLocalDateKey } from "@/lib/dates";

/**
 * Fecha de un movimiento de caja: es un **día calendario local**, no un instante
 * (`new Date("2026-03-04")` es medianoche UTC y en UTC-3 cae el día anterior).
 * El `refine` rechaza también días que no existen, como 2026-02-31.
 */
export const fechaCalendarioSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine((fecha) => toLocalDateKey(inicioDelDia(fecha)) === fecha, "Fecha inválida");

/** Registrar plata en la caja de una sucursal (S14). */
export const registerCashMovementSchema = z.object({
  branchId: z.coerce.number().int().positive("Sucursal inválida"),
  type: z.enum(["INGRESO", "EGRESO"], { message: "El tipo debe ser INGRESO o EGRESO" }),
  // `MIXTO` es un medio del corte (su propia columna) y del libro; el formulario
  // todavía no lo ofrece, pero aceptarlo deja listo el alta sin tocar la UI.
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "MIXTO"]).default("EFECTIVO"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  // Fecha propia, elegible al cargar (S18); sin ella, el momento de la carga.
  date: fechaCalendarioSchema.optional(),
  description: z.string().max(200, "El detalle es muy largo").optional(),
  performedBy: z.string().min(1, "El responsable es requerido").max(100),
});

/** Filtros del libro de plata de una sucursal. */
export const getCashMovementsSchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  startDate: fechaCalendarioSchema.optional(),
  endDate: fechaCalendarioSchema.optional(),
  take: z.coerce.number().int().positive().optional(),
});

/** Resumen del cierre de caja de una sucursal (S9/S17). */
export const cashClosePreviewSchema = z.object({
  branchId: z.coerce.number().int().positive("Sucursal inválida"),
});

/** Cerrar la caja de una sucursal: persiste el corte (S17). */
export const closeCashSchema = z.object({
  branchId: z.coerce.number().int().positive("Sucursal inválida"),
  performedBy: z.string().min(1, "El responsable es requerido").max(100),
});

export type RegisterCashMovementValues = z.infer<typeof registerCashMovementSchema>;
export type GetCashMovementsFilters = z.infer<typeof getCashMovementsSchema>;
export type CashClosePreviewValues = z.infer<typeof cashClosePreviewSchema>;
export type CloseCashValues = z.infer<typeof closeCashSchema>;
