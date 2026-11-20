/** @jest-environment node */

/**
 * Pedidos — capa servidor (U4). Zona de dinero: lo que se fija acá es
 *   - guardián admin primero, después Zod, después Prisma (en cada acción);
 *   - `createPedido`: número `V-####` con lock, precio del servidor (I7),
 *     chequeo `stock − reservadoActivo ≥ cantidad` bajo lock (I2), una sola
 *     sucursal (S2) y seña ≤ total (I5);
 *   - `registrarSena`: solo RESERVADO y la suma de pagos nunca supera el total;
 *   - `cobrarPedido`: saldo y medio calculados en el servidor, transición
 *     optimista, `PedidoPago` del saldo, `Sale` por el mismo helper que
 *     `registerSale` (I4/I10) y `saleId`/`pagadoAt` en la misma transacción;
 *   - `moverPedido`: solo las tres transiciones sin plata, nada hacia PAGADO;
 *   - `cancelarPedido`: motivo obligatorio y solo desde RESERVADO;
 *   - las consultas del Kanban: forma cerrada de la tarjeta.
 */
import { Prisma } from "@prisma/client";

import {
  createPedido,
  registrarSena,
  cobrarPedido,
  moverPedido,
  actualizarEnvio,
  cancelarPedido,
  getPedidosPorEstado,
  getContadoresPedidos,
  getPedido,
} from "./pedido";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { registrarVentaTx } from "@/lib/sale-registration";
import { prefixLockKey } from "@/lib/utils/product-code";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/sale-registration", () => ({
  registrarVentaTx: jest.fn(async () => ({
    sale: { id: 55 },
    items: [],
    totalAmount: 0,
  })),
}));

jest.mock("@/lib/prisma", () => {
  const delegado = () => ({
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  });
  const delegados = {
    branch: delegado(),
    customer: delegado(),
    canalVenta: delegado(),
    pedido: delegado(),
    pedidoItem: delegado(),
    pedidoPago: delegado(),
    product: delegado(),
    branchInventory: delegado(),
    sale: delegado(),
    saleItem: delegado(),
    branchMovement: delegado(),
  };
  const $executeRawUnsafe = jest.fn(async () => undefined);
  const tx = { ...delegados, $executeRawUnsafe };
  const $transaction = jest.fn(async (callback: (t: unknown) => Promise<unknown>) =>
    callback(tx)
  );

  return { prisma: { ...delegados, $executeRawUnsafe, $transaction } };
});

const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockVentaTx = registrarVentaTx as jest.MockedFunction<typeof registrarVentaTx>;
const mockRevalidate = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

const dec = (valor: string | number) => new Prisma.Decimal(valor);

/** Alta mínima válida: una prenda única del depósito (sucursal 3), con seña. */
const alta = {
  customerId: 1,
  canalId: 2,
  branchId: 3,
  items: [{ productId: 10, cantidad: 1 }],
  sena: { monto: 5000, metodo: "EFECTIVO" },
  venceEl: "2099-01-01",
};

/** Lecturas previas y de la transacción en el camino feliz del alta. */
function prepararAlta() {
  (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
  (prisma.canalVenta.findFirst as jest.Mock).mockResolvedValue({ id: 2 });
  (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 3 });
  (prisma.pedido.findMany as jest.Mock).mockResolvedValue([{ numero: "V-0001" }]);
  (prisma.product.findMany as jest.Mock).mockResolvedValue([
    { id: 10, name: "Campera", price: dec("12000.00") },
  ]);
  (prisma.branchInventory.findMany as jest.Mock).mockResolvedValue([
    { productId: 10, stock: 1 },
  ]);
  (prisma.pedidoItem.groupBy as jest.Mock).mockResolvedValue([]);
  (prisma.pedido.create as jest.Mock).mockResolvedValue({
    id: 7,
    numero: "V-0002",
    total: dec("12000.00"),
  });
}

