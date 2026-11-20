// src/lib/validations/pedido.ts
import { z } from "zod";

import { PaymentMethod } from "@/lib/utils/payment";

/**
 * Pedidos (U4). Acá vive solo la forma de lo que entra por el servidor: los
 * precios, totales y saldos los calcula la acción (I7), y la existencia de
 * cliente, canal, sucursal y productos se verifica contra la base.
 */

const idRequerido = (mensaje: string) => z.number().int().positive(mensaje);

export const ESTADOS_PEDIDO = [
  "RESERVADO",
  "PAGADO",
  "PARA_ENVIAR",
  "ENTREGADO",
  "CANCELADO",
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const METODOS_ENVIO = ["CORREO", "ENCOMIENDA", "RETIRO"] as const;
export type MetodoEnvio = (typeof METODOS_ENVIO)[number];

export const ESTADOS_ENVIO = ["COORDINAR", "FALTA_EMBALAR", "ETIQUETA_LISTA"] as const;
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

/** Ítem del pedido: sin precio, porque el precio lo pone el servidor (I7). */
const itemSchema = z.object({
  productId: idRequerido("Producto inválido"),
  cantidad: z
    .number({ message: "La cantidad debe ser un número" })
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad mínima es 1")
    .max(999, "Máximo 999 unidades"),
});

const senaSchema = z.object({
  monto: z
    .number({ message: "El monto de la seña debe ser un número" })
    .positive("La seña debe ser mayor a 0"),
  metodo: z.nativeEnum(PaymentMethod),
});

/**
 * Alta: un cliente de origen (S2), un canal activo, los ítems y **una sola
 * sucursal** para todo el pedido, seña opcional y vencimiento futuro.
 */
export const createPedidoSchema = z.object({
  customerId: idRequerido("Cliente inválido"),
  canalId: idRequerido("Canal de venta inválido"),
  branchId: idRequerido("Sucursal inválida"),
  items: z
    .array(itemSchema)
    .min(1, "El pedido necesita al menos un producto")
    // Dos líneas del mismo producto rompen el chequeo de disponible: se pide
    // una sola con la cantidad junta.
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      { message: "Un producto no puede repetirse en el pedido" }
    ),
  sena: senaSchema.optional(),
  // Un campo de fecha vacío llega como `""` o `null` desde el formulario y no es
  // un error: el vencimiento es opcional.
  venceEl: z.preprocess(
    (valor) => (valor === "" || valor === null ? undefined : valor),
    z.coerce
      .date({ message: "El vencimiento tiene que ser una fecha válida" })
      .refine((fecha) => fecha.getTime() > Date.now(), {
        message: "El vencimiento tiene que ser una fecha futura",
      })
      .optional()
  ),
});

/** Seña posterior al alta: solo el monto y el medio, nunca el total. */
export const registrarSenaSchema = z.object({
  id: idRequerido("ID inválido"),
  monto: z
    .number({ message: "El monto de la seña debe ser un número" })
    .positive("La seña debe ser mayor a 0"),
  metodo: z.nativeEnum(PaymentMethod),
});

/** Cobro: el saldo lo calcula el servidor; del cliente solo llega el medio. */
export const cobrarPedidoSchema = z.object({
  id: idRequerido("ID inválido"),
  metodo: z.nativeEnum(PaymentMethod, { message: "Medio de pago inválido" }),
});

const ciudadSchema = z
  .string()
  .trim()
  .max(100, "La ciudad tiene un máximo de 100 caracteres")
  .optional()
  .transform((valor) => (valor ? valor : undefined));

/**
 * Movimiento de la tarjeta. `desde`/`hacia` se validan contra la tabla de
 * estados en la acción, que es donde vive la regla del negocio.
 */
export const moverPedidoSchema = z.object({
  id: idRequerido("ID inválido"),
  desde: z.enum(ESTADOS_PEDIDO, { message: "Estado de origen inválido" }),
  hacia: z.enum(ESTADOS_PEDIDO, { message: "Estado de destino inválido" }),
  envioMetodo: z.enum(METODOS_ENVIO, { message: "Método de envío inválido" }).optional(),
  ciudad: ciudadSchema,
});

export const actualizarEnvioSchema = z.object({
  id: idRequerido("ID inválido"),
  envioMetodo: z.enum(METODOS_ENVIO, { message: "Método de envío inválido" }),
  envioEstado: z.enum(ESTADOS_ENVIO, { message: "Estado de preparación inválido" }),
  ciudad: ciudadSchema,
});

/**
 * Cancelación: el motivo es obligatorio (texto libre que también registra qué
 * pasó con la seña; el destino de esa plata se decide caso por caso, sin asiento
 * automático).
 */
export const cancelarPedidoSchema = z.object({
  id: idRequerido("ID inválido"),
  motivo: z
    .string()
    .trim()
    .min(1, "El motivo de la cancelación es obligatorio")
    .max(500, "El motivo tiene un máximo de 500 caracteres"),
});

/** Consulta de una columna del Kanban: take acotado y cursor por id. */
export const getPedidosPorEstadoSchema = z.object({
  estado: z.enum(ESTADOS_PEDIDO, { message: "Estado inválido" }),
  canalId: idRequerido("Canal inválido").optional(),
  take: z.coerce.number().int().min(1).max(30).default(30),
  cursor: idRequerido("Cursor inválido").optional(),
});

export const getContadoresPedidosSchema = z.object({
  canalId: idRequerido("Canal inválido").optional(),
});

export const getPedidoSchema = z.object({
  id: idRequerido("Pedido inválido"),
});

export type CreatePedidoValues = z.infer<typeof createPedidoSchema>;
