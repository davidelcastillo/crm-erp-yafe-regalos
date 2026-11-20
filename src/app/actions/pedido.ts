// src/app/actions/pedido.ts
"use server";
import { requireAdmin } from "@/lib/auth-guard";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prefixLockKey } from "@/lib/utils/product-code";
import { registrarVentaTx } from "@/lib/sale-registration";
import { bloquearStockInventario, reservadoPorProducto } from "@/lib/reserva";
import { PaymentMethod } from "@/lib/utils/payment";
import {
  actualizarEnvioSchema,
  cancelarPedidoSchema,
  cobrarPedidoSchema,
  createPedidoSchema,
  entregarPedidoSchema,
  getContadoresPedidosSchema,
  getPedidoSchema,
  getPedidosPorEstadoSchema,
  moverPedidoSchema,
  registrarSenaSchema,
  type EstadoEnvio,
  type EstadoPedido,
  type MetodoEnvio,
} from "@/lib/validations/pedido";

/**
 * Pedidos (U4). Zona de dinero: todo lo que cobra o libera plata pasa por acá.
 *
 * Reglas que sostiene este archivo: el precio y el saldo los calcula el servidor
 * (I7), la reserva es derivada y nunca supera el stock (I2), un pedido tiene a lo
 * sumo una `Sale` (I4) que se crea con el mismo helper que una venta común, la
 * suma de pagos no pasa el total (I5), una transición inválida no deja nada
 * escrito (I9) y el movimiento de stock lleva actor (I10).
 */

/** Prefijo del número de pedido: `V-0001`, con el lock de los códigos. */
const PEDIDO_PREFIX = "V";

/** Las únicas transiciones que mueven la tarjeta sin tocar plata (ADR §2.4). */
const MOVIMIENTOS = new Set([
  "PAGADO>PARA_ENVIAR",
  "PARA_ENVIAR>ENTREGADO",
  "ENTREGADO>PARA_ENVIAR",
  "PARA_ENVIAR>PAGADO", // la vuelta del diseño §2.4: corrección sin efecto en plata ni stock
]);