/** Pedido reservado con una seña de 5.000 sobre un total de 12.000. */
function prepararCobro(pagos: Array<{ monto: Prisma.Decimal; metodo: string }> = [
  { monto: dec("5000.00"), metodo: "EFECTIVO" },
]) {
  (prisma.pedido.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
    id: 7,
    numero: "V-0002",
    estado: "RESERVADO",
    total: dec("12000.00"),
    customerId: 1,
    ciudad: "Córdoba",
    envioMetodo: null,
    items: [
      { productId: 10, branchId: 3, cantidad: 1, precio: dec("12000.00") },
    ],
    pagos,
  });
  (prisma.branchInventory.findMany as jest.Mock).mockResolvedValue([
    { productId: 10, stock: 1 },
  ]);
  (prisma.pedidoItem.groupBy as jest.Mock).mockResolvedValue([]);
  (prisma.product.findMany as jest.Mock).mockResolvedValue([
    { id: 10, name: "Campera" },
  ]);
}

beforeEach(() => {
  jest.clearAllMocks();
  prepararAlta();
});

// AGENTS.md §0.2: sesión + rol admin antes de validar y antes de Prisma.
describe("pedidos: autorización admin", () => {
  async function rechaza(accion: () => Promise<unknown>) {
    mockRequireAdmin.mockResolvedValueOnce({ ok: false, error: "No autorizado" });

    expect(await accion()).toEqual({ success: false, error: "No autorizado" });
    // Ni Zod ni Prisma: el guardián corta antes de todo.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.pedido.findMany).not.toHaveBeenCalled();
    expect(prisma.pedido.groupBy).not.toHaveBeenCalled();
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  }

  it("rechaza cada acción sin sesión admin y no toca Prisma", async () => {
    await rechaza(() => createPedido({}));
    await rechaza(() => registrarSena({}));
    await rechaza(() => cobrarPedido({}));
    await rechaza(() => moverPedido({}));
    await rechaza(() => actualizarEnvio({}));
    await rechaza(() => cancelarPedido({}));
    await rechaza(() => getPedidosPorEstado({}));
    await rechaza(() => getContadoresPedidos());
    await rechaza(() => getPedido(1));
  });
});

describe("createPedido", () => {
  it("crea el pedido con número secuencial, precio del servidor y la seña", async () => {
    const result = await createPedido(alta);

    expect(result).toEqual({
      success: true,
      data: { id: 7, numero: "V-0002", total: 12000 },
    });

    // Lock del prefijo y lock de la fila de stock (producto, sucursal).
    const sql = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(sql).toEqual([
      `SELECT pg_advisory_xact_lock(${prefixLockKey("V")})`,
      "SELECT pg_advisory_xact_lock(10, 3)",
    ]);
    // El número sale de los existentes con el prefijo, bajo el lock.
    expect(prisma.pedido.findMany).toHaveBeenCalledWith({
      where: { numero: { startsWith: "V-" } },
      select: { numero: true },
    });
    // La reserva es derivada: se suma lo reservado en la misma transacción.
    expect(prisma.pedidoItem.groupBy).toHaveBeenCalledWith({
      by: ["productId"],
      where: {
        branchId: 3,
        productId: { in: [10] },
        pedido: { estado: "RESERVADO" },
      },
      _sum: { cantidad: true },
    });

    const datos = (prisma.pedido.create as jest.Mock).mock.calls[0][0].data;
    expect(datos).toMatchObject({
      numero: "V-0002",
      customerId: 1,
      canalId: 2,
      createdBy: "test@feria.test",
      updatedBy: "test@feria.test",
    });
    expect(datos.venceEl).toEqual(new Date("2099-01-01"));

    // Precio del servidor (I7): lo que devolvió la base, no lo que manda el cliente.
    expect(datos.items.create).toHaveLength(1);
    expect(datos.items.create[0]).toMatchObject({
      productId: 10,
      branchId: 3,
      cantidad: 1,
    });
    expect(String(datos.items.create[0].precio)).toBe("12000");
    expect(String(datos.items.create[0].subtotal)).toBe("12000");
    expect(String(datos.total)).toBe("12000");

    expect(datos.pagos.create).toEqual([
      {
        monto: expect.anything(),
        metodo: "EFECTIVO",
        performedBy: "test@feria.test",
      },
    ]);
    expect(String(datos.pagos.create[0].monto)).toBe("5000");

    expect(mockRevalidate).toHaveBeenCalledWith("/ventas");
    expect(mockRevalidate).toHaveBeenCalledWith("/ventas/pedidos");
  });

  it("el primer pedido de la serie arranca en V-0001", async () => {
    (prisma.pedido.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.pedido.create as jest.Mock).mockResolvedValue({
      id: 1,
      numero: "V-0001",
      total: dec("12000.00"),
    });

    const result = await createPedido(alta);

    expect(result.success).toBe(true);
    expect((prisma.pedido.create as jest.Mock).mock.calls[0][0].data.numero).toBe("V-0001");
  });

  it("no acepta precio del cliente ni un pedido sin ítems", async () => {
    // El precio viaja en el payload: se ignora porque el esquema no lo declara.
    const conPrecio = await createPedido({
      ...alta,
      items: [{ productId: 10, cantidad: 1, precio: 1 }],
    });
    expect(conPrecio.success).toBe(true);
    const datos = (prisma.pedido.create as jest.Mock).mock.calls[0][0].data;
    expect(String(datos.total)).toBe("12000");

    (prisma.pedido.create as jest.Mock).mockClear();
    const sinItems = await createPedido({ ...alta, items: [] });
    expect(sinItems).toEqual({
      success: false,
      error: "El pedido necesita al menos un producto",
    });
    expect(prisma.pedido.create).not.toHaveBeenCalled();
  });

  it("rechaza el mismo producto repetido en dos líneas", async () => {
    const result = await createPedido({
      ...alta,
      items: [
        { productId: 10, cantidad: 1 },
        { productId: 10, cantidad: 1 },
      ],
    });

    expect(result).toEqual({
      success: false,
      error: "Un producto no puede repetirse en el pedido",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza el pedido si lo reservado ya cubre el stock disponible", async () => {
    (prisma.pedidoItem.groupBy as jest.Mock).mockResolvedValue([
      { productId: 10, _sum: { cantidad: 1 } },
    ]);

    const result = await createPedido(alta);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe(
      'Sin stock disponible para "Campera": disponible 0, el pedido pide 1'
    );
    expect(prisma.pedido.create).not.toHaveBeenCalled();
  });

  it("una prenda ya vendida (stock 0) no se puede reservar", async () => {
    (prisma.branchInventory.findMany as jest.Mock).mockResolvedValue([]);

    const result = await createPedido(alta);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Sin stock disponible");
    expect(prisma.pedido.create).not.toHaveBeenCalled();
  });

  it("la seña no puede superar el total (I5)", async () => {
    const result = await createPedido({ ...alta, sena: { monto: 12000.01, metodo: "EFECTIVO" } });

    expect(result).toEqual({
      success: false,
      error: "La seña no puede superar el total del pedido",
    });
    expect(prisma.pedido.create).not.toHaveBeenCalled();
  });

  it("un vencimiento pasado se rechaza antes de tocar la base", async () => {
    const result = await createPedido({ ...alta, venceEl: "2020-01-01" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("El vencimiento tiene que ser una fecha futura");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza cliente, canal o sucursal inexistentes", async () => {
    (prisma.customer.findUnique as jest.Mock).mockResolvedValueOnce(null);
    expect(await createPedido(alta)).toEqual({
      success: false,
      error: "Cliente no encontrado",
    });

    (prisma.canalVenta.findFirst as jest.Mock).mockResolvedValueOnce(null);
    expect(await createPedido(alta)).toEqual({
      success: false,
      error: "Canal de venta inválido o inactivo",
    });

    (prisma.branch.findFirst as jest.Mock).mockResolvedValueOnce(null);
    expect(await createPedido(alta)).toEqual({
      success: false,
      error: "Sucursal inválida o inactiva",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("un producto inactivo no se reserva", async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

    const result = await createPedido(alta);

    expect(result).toEqual({
      success: false,
      error: "Producto 10 no encontrado o inactivo",
    });
    expect(prisma.pedido.create).not.toHaveBeenCalled();
  });
});

describe("registrarSena", () => {
  it("escribe la seña si el pedido sigue reservado y no se pasa del total (I5)", async () => {
    (prisma.pedido.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      total: dec("12000.00"),
      pagos: [{ monto: dec("5000.00") }],
    });
    (prisma.pedidoPago.create as jest.Mock).mockResolvedValue({
      id: 9,
      monto: dec("3000.00"),
      metodo: "TRANSFERENCIA",
    });

    const result = await registrarSena({ id: 7, monto: 3000, metodo: "TRANSFERENCIA" });

    expect(result).toEqual({
      success: true,
      data: { id: 9, monto: 3000, metodo: "TRANSFERENCIA" },
    });
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
      where: { id: 7, estado: "RESERVADO" },
      data: { updatedBy: "test@feria.test" },
    });
    const pago = (prisma.pedidoPago.create as jest.Mock).mock.calls[0][0].data;
    expect(pago).toMatchObject({ pedidoId: 7, metodo: "TRANSFERENCIA" });
    expect(String(pago.monto)).toBe("3000");
    expect(pago.performedBy).toBe("test@feria.test");
    expect(mockRevalidate).toHaveBeenCalledWith("/ventas/pedidos");
  });

  it("rechaza la seña que pasa el saldo del pedido", async () => {
    (prisma.pedido.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      total: dec("12000.00"),
      pagos: [{ monto: dec("11000.00") }],
    });

    const result = await registrarSena({ id: 7, monto: 1000.01, metodo: "EFECTIVO" });

    expect(result).toEqual({
      success: false,
      error: "La seña no puede superar el saldo del pedido",
    });
    expect(prisma.pedidoPago.create).not.toHaveBeenCalled();
  });

  it("solo un pedido RESERVADO acepta señas", async () => {
    (prisma.pedido.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({ estado: "PAGADO" });

    expect(await registrarSena({ id: 7, monto: 100, metodo: "EFECTIVO" })).toEqual({
      success: false,
      error: "Solo se puede registrar una seña en un pedido reservado",
    });
    expect(prisma.pedidoPago.create).not.toHaveBeenCalled();
  });

  it("un monto no positivo no llega a Prisma", async () => {
    expect(await registrarSena({ id: 7, monto: 0, metodo: "EFECTIVO" })).toEqual({
      success: false,
      error: "La seña debe ser mayor a 0",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("cobrarPedido", () => {
  it("cobra el saldo, crea la Sale con el helper de ventas y las dos marcas", async () => {
    prepararCobro();

    const result = await cobrarPedido({ id: 7, metodo: "EFECTIVO" });

    expect(result).toEqual({
      success: true,
      data: { id: 7, numero: "V-0002", saleId: 55, total: 12000, saldo: 7000 },
    });

    // Transición optimista con su fecha, en la misma transacción.
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
      where: { id: 7, estado: "RESERVADO" },
      data: {
        estado: "PAGADO",
        pagadoAt: expect.any(Date),
        updatedBy: "test@feria.test",
      },
    });

    // La venta: mismos ítems, precios foto, cobrado el total y el actor (I10).
    const [tx, venta] = mockVentaTx.mock.calls[0];
    expect(tx).toBeTruthy();
    expect(venta).toMatchObject({
      branchId: 3,
      paymentMethod: "EFECTIVO",
      performedBy: "test@feria.test",
      customerId: 1,
      reference: "PEDIDO-V-0002",
    });
    expect(venta.items).toHaveLength(1);
    expect(venta.items[0]).toMatchObject({ productId: 10, quantity: 1 });
    expect(String(venta.items[0].price)).toBe("12000");
    expect(String(venta.amountPaid)).toBe("12000");

    // El saldo cobrado hoy queda registrado como pago del pedido.
    const pago = (prisma.pedidoPago.create as jest.Mock).mock.calls[0][0].data;
    expect(pago).toMatchObject({ pedidoId: 7, metodo: "EFECTIVO" });
    expect(String(pago.monto)).toBe("7000");

    // El vínculo con la Sale se escribe antes del commit (I4).
    expect(prisma.pedido.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { saleId: 55 },
    });
    expect(mockRevalidate).toHaveBeenCalledWith("/ventas");
    expect(mockRevalidate).toHaveBeenCalledWith("/ventas/pedidos");
    expect(mockRevalidate).toHaveBeenCalledWith("/inventario");
  });

  it("una seña con otro medio deja la Sale como MIXTO", async () => {
    prepararCobro([{ monto: dec("5000.00"), metodo: "TRANSFERENCIA" }]);

    const result = await cobrarPedido({ id: 7, metodo: "EFECTIVO" });

    expect(result.success).toBe(true);
    expect(mockVentaTx.mock.calls[0][1].paymentMethod).toBe("MIXTO");
  });

  it("si la seña cubrió todo, no inventa un pago de saldo 0", async () => {
    prepararCobro([{ monto: dec("12000.00"), metodo: "TRANSFERENCIA" }]);

    const result = await cobrarPedido({ id: 7, metodo: "EFECTIVO" });

    expect(result.success).toBe(true);
    expect(prisma.pedidoPago.create).not.toHaveBeenCalled();
    // Sin saldo nuevo, el medio de la venta es el de las señas.
    expect(mockVentaTx.mock.calls[0][1].paymentMethod).toBe("TRANSFERENCIA");
  });

  it("un pedido de total 0 sin señas cobra en efectivo (sin medio en juego)", async () => {
    prepararCobro();
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      numero: "V-0002",
      total: dec("0.00"),
      customerId: 1,
      items: [{ productId: 10, branchId: 3, cantidad: 1, precio: dec("0.00") }],
      pagos: [],
      estado: "RESERVADO",
      saleId: null,
    });

    const result = await cobrarPedido({ id: 7, metodo: "EFECTIVO" });

    expect(result.success).toBe(true);
    expect(prisma.pedidoPago.create).not.toHaveBeenCalled();
    expect(mockVentaTx.mock.calls[0][1].paymentMethod).toBe("EFECTIVO");
  });

  it("el monto no lo manda el cliente: el saldo se calcula en el servidor", async () => {
    prepararCobro();

    await cobrarPedido({ id: 7, metodo: "EFECTIVO", monto: 1 });

    expect(String((prisma.pedidoPago.create as jest.Mock).mock.calls[0][0].data.monto)).toBe(
      "7000"
    );
  });

  it("no cobra si el estado ya cambió (concurrencia optimista)", async () => {
    (prisma.pedido.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({ estado: "RESERVADO" });

    expect(await cobrarPedido({ id: 7, metodo: "EFECTIVO" })).toEqual({
      success: false,
      error: "El pedido cambió de estado; recargá",
    });
    expect(mockVentaTx).not.toHaveBeenCalled();
  });

  it("un pedido ya pagado no se cobra dos veces (I4)", async () => {
    (prisma.pedido.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({ estado: "PAGADO" });

    expect(await cobrarPedido({ id: 7, metodo: "EFECTIVO" })).toEqual({
      success: false,
      error: "Solo se puede cobrar un pedido reservado",
    });
    expect(prisma.pedidoPago.create).not.toHaveBeenCalled();
    expect(mockVentaTx).not.toHaveBeenCalled();
  });

  it("si el stock se movió, no vende lo reservado (I2)", async () => {
    prepararCobro();
    (prisma.branchInventory.findMany as jest.Mock).mockResolvedValue([]);

    const result = await cobrarPedido({ id: 7, metodo: "EFECTIVO" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe(
      'Sin stock disponible para "Campera": disponible 0, el pedido pide 1. Revisá el stock de la sucursal.'
    );
    expect(mockVentaTx).not.toHaveBeenCalled();
    expect(prisma.pedidoPago.create).not.toHaveBeenCalled();
  });

  it("no cobra un pedido que mezcla sucursales", async () => {
    prepararCobro();
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      numero: "V-0002",
      total: dec("12000.00"),
      customerId: 1,
      items: [
        { productId: 10, branchId: 3, cantidad: 1, precio: dec("6000.00") },
        { productId: 11, branchId: 4, cantidad: 1, precio: dec("6000.00") },
      ],
      pagos: [],
    });

    expect(await cobrarPedido({ id: 7, metodo: "EFECTIVO" })).toEqual({
      success: false,
      error: "El pedido mezcla sucursales",
    });
    expect(mockVentaTx).not.toHaveBeenCalled();
  });

  it("exige un medio de pago válido", async () => {
    expect(await cobrarPedido({ id: 7, metodo: "BITCOIN" })).toMatchObject({
      success: false,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("moverPedido", () => {
  beforeEach(() => {
    (prisma.pedido.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  it("PAGADO → PARA_ENVIAR exige el método de envío y arranca en COORDINAR", async () => {
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      estado: "PAGADO",
      ciudad: null,
      envioMetodo: null,
    });

    const result = await moverPedido({
      id: 7,
      desde: "PAGADO",
      hacia: "PARA_ENVIAR",
      envioMetodo: "CORREO",
      ciudad: "Córdoba",
    });

    expect(result).toEqual({
      success: true,
      data: { id: 7, estado: "PARA_ENVIAR" },
    });
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
      where: { id: 7, estado: "PAGADO" },
      data: {
        estado: "PARA_ENVIAR",
        envioMetodo: "CORREO",
        envioEstado: "COORDINAR",
        ciudad: "Córdoba",
        updatedBy: "test@feria.test",
      },
    });
  });

  it("sin método de envío no se prepara el pedido", async () => {
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      estado: "PAGADO",
      ciudad: "Córdoba",
      envioMetodo: null,
    });

    expect(
      await moverPedido({ id: 7, desde: "PAGADO", hacia: "PARA_ENVIAR" })
    ).toEqual({ success: false, error: "Elegí el método de envío" });
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  it("una ciudad es obligatoria salvo que sea retiro", async () => {
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      estado: "PAGADO",
      ciudad: null,
      envioMetodo: null,
    });

    expect(
      await moverPedido({
        id: 7,
        desde: "PAGADO",
        hacia: "PARA_ENVIAR",
        envioMetodo: "ENCOMIENDA",
      })
    ).toEqual({
      success: false,
      error: "La ciudad es obligatoria para un envío que no es retiro",
    });

    const retiro = await moverPedido({
      id: 7,
      desde: "PAGADO",
      hacia: "PARA_ENVIAR",
      envioMetodo: "RETIRO",
    });
    expect(retiro.success).toBe(true);
  });

  it("PARA_ENVIAR → ENTREGADO marca la entrega; volver la borra", async () => {
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      estado: "PARA_ENVIAR",
      ciudad: "Córdoba",
      envioMetodo: "CORREO",
    });

    expect(await moverPedido({ id: 7, desde: "PARA_ENVIAR", hacia: "ENTREGADO" })).toEqual({
      success: true,
      data: { id: 7, estado: "ENTREGADO" },
    });
    expect(prisma.pedido.updateMany).toHaveBeenLastCalledWith({
      where: { id: 7, estado: "PARA_ENVIAR" },
      data: {
        estado: "ENTREGADO",
        entregadoAt: expect.any(Date),
        updatedBy: "test@feria.test",
      },
    });

    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      estado: "ENTREGADO",
      ciudad: "Córdoba",
      envioMetodo: "CORREO",
    });
    expect(await moverPedido({ id: 7, desde: "ENTREGADO", hacia: "PARA_ENVIAR" })).toEqual({
      success: true,
      data: { id: 7, estado: "PARA_ENVIAR" },
    });
    expect(prisma.pedido.updateMany).toHaveBeenLastCalledWith({
      where: { id: 7, estado: "ENTREGADO" },
      data: {
        estado: "PARA_ENVIAR",
        entregadoAt: null,
        updatedBy: "test@feria.test",
      },
    });
  });

  it("vuelve de PARA_ENVIAR a PAGADO como corrección, sin tocar plata", async () => {
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      estado: "PARA_ENVIAR",
      ciudad: "Córdoba",
      envioMetodo: "CORREO",
    });

    expect(await moverPedido({ id: 7, desde: "PARA_ENVIAR", hacia: "PAGADO" })).toEqual({
      success: true,
      data: { id: 7, estado: "PAGADO" },
    });
    expect(prisma.pedido.updateMany).toHaveBeenLastCalledWith({
      where: { id: 7, estado: "PARA_ENVIAR" },
      data: { estado: "PAGADO", updatedBy: "test@feria.test" },
    });
  });

  it("rechaza toda transición que no esté en la tabla (incluido entrar a PAGADO)", async () => {
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      estado: "RESERVADO",
      ciudad: null,
      envioMetodo: null,
    });

    // A PAGADO se entra cobrando, no arrastrando.
    expect(await moverPedido({ id: 7, desde: "RESERVADO", hacia: "PAGADO" })).toEqual({
      success: false,
      error: "Para pasar a Pagado hay que cobrar el pedido",
    });
    expect(await moverPedido({ id: 7, desde: "PAGADO", hacia: "PAGADO" })).toEqual({
      success: false,
      error: "Para pasar a Pagado hay que cobrar el pedido",
    });

    // Saltos que la tabla no permite.
    expect(await moverPedido({ id: 7, desde: "RESERVADO", hacia: "PARA_ENVIAR" })).toEqual({
      success: false,
      error: "Transición no permitida: RESERVADO → PARA_ENVIAR",
    });
    expect(await moverPedido({ id: 7, desde: "PAGADO", hacia: "ENTREGADO" })).toEqual({
      success: false,
      error: "Transición no permitida: PAGADO → ENTREGADO",
    });

    // Cancelado es terminal.
    expect(await moverPedido({ id: 7, desde: "CANCELADO", hacia: "RESERVADO" })).toEqual({
      success: false,
      error: "Un pedido cancelado no se puede mover",
    });
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  it("falla si la tarjeta cambió de estado mientras se movía", async () => {
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      estado: "ENTREGADO",
      ciudad: null,
      envioMetodo: null,
    });

    expect(await moverPedido({ id: 7, desde: "PAGADO", hacia: "PARA_ENVIAR", envioMetodo: "RETIRO" }))
      .toEqual({ success: false, error: "El pedido cambió de estado; recargá" });
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });
});

describe("actualizarEnvio", () => {
  it("actualiza el envío de un pedido pagado o para enviar", async () => {
    (prisma.pedido.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    expect(
      await actualizarEnvio({
        id: 7,
        envioMetodo: "CORREO",
        envioEstado: "ETIQUETA_LISTA",
        ciudad: "Rosario",
      })
    ).toEqual({ success: true, data: { id: 7 } });

    expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
      where: { id: 7, estado: { in: ["PAGADO", "PARA_ENVIAR"] } },
      data: {
        envioMetodo: "CORREO",
        envioEstado: "ETIQUETA_LISTA",
        ciudad: "Rosario",
        updatedBy: "test@feria.test",
      },
    });
  });

  it("no toca un pedido reservado, entregado o cancelado", async () => {
    (prisma.pedido.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({ estado: "ENTREGADO" });

    expect(
      await actualizarEnvio({ id: 7, envioMetodo: "CORREO", envioEstado: "COORDINAR" })
    ).toEqual({
      success: false,
      error: "Solo se puede actualizar el envío de un pedido pagado o para enviar",
    });
  });

  it("una ciudad de más de 100 caracteres se rechaza", async () => {
    const result = await actualizarEnvio({
      id: 7,
      envioMetodo: "CORREO",
      envioEstado: "COORDINAR",
      ciudad: "x".repeat(101),
    });

    expect(result.success).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("cancelarPedido", () => {
  it("cancela solo desde RESERVADO y guarda el motivo con el actor", async () => {
    (prisma.pedido.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    expect(await cancelarPedido({ id: 7, motivo: "  La clienta desistió; se devolvió la seña " }))
      .toEqual({ success: true, data: { id: 7, estado: "CANCELADO" } });

    // El motivo va a `notas`: el modelo no tiene columna propia y la reserva se
    // libera sola (es derivada), sin asiento de caja automático.
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
      where: { id: 7, estado: "RESERVADO" },
      data: {
        estado: "CANCELADO",
        canceladoAt: expect.any(Date),
        notas: "La clienta desistió; se devolvió la seña",
        updatedBy: "test@feria.test",
      },
    });
    expect(prisma.pedidoPago.create).not.toHaveBeenCalled();
  });

  it("exige el motivo", async () => {
    expect(await cancelarPedido({ id: 7, motivo: "   " })).toEqual({
      success: false,
      error: "El motivo de la cancelación es obligatorio",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("no cancela un pedido que ya salió de la reserva", async () => {
    (prisma.pedido.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({ estado: "PAGADO" });

    expect(await cancelarPedido({ id: 7, motivo: "Ya no lo quiere" })).toEqual({
      success: false,
      error: "Solo se puede cancelar un pedido reservado",
    });
  });
});

describe("consultas del Kanban", () => {
  it("arma la tarjeta con lo que la columna necesita", async () => {
    (prisma.pedido.findMany as jest.Mock).mockResolvedValue([
      {
        id: 7,
        numero: "V-0002",
        ciudad: "Córdoba",
        total: dec("12000.00"),
        venceEl: new Date("2026-12-01"),
        pagadoAt: null,
        entregadoAt: null,
        envioMetodo: null,
        envioEstado: null,
        canal: { name: "WhatsApp" },
        customer: { name: "Ana", surname: "Paz" },
        items: [{ cantidad: 1, product: { name: "Campera" } }],
        pagos: [{ monto: dec("5000.00"), metodo: "EFECTIVO" }],
        _count: { items: 4 },
      },
    ]);

    const result = await getPedidosPorEstado({ estado: "RESERVADO" });

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: 7,
          numero: "V-0002",
          canal: "WhatsApp",
          cliente: "Ana Paz",
          ciudad: "Córdoba",
          items: [{ nombre: "Campera", cantidad: 1 }],
          itemsRestantes: 3,
          senas: 5000,
          saldo: 7000,
          medio: "EFECTIVO",
          envioMetodo: null,
          envioEstado: null,
          total: 12000,
          venceEl: "2026-12-01T00:00:00.000Z",
          pagadoAt: null,
          entregadoAt: null,
        },
      ],
    });

    // Lo que vence primero va arriba, y una columna nunca trae más de 30.
    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estado: "RESERVADO" },
        take: 30,
        orderBy: [{ venceEl: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      })
    );
    // Tres ítems para la tarjeta, y el resto solo se cuenta.
    expect((prisma.pedido.findMany as jest.Mock).mock.calls[0][0].select.items.take).toBe(3);
  });

  it("pagina con cursor y filtra por canal", async () => {
    (prisma.pedido.findMany as jest.Mock).mockResolvedValue([]);

    await getPedidosPorEstado({ estado: "PAGADO", canalId: 2, take: 10, cursor: 7 });

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estado: "PAGADO", canalId: 2 },
        take: 10,
        cursor: { id: 7 },
        skip: 1,
        orderBy: [{ pagadoAt: "asc" }],
      })
    );
  });

  it("el medio de la tarjeta es MIXTO si las señas se reparten", async () => {
    (prisma.pedido.findMany as jest.Mock).mockResolvedValue([
      {
        id: 8,
        numero: "V-0003",
        ciudad: null,
        total: dec("1000.00"),
        venceEl: null,
        pagadoAt: null,
        entregadoAt: null,
        envioMetodo: null,
        envioEstado: null,
        canal: { name: "Local" },
        customer: { name: "Eva", surname: "Ruiz" },
        items: [],
        pagos: [
          { monto: dec("200.00"), metodo: "EFECTIVO" },
          { monto: dec("300.00"), metodo: "TRANSFERENCIA" },
        ],
        _count: { items: 0 },
      },
    ]);

    const result = await getPedidosPorEstado({ estado: "RESERVADO" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0]).toMatchObject({ medio: "MIXTO", senas: 500, saldo: 500 });
  });

  it("cuenta las cuatro columnas del tablero", async () => {
    (prisma.pedido.groupBy as jest.Mock).mockResolvedValue([
      { estado: "RESERVADO", _count: { _all: 2 } },
      { estado: "PAGADO", _count: { _all: 5 } },
    ]);

    expect(await getContadoresPedidos()).toEqual({
      success: true,
      data: { RESERVADO: 2, PAGADO: 5, PARA_ENVIAR: 0, ENTREGADO: 0, CANCELADO: 0 },
    });
    expect(prisma.pedido.groupBy).toHaveBeenCalledWith({
      by: ["estado"],
      where: {},
      _count: { _all: true },
    });

    await getContadoresPedidos(2);
    expect(prisma.pedido.groupBy).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { canalId: 2 } })
    );
  });

  it("devuelve el detalle completo de un pedido", async () => {
    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue({
      id: 7,
      numero: "V-0002",
      estado: "RESERVADO",
      total: dec("12000.00"),
      ciudad: "Córdoba",
      saleId: null,
      canal: { name: "WhatsApp" },
      customer: { name: "Ana", surname: "Paz", phone: null },
      items: [
        {
          id: 1,
          cantidad: 1,
          precio: dec("12000.00"),
          subtotal: dec("12000.00"),
          branchId: 3,
          product: { name: "Campera", code: "PK0009" },
        },
      ],
      pagos: [
        { id: 1, monto: dec("5000.00"), metodo: "EFECTIVO", fecha: new Date("2026-11-01") },
      ],
    });

    const result = await getPedido(7);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      numero: "V-0002",
      total: 12000,
      senas: 5000,
      saldo: 7000,
      medio: "EFECTIVO",
      canal: "WhatsApp",
    });

    (prisma.pedido.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await getPedido(99)).toEqual({ success: false, error: "Pedido no encontrado" });
  });
});