/** Orden de cada columna del Kanban (ADR §4). */
const ORDEN: Record<string, Prisma.PedidoOrderByWithRelationInput[]> = {
  RESERVADO: [{ venceEl: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  PAGADO: [{ pagadoAt: "asc" }],
  PARA_ENVIAR: [{ envioEstado: "asc" }, { pagadoAt: "asc" }],
  ENTREGADO: [{ entregadoAt: "desc" }],
  CANCELADO: [{ canceladoAt: "desc" }],
};

/** Error de negocio: el mensaje se devuelve tal cual (no es una falla técnica). */
class ErrorPedido extends Error {}

const dec = (valor: Prisma.Decimal.Value) => new Prisma.Decimal(valor);
const suma = (valores: Prisma.Decimal.Value[]) =>
  valores.reduce<Prisma.Decimal>((total, valor) => total.plus(dec(valor)), new Prisma.Decimal(0));

const zodMessage = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join(", ");

/** El medio de un pedido es el de sus pagos; `MIXTO` si no comparten uno. */
function medioDe(metodos: string[]): PaymentMethod | null {
  const unicos = new Set(metodos);
  if (unicos.size === 0) return null;
  return unicos.size === 1
    ? (metodos[0] as PaymentMethod)
    : PaymentMethod.MIXTO;
}

/** Número siguiente para el prefijo, tomando el máximo existente. */
function siguienteNumero(numeros: string[]): string {
  const maximo = numeros.reduce((max, numero) => {
    const secuencia = Number.parseInt(numero.slice(PEDIDO_PREFIX.length + 1), 10);
    return Number.isNaN(secuencia) ? max : Math.max(max, secuencia);
  }, 0);
  return `${PEDIDO_PREFIX}-${String(maximo + 1).padStart(4, "0")}`;
}

/**
 * Advisory lock de la fila de inventario (producto + sucursal): serializa la
 * reserva y la venta de la misma unidad entre transacciones. Es el mismo
 * mecanismo que usan los códigos de producto.
 */
async function lockStock(tx: Prisma.TransactionClient, productId: number, branchId: number) {
  await bloquearStockInventario(tx, productId, branchId);
}

/** Lo reservado por pedidos `RESERVADO`, por producto y sucursal (R1 derivada). */
async function reservadoActivo(
  tx: Prisma.TransactionClient,
  branchId: number,
  productIds: number[]
): Promise<Map<number, number>> {
  return reservadoPorProducto(tx, { branchId, productIds });
}

/**
 * Alta del pedido. Una sola sucursal para todos los ítems (S2), precios tomados
 * del servidor (I7), seña opcional que no pasa el total (I5) y chequeo de
 * disponible bajo lock: `stock − reservadoActivo ≥ cantidad` (I2).
 */
export async function createPedido(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = createPedidoSchema.parse(data);
    const actor = auth.email || "sistema";

    const [cliente, canal, sucursal] = await Promise.all([
      prisma.customer.findUnique({ where: { id: parsed.customerId }, select: { id: true } }),
      prisma.canalVenta.findFirst({
        where: { id: parsed.canalId, active: true },
        select: { id: true },
      }),
      prisma.branch.findFirst({
        where: { id: parsed.branchId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!cliente) return { success: false as const, error: "Cliente no encontrado" };
    if (!canal) return { success: false as const, error: "Canal de venta inválido o inactivo" };
    if (!sucursal) return { success: false as const, error: "Sucursal inválida o inactiva" };

    const creado = await prisma.$transaction(async (tx) => {
      // 1. Número de pedido: lock del prefijo y secuencia desde el máximo.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${prefixLockKey(PEDIDO_PREFIX)})`);
      const existentes = await tx.pedido.findMany({
        where: { numero: { startsWith: `${PEDIDO_PREFIX}-` } },
        select: { numero: true },
      });
      const numero = siguienteNumero(existentes.map((fila) => fila.numero));

      // 2. Disponibilidad: lock por (producto, sucursal) y reserva derivada.
      const productoIds = [...new Set(parsed.items.map((item) => item.productId))].sort(
        (a, b) => a - b
      );
      for (const productId of productoIds) {
        await lockStock(tx, productId, parsed.branchId);
      }

      const productos = await tx.product.findMany({
        where: { id: { in: productoIds }, active: true },
        select: { id: true, name: true, price: true },
      });
      for (const productId of productoIds) {
        if (!productos.some((producto) => producto.id === productId)) {
          throw new ErrorPedido(`Producto ${productId} no encontrado o inactivo`);
        }
      }

      const inventario = await tx.branchInventory.findMany({
        where: { branchId: parsed.branchId, productId: { in: productoIds } },
        select: { productId: true, stock: true },
      });
      const stockPorProducto = new Map(inventario.map((fila) => [fila.productId, fila.stock]));
      const reservado = await reservadoActivo(tx, parsed.branchId, productoIds);

      for (const item of parsed.items) {
        const disponible =
          (stockPorProducto.get(item.productId) ?? 0) - (reservado.get(item.productId) ?? 0);
        if (disponible < item.cantidad) {
          const nombre = productos.find((producto) => producto.id === item.productId)?.name;
          throw new ErrorPedido(
            `Sin stock disponible para "${nombre ?? item.productId}": disponible ${disponible}, el pedido pide ${item.cantidad}`
          );
        }
      }

      // 3. Precios del servidor (I7): foto del precio y del subtotal.
      const filas = parsed.items.map((item) => {
        const precio = dec(
          productos.find((producto) => producto.id === item.productId)?.price ?? 0
        );
        return {
          productId: item.productId,
          branchId: parsed.branchId,
          cantidad: item.cantidad,
          precio,
          subtotal: precio.mul(item.cantidad),
        };
      });
      const total = suma(filas.map((fila) => fila.subtotal));

      if (parsed.sena && dec(parsed.sena.monto).gt(total)) {
        throw new ErrorPedido("La seña no puede superar el total del pedido");
      }

      // 4. Cabecera con sus ítems y, si hay, la seña: todo o nada.
      return tx.pedido.create({
        data: {
          numero,
          customerId: parsed.customerId,
          canalId: parsed.canalId,
          total,
          venceEl: parsed.venceEl ?? null,
          createdBy: actor,
          updatedBy: actor,
          items: { create: filas },
          ...(parsed.sena
            ? {
                pagos: {
                  create: [
                    {
                      monto: dec(parsed.sena.monto),
                      metodo: parsed.sena.metodo,
                      performedBy: actor,
                    },
                  ],
                },
              }
            : {}),
        },
        select: { id: true, numero: true, total: true },
      });
    });

    revalidatePath("/ventas");
    revalidatePath("/ventas/pedidos");
    return { success: true as const, data: parseObject(creado) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    if (error instanceof ErrorPedido) {
      return { success: false as const, error: error.message };
    }
    console.error("Error al crear el pedido:", error);
    return { success: false as const, error: "Error al crear el pedido" };
  }
}

/**
 * Seña de un pedido reservado. La guarda optimista bloquea la fila hasta el
 * commit, así que dos señas simultáneas se serializan y no pasan el total (I5).
 */
export async function registrarSena(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = registrarSenaSchema.parse(data);
    const actor = auth.email || "sistema";

    const pago = await prisma.$transaction(async (tx) => {
      const guarda = await tx.pedido.updateMany({
        where: { id: parsed.id, estado: "RESERVADO" },
        data: { updatedBy: actor },
      });
      if (guarda.count !== 1) {
        throw new ErrorPedido(await estadoInvalido(tx, parsed.id, "seña"));
      }

      const pedido = await tx.pedido.findUnique({
        where: { id: parsed.id },
        select: { total: true, pagos: { select: { monto: true } } },
      });
      if (!pedido) throw new ErrorPedido("Pedido no encontrado");

      const monto = dec(parsed.monto);
      const cobrado = suma(pedido.pagos.map((fila) => fila.monto));
      if (cobrado.plus(monto).gt(dec(pedido.total))) {
        throw new ErrorPedido("La seña no puede superar el saldo del pedido");
      }

      return tx.pedidoPago.create({
        data: {
          pedidoId: parsed.id,
          monto,
          metodo: parsed.metodo,
          performedBy: actor,
        },
        select: { id: true, monto: true, metodo: true },
      });
    });

    revalidatePath("/ventas/pedidos");
    return { success: true as const, data: parseObject(pago) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    if (error instanceof ErrorPedido) {
      return { success: false as const, error: error.message };
    }
    console.error("Error al registrar la seña:", error);
    return { success: false as const, error: "Error al registrar la seña" };
  }
}

/**
 * Núcleo de plata del pedido: lo comparten `cobrarPedido` y `entregarPedido`.
 *
 * Espera la transición **ya reclamada**: el pedido dejó de ser RESERVADO, así
 * que su propia cantidad ya no cuenta en la reserva derivada y el chequeo de
 * stock de abajo mide solo lo que otros pedidos tienen tomado (I2). Calcula el
 * saldo en el servidor (I5, I7), registra la `Sale` con el helper de las ventas
 * (I4, I10) y deja el `PedidoPago` del saldo. Devuelve el `saleId` para que el
 * llamador lo escriba en su transición, antes del commit.
 */
async function cobrarTx(
  tx: Prisma.TransactionClient,
  opciones: { id: number; metodo: PaymentMethod; actor: string }
) {
  const { id, metodo, actor } = opciones;

  // 1. Lo que es plata se lee con la fila ya bloqueada (I5, I7).
  const pedido = await tx.pedido.findUnique({
    where: { id },
    select: {
      numero: true,
      total: true,
      customerId: true,
      items: {
        select: { productId: true, branchId: true, cantidad: true, precio: true },
      },
      pagos: { select: { monto: true, metodo: true } },
    },
  });
  if (!pedido) throw new ErrorPedido("Pedido no encontrado");
  if (pedido.items.length === 0) throw new ErrorPedido("El pedido no tiene productos");

  // Una sola sucursal por pedido (S2): la Sale sale de la del pedido.
  const branchId = pedido.items[0].branchId;
  if (pedido.items.some((item) => item.branchId !== branchId)) {
    throw new ErrorPedido("El pedido mezcla sucursales");
  }

  // 2. Stock de hoy: lo que reservan otros pedidos no se puede vender (I2).
  const productoIds = [...new Set(pedido.items.map((item) => item.productId))].sort(
    (a, b) => a - b
  );
  for (const productId of productoIds) {
    await lockStock(tx, productId, branchId);
  }
  const inventario = await tx.branchInventory.findMany({
    where: { branchId, productId: { in: productoIds } },
    select: { productId: true, stock: true },
  });
  const productos = await tx.product.findMany({
    where: { id: { in: productoIds } },
    select: { id: true, name: true },
  });
  const stockPorProducto = new Map(inventario.map((fila) => [fila.productId, fila.stock]));
  const reservado = await reservadoActivo(tx, branchId, productoIds);

  for (const item of pedido.items) {
    const disponible =
      (stockPorProducto.get(item.productId) ?? 0) - (reservado.get(item.productId) ?? 0);
    if (disponible < item.cantidad) {
      const nombre = productos.find((producto) => producto.id === item.productId)?.name;
      throw new ErrorPedido(
        `Sin stock disponible para "${nombre ?? item.productId}": disponible ${disponible}, el pedido pide ${item.cantidad}. Revisá el stock de la sucursal.`
      );
    }
  }

  // 3. Saldo y medio: cálculo del servidor, sin monto del cliente.
  const total = dec(pedido.total);
  const saldo = total.minus(suma(pedido.pagos.map((pago) => pago.monto)));
  const medios = new Set<string>(pedido.pagos.map((pago) => pago.metodo as string));
  if (saldo.gt(0)) medios.add(metodo);
  // Pedido de total 0 sin señas: sin medio en juego, la Sale sale en efectivo.
  const paymentMethod =
    medios.size === 0
      ? PaymentMethod.EFECTIVO
      : medios.size > 1
        ? PaymentMethod.MIXTO
        : ([...medios][0] as PaymentMethod);

  // 4. La venta es la de siempre: mismo helper que `registerSale`.
  const venta = await registrarVentaTx(tx, {
    branchId,
    items: pedido.items.map((item) => ({
      productId: item.productId,
      price: item.precio,
      quantity: item.cantidad,
    })),
    paymentMethod,
    performedBy: actor,
    totalAmount: total,
    amountPaid: total,
    pendingBalance: 0,
    customerId: pedido.customerId,
    reference: `PEDIDO-${pedido.numero}`,
  });

  // 5. El saldo cobrado hoy y el vínculo con la Sale (I4).
  if (saldo.gt(0)) {
    await tx.pedidoPago.create({
      data: {
        pedidoId: id,
        monto: saldo,
        metodo,
        performedBy: actor,
      },
    });
  }

  return { numero: pedido.numero, total, saldo, saleId: venta.sale.id };
}

/**
 * «Cobrada»: cobra el saldo y genera la `Sale` del pedido en una sola
 * transacción. El saldo y el medio se calculan acá (el cliente solo manda el
 * medio) y el stock se vuelve a validar hoy, bajo el lock de cada fila: un
 * pedido reservado cuyo stock se movió falla con un mensaje claro en vez de
 * vender de más (I2).
 */
export async function cobrarPedido(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = cobrarPedidoSchema.parse(data);
    const actor = auth.email || "sistema";

    const cobro = await prisma.$transaction(async (tx) => {
      // 1. Transición optimista: una sola pestaña cobra, y `pagadoAt` entra en
      //    la misma transacción que la venta (I9).
      const guarda = await tx.pedido.updateMany({
        where: { id: parsed.id, estado: "RESERVADO" },
        data: { estado: "PAGADO", pagadoAt: new Date(), updatedBy: actor },
      });
      if (guarda.count !== 1) {
        throw new ErrorPedido(await estadoInvalido(tx, parsed.id, "cobro"));
      }

      // 2. La plata, del núcleo compartido con la entrega.
      const plata = await cobrarTx(tx, {
        id: parsed.id,
        metodo: parsed.metodo,
        actor,
      });

      // 3. El vínculo con la Sale (I4), en la misma transacción.
      await tx.pedido.update({
        where: { id: parsed.id },
        data: { saleId: plata.saleId },
      });

      return {
        id: parsed.id,
        numero: plata.numero,
        saleId: plata.saleId,
        total: plata.total,
        saldo: plata.saldo,
      };
    });

    revalidatePath("/ventas");
    revalidatePath("/ventas/pedidos");
    revalidatePath("/inventario");
    return { success: true as const, data: parseObject(cobro) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    if (error instanceof ErrorPedido) {
      return { success: false as const, error: error.message };
    }
    console.error("Error al cobrar el pedido:", error);
    return { success: false as const, error: "Error al cobrar el pedido" };
  }
}

/**
 * «Entregar y cobrar» (L8-2): el cliente paga al retirar. Es la otra puerta a
 * PAGADO —directo a ENTREGADO— y la plata es exactamente la del cobro, porque
 * las dos pasan por `cobrarTx`: la seña previa se descuenta y el saldo se
 * registra en el momento de la entrega.
 *
 * Invariante del dueño: **no hay ENTREGADO sin `Sale`**. La entrega se reclama
 * con guarda optimista (una sola pestaña), la `Sale` se crea en la misma
 * transacción y el `saleId` se escribe antes del commit; si algo falla, el
 * pedido sigue RESERVADO y el stock en el estante.
 */
export async function entregarPedido(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = entregarPedidoSchema.parse(data);
    const actor = auth.email || "sistema";

    const entrega = await prisma.$transaction(async (tx) => {
      const ahora = new Date();

      // 1. La reserva se libera al entregar: mismo orden que el cobro, y es lo
      //    que deja al pedido fuera de la reserva derivada antes del chequeo de
      //    stock del núcleo (I2).
      const guarda = await tx.pedido.updateMany({
        where: { id: parsed.id, estado: "RESERVADO" },
        data: {
          estado: "ENTREGADO",
          pagadoAt: ahora,
          entregadoAt: ahora,
          updatedBy: actor,
        },
      });
      if (guarda.count !== 1) {
        throw new ErrorPedido(await estadoInvalido(tx, parsed.id, "entrega"));
      }

      // 2. La plata, del núcleo compartido con el cobro. Sin Sale no hay entrega.
      const plata = await cobrarTx(tx, {
        id: parsed.id,
        metodo: parsed.metodo,
        actor,
      });

      // 3. El vínculo con la Sale (I4), antes del commit.
      await tx.pedido.update({
        where: { id: parsed.id },
        data: { saleId: plata.saleId },
      });

      return {
        id: parsed.id,
        numero: plata.numero,
        saleId: plata.saleId,
        total: plata.total,
        saldo: plata.saldo,
      };
    });

    revalidatePath("/ventas");
    revalidatePath("/ventas/pedidos");
    revalidatePath("/inventario");
    return { success: true as const, data: parseObject(entrega) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    if (error instanceof ErrorPedido) {
      return { success: false as const, error: error.message };
    }
    console.error("Error al entregar el pedido:", error);
    return { success: false as const, error: "Error al entregar el pedido" };
  }
}

/**
 * Mensaje para una transición que no se pudo hacer: distingue «no existe» de
 * «está en otro estado» y deja el detalle de cada acción.
 */
async function estadoInvalido(
  tx: Prisma.TransactionClient,
  id: number,
  accion: "seña" | "cobro" | "entrega" | "cancelación"
): Promise<string> {
  const actual = await tx.pedido.findUnique({ where: { id }, select: { estado: true } });
  if (!actual) return "Pedido no encontrado";
  if (actual.estado === "RESERVADO") return "El pedido cambió de estado; recargá";

  if (accion === "seña") return "Solo se puede registrar una seña en un pedido reservado";
  if (accion === "cobro") return "Solo se puede cobrar un pedido reservado";
  if (accion === "entrega") return "Solo se puede entregar un pedido reservado";
  return "Solo se puede cancelar un pedido reservado";
}

/**
 * Mueve la tarjeta entre las columnas que no tocan plata. Nada entra a PAGADO
 * por acá (se cobra) y CANCELADO es terminal.
 */
export async function moverPedido(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = moverPedidoSchema.parse(data);
    const actor = auth.email || "sistema";
    const clave = `${parsed.desde}>${parsed.hacia}`;

    // A PAGADO solo se entra cobrando, salvo la vuelta de corrección desde PARA_ENVIAR (§2.4).
    if (parsed.hacia === "PAGADO" && parsed.desde !== "PARA_ENVIAR") {
      return { success: false as const, error: "Para pasar a Pagado hay que cobrar el pedido" };
    }
    if (parsed.desde === "CANCELADO") {
      return { success: false as const, error: "Un pedido cancelado no se puede mover" };
    }
    if (!MOVIMIENTOS.has(clave)) {
      return {
        success: false as const,
        error: `Transición no permitida: ${parsed.desde} → ${parsed.hacia}`,
      };
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id: parsed.id },
      select: { estado: true, ciudad: true, envioMetodo: true, saleId: true },
    });
    if (!pedido) return { success: false as const, error: "Pedido no encontrado" };
    if (pedido.estado !== parsed.desde) {
      return { success: false as const, error: "El pedido cambió de estado; recargá" };
    }

    const datos: Prisma.PedidoUpdateManyMutationInput = {
      estado: parsed.hacia,
      updatedBy: actor,
    };

    if (clave === "PAGADO>PARA_ENVIAR") {
      const metodo = parsed.envioMetodo ?? pedido.envioMetodo;
      if (!metodo) return { success: false as const, error: "Elegí el método de envío" };
      const ciudad = parsed.ciudad ?? pedido.ciudad;
      if (!ciudad && metodo !== "RETIRO") {
        return {
          success: false as const,
          error: "La ciudad es obligatoria para un envío que no es retiro",
        };
      }
      datos.envioMetodo = metodo as MetodoEnvio;
      datos.envioEstado = "COORDINAR" as EstadoEnvio;
      datos.ciudad = ciudad ?? null;
    }

    // Invariante del dueño: nada llega a ENTREGADO sin su venta registrada. El
    // flujo normal garantiza el saleId (PARA_ENVIAR solo se alcanza cobrando),
    // pero una fila legada importada sin venta no debe poder entregarse igual.
    if (parsed.hacia === "ENTREGADO" && !pedido.saleId) {
      return {
        success: false as const,
        error: "El pedido no tiene su venta registrada; cobralo antes de entregarlo",
      };
    }

    if (parsed.hacia === "ENTREGADO") datos.entregadoAt = new Date();
    if (clave === "ENTREGADO>PARA_ENVIAR") datos.entregadoAt = null;

    const movido = await prisma.pedido.updateMany({
      where: { id: parsed.id, estado: parsed.desde },
      data: datos,
    });
    if (movido.count !== 1) {
      return { success: false as const, error: "El pedido cambió de estado; recargá" };
    }

    revalidatePath("/ventas/pedidos");
    return { success: true as const, data: { id: parsed.id, estado: parsed.hacia } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    console.error("Error al mover el pedido:", error);
    return { success: false as const, error: "Error al mover el pedido" };
  }
}

/** Datos de envío: solo tienen sentido una vez cobrado el pedido. */
export async function actualizarEnvio(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = actualizarEnvioSchema.parse(data);
    const actor = auth.email || "sistema";

    const actualizado = await prisma.pedido.updateMany({
      where: { id: parsed.id, estado: { in: ["PAGADO", "PARA_ENVIAR"] } },
      data: {
        envioMetodo: parsed.envioMetodo,
        envioEstado: parsed.envioEstado,
        ciudad: parsed.ciudad ?? null,
        updatedBy: actor,
      },
    });
    if (actualizado.count !== 1) {
      const actual = await prisma.pedido.findUnique({
        where: { id: parsed.id },
        select: { estado: true },
      });
      if (!actual) return { success: false as const, error: "Pedido no encontrado" };
      return {
        success: false as const,
        error: "Solo se puede actualizar el envío de un pedido pagado o para enviar",
      };
    }

    revalidatePath("/ventas/pedidos");
    return { success: true as const, data: { id: parsed.id } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    console.error("Error al actualizar el envío:", error);
    return { success: false as const, error: "Error al actualizar el envío" };
  }
}

/**
 * Cancela una reserva. La reserva se libera sola (es derivada) y la seña **no**
 * tiene asiento automático: el motivo, que es texto libre, registra qué se
 * decidió con esa plata caso por caso.
 */
export async function cancelarPedido(data: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = cancelarPedidoSchema.parse(data);
    const actor = auth.email || "sistema";

    const cancelado = await prisma.$transaction(async (tx) => {
      const guarda = await tx.pedido.updateMany({
        where: { id: parsed.id, estado: "RESERVADO" },
        // `notas` es el único texto libre del pedido y no se usa en otra acción.
        data: {
          estado: "CANCELADO",
          canceladoAt: new Date(),
          notas: parsed.motivo,
          updatedBy: actor,
        },
      });
      if (guarda.count !== 1) {
        throw new ErrorPedido(await estadoInvalido(tx, parsed.id, "cancelación"));
      }
      return { id: parsed.id, estado: "CANCELADO" as EstadoPedido };
    });

    revalidatePath("/ventas/pedidos");
    return { success: true as const, data: cancelado };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    if (error instanceof ErrorPedido) {
      return { success: false as const, error: error.message };
    }
    console.error("Error al cancelar el pedido:", error);
    return { success: false as const, error: "Error al cancelar el pedido" };
  }
}

/** Select cerrado de la tarjeta del Kanban (ADR §4): nada de más al cliente. */
const TARJETA_SELECT = {
  id: true,
  numero: true,
  ciudad: true,
  total: true,
  venceEl: true,
  pagadoAt: true,
  entregadoAt: true,
  envioMetodo: true,
  envioEstado: true,
  canal: { select: { name: true } },
  customer: { select: { name: true, surname: true } },
  items: { select: { cantidad: true, product: { select: { name: true } } }, take: 3 },
  pagos: { select: { monto: true, metodo: true } },
  _count: { select: { items: true } },
} as const;

type FilaTarjeta = {
  id: number;
  numero: string;
  ciudad: string | null;
  total: Prisma.Decimal;
  venceEl: Date | null;
  pagadoAt: Date | null;
  entregadoAt: Date | null;
  envioMetodo: string | null;
  envioEstado: string | null;
  canal: { name: string };
  customer: { name: string; surname: string };
  items: Array<{ cantidad: number; product: { name: string } }>;
  pagos: Array<{ monto: Prisma.Decimal; metodo: string }>;
  _count: { items: number };
};

function tarjeta(fila: FilaTarjeta) {
  const senas = suma(fila.pagos.map((pago) => pago.monto));
  return {
    id: fila.id,
    numero: fila.numero,
    canal: fila.canal.name,
    cliente: `${fila.customer.name} ${fila.customer.surname}`.trim(),
    ciudad: fila.ciudad,
    items: fila.items.map((item) => ({ nombre: item.product.name, cantidad: item.cantidad })),
    itemsRestantes: Math.max(0, fila._count.items - fila.items.length),
    senas,
    saldo: dec(fila.total).minus(senas),
    medio: medioDe(fila.pagos.map((pago) => pago.metodo)),
    envioMetodo: fila.envioMetodo,
    envioEstado: fila.envioEstado,
    total: fila.total,
    venceEl: fila.venceEl,
    pagadoAt: fila.pagadoAt,
    entregadoAt: fila.entregadoAt,
  };
}

/** Trae el detalle completo de un pedido para el panel y el paso de cobro. */
export async function getPedido(id: number) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = getPedidoSchema.parse({ id });

    const pedido = await prisma.pedido.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        numero: true,
        estado: true,
        total: true,
        venceEl: true,
        envioMetodo: true,
        envioEstado: true,
        ciudad: true,
        notas: true,
        saleId: true,
        createdAt: true,
        pagadoAt: true,
        entregadoAt: true,
        canceladoAt: true,
        createdBy: true,
        updatedBy: true,
        canal: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, surname: true, phone: true } },
        items: {
          select: {
            id: true,
            cantidad: true,
            precio: true,
            subtotal: true,
            branchId: true,
            product: { select: { id: true, name: true, code: true } },
          },
        },
        pagos: {
          select: { id: true, monto: true, metodo: true, fecha: true, performedBy: true },
        },
      },
    });
    if (!pedido) return { success: false as const, error: "Pedido no encontrado" };

    const senas = suma(pedido.pagos.map((pago) => pago.monto));
    return {
      success: true as const,
      data: parseObject({
        ...pedido,
        canal: pedido.canal.name,
        senas,
        saldo: dec(pedido.total).minus(senas),
        medio: medioDe(pedido.pagos.map((pago) => pago.metodo)),
      }),
    };
  } catch (error) {
    console.error("Error al obtener el pedido:", error);
    return { success: false as const, error: "Error al obtener el pedido" };
  }
}

/**
 * Una columna del Kanban: `take` acotado, cursor por id y el `select` cerrado de
 * la tarjeta. Entregados muestra solo los últimos 30 días (la columna que crece).
 */
export async function getPedidosPorEstado(filtros: unknown) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = getPedidosPorEstadoSchema.parse(filtros);
    const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const filas = await prisma.pedido.findMany({
      where: {
        estado: parsed.estado,
        ...(parsed.canalId ? { canalId: parsed.canalId } : {}),
        ...(parsed.estado === "ENTREGADO" ? { entregadoAt: { gte: hace30Dias } } : {}),
      },
      orderBy: ORDEN[parsed.estado],
      take: parsed.take,
      ...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
      select: TARJETA_SELECT,
    });

    return { success: true as const, data: parseArray(filas.map(tarjeta)) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    console.error("Error al obtener los pedidos:", error);
    return { success: false as const, error: "Error al obtener los pedidos" };
  }
}

/** Conteos de las columnas del tablero, con el filtro de canal opcional. */
export async function getContadoresPedidos(canalId?: number) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = getContadoresPedidosSchema.parse({ canalId });
    const filas = await prisma.pedido.groupBy({
      by: ["estado"],
      where: parsed.canalId ? { canalId: parsed.canalId } : {},
      _count: { _all: true },
    });

    const contadores: Record<EstadoPedido, number> = {
      RESERVADO: 0,
      PAGADO: 0,
      PARA_ENVIAR: 0,
      ENTREGADO: 0,
      CANCELADO: 0,
    };
    for (const fila of filas) {
      contadores[fila.estado as EstadoPedido] = fila._count._all;
    }

    return { success: true as const, data: contadores };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    console.error("Error al contar los pedidos:", error);
    return { success: false as const, error: "Error al contar los pedidos" };
  }
}
