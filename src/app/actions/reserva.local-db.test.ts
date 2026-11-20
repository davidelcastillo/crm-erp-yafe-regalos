/** @jest-environment node */

/**
 * Reserva derivada R1 contra la base local (`npm run test:local-db`).
 * Zona de dinero y stock.
 *
 * Lo que recién acá se puede probar es la historia completa: una prenda única
 * reservada por un pedido no se puede vender por mostrador ni sacar de la
 * sucursal, el cobro del pedido sigue descontando exactamente una vez y, al
 * cancelar, la reserva se libera y la venta directa pasa. La reserva es
 * derivada: el stock físico nunca se toca mientras el pedido está RESERVADO.
 */

jest.setTimeout(60000);

// El archivo es un módulo: si no, sus nombres de nivel superior chocan con los
// de las otras suites de base local, que no importan nada arriba.
export {};

const sufijo = Math.floor(1000 + Math.random() * 9000);
const marca = `QA reserva ${sufijo}`;
const CODIGO_ORIGEN = `RO${sufijo}`;
const CODIGO_DESTINO = `RD${sufijo}`;
const ACTOR = "test@feria.test";

type Cliente = (typeof import("@/lib/prisma"))["prisma"];
type AccionesPedido = typeof import("@/app/actions/pedido");
type AccionesPrenda = typeof import("@/app/actions/prenda");
type AccionesVenta = typeof import("@/app/actions/sale");
type AccionesInventario = typeof import("@/app/actions/inventory");
type AccionesReserva = typeof import("@/lib/reserva");

let prisma: Cliente;
let pedidos: AccionesPedido;
let prendas: AccionesPrenda;
let ventas: AccionesVenta;
let inventario: AccionesInventario;
let reserva: AccionesReserva;

let origenId = 0;
let destinoId = 0;
let customerId = 0;
let canalId = 0;
let categoriaId = 0;
let condicionId = 0;

const productos: number[] = [];
const pedidosCreados: number[] = [];

const limpiarProductos = async () => {
  await prisma.product.deleteMany({ where: { name: { startsWith: marca } } });
};

/** Alta de una prenda única de `precio` en la sucursal de origen. */
async function altaPrenda(nombre: string, precio = 12000) {
  const resultado = await prendas.createPrenda({
    nombre: `${marca} ${nombre}`,
    descripcion: "Segunda mano",
    precio,
    costo: 1000,
    categoriaPrendaId: categoriaId,
    talles: [{ talle: "Único", cantidad: 1 }],
    condicionId,
    esUnica: true,
    branchId: origenId,
    estilos: [],
    medidas: [],
    publicadaEn: [],
  });
  expect(resultado.success).toBe(true);
  if (!resultado.success) throw new Error("no se pudo crear la prenda de prueba");
  productos.push(resultado.data.product.id);
  return resultado.data.product;
}

/** Reserva la prenda en un pedido nuevo (una unidad, sin seña). */
async function reservar(productId: number) {
  const alta = await pedidos.createPedido({
    customerId,
    canalId,
    branchId: origenId,
    items: [{ productId, cantidad: 1 }],
  });
  expect(alta.success).toBe(true);
  if (!alta.success) throw new Error("no se pudo crear el pedido de prueba");
  pedidosCreados.push(alta.data.id as number);
  return alta.data.id as number;
}

const stockEn = async (branchId: number, productId: number) =>
  (
    await prisma.branchInventory.findUnique({
      where: { branchId_productId: { branchId, productId } },
      select: { stock: true },
    })
  )?.stock ?? 0;

describe("reserva derivada R1 (integración, base local)", () => {
  beforeAll(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    jest.resetModules();

    prisma = (await import("@/lib/prisma")).prisma;
    pedidos = await import("@/app/actions/pedido");
    prendas = await import("@/app/actions/prenda");
    ventas = await import("@/app/actions/sale");
    inventario = await import("@/app/actions/inventory");
    reserva = await import("@/lib/reserva");

    await limpiarProductos();
    // Compras de corridas previas que retienen las sucursales por el FK.
    await prisma.purchase.deleteMany({
      where: { branch: { code: { in: [CODIGO_ORIGEN, CODIGO_DESTINO] } } },
    });
    await prisma.branch.deleteMany({ where: { code: { in: [CODIGO_ORIGEN, CODIGO_DESTINO] } } });
    await prisma.categoriaPrenda.deleteMany({ where: { name: { startsWith: marca } } });
    await prisma.condicionPrenda.deleteMany({ where: { name: { startsWith: marca } } });
    await prisma.canalVenta.deleteMany({ where: { name: { startsWith: marca } } });
    await prisma.customer.deleteMany({ where: { name: { startsWith: marca } } });

    origenId = (
      await prisma.branch.create({
        data: { name: `${marca} deposito`, code: CODIGO_ORIGEN, authUserId: `qa-reserva-o-${sufijo}` },
      })
    ).id;
    destinoId = (
      await prisma.branch.create({
        data: { name: `${marca} local`, code: CODIGO_DESTINO, authUserId: `qa-reserva-d-${sufijo}` },
      })
    ).id;
    customerId = (
      await prisma.customer.create({ data: { name: `${marca} Ana`, surname: "Paz" } })
    ).id;
    canalId = (await prisma.canalVenta.create({ data: { name: `${marca} whatsapp` } })).id;
    categoriaId = (
      await prisma.categoriaPrenda.create({
        data: { name: `${marca} categoria`, codePrefix: "QR" },
      })
    ).id;
    condicionId = (
      await prisma.condicionPrenda.create({ data: { name: `${marca} condicion` } })
    ).id;
  });

  afterAll(async () => {
    await prisma.pedido.deleteMany({ where: { id: { in: pedidosCreados } } });
    await prisma.sale.deleteMany({ where: { branchId: { in: [origenId, destinoId] } } });
    await prisma.branchMovement.deleteMany({
      where: { branchId: { in: [origenId, destinoId] } },
    });
    await limpiarProductos();
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.canalVenta.deleteMany({ where: { id: canalId } });
    await prisma.categoriaPrenda.deleteMany({ where: { id: categoriaId } });
    await prisma.condicionPrenda.deleteMany({ where: { id: condicionId } });
    // Las compras del alta referencian las sucursales: sin esto, el FK las retiene.
    await prisma.purchase.deleteMany({ where: { branchId: { in: [origenId, destinoId] } } });
    await prisma.branch.deleteMany({ where: { id: { in: [origenId, destinoId] } } });
    await prisma.$disconnect();
  });

  it("(a) la venta directa no puede vender lo reservado y no toca el stock", async () => {
    const prenda = await altaPrenda("campera reservada");
    await reservar(prenda.id);

    // La reserva es derivada: el stock físico sigue en el estante.
    expect(await stockEn(origenId, prenda.id)).toBe(1);
    expect(await reserva.disponibilidadPrenda({ productId: prenda.id })).toEqual({
      success: true,
      data: { disponible: 0, reservado: 1, vendida: false },
    });

    const venta = await ventas.registerSale({
      branchId: origenId,
      items: [{ productId: prenda.id, price: 12000, quantity: 1 }],
    });

    expect(venta.success).toBe(false);
    if (venta.success) return;
    expect(venta.error).toContain("Stock insuficiente");
    expect(venta.error).toContain("reservado 1 por pedidos");
    expect(venta.error).toContain("disponible 0");

    // Nada escrito: ni stock, ni venta.
    expect(await stockEn(origenId, prenda.id)).toBe(1);
    expect(await prisma.saleItem.count({ where: { productId: prenda.id } })).toBe(0);
    expect(
      await prisma.branchMovement.count({
        where: { productId: prenda.id, movementType: "EXIT" },
      })
    ).toBe(0);
  });

  it("(b) el traspaso no puede sacar de la sucursal una unidad reservada", async () => {
    const prenda = await altaPrenda("pantalon reservado");
    await reservar(prenda.id);

    const movimiento = await inventario.moveStockBetweenBranches({
      productId: prenda.id,
      sourceBranchId: origenId,
      destBranchId: destinoId,
      quantity: 1,
      performedBy: ACTOR,
    });

    expect(movimiento.success).toBe(false);
    if (movimiento.success) return;
    expect(movimiento.error).toContain("Stock insuficiente en origen");
    expect(movimiento.error).toContain("reservado 1 por pedidos");

    // Lote: mismo rechazo, nada a medias.
    const lote = await inventario.moveStockBatchBetweenBranches({
      sourceBranchId: origenId,
      destBranchId: destinoId,
      items: [{ productId: prenda.id, quantity: 1 }],
      performedBy: ACTOR,
    });
    expect(lote.success).toBe(false);

    expect(await stockEn(origenId, prenda.id)).toBe(1);
    expect(await stockEn(destinoId, prenda.id)).toBe(0);
    expect(
      await prisma.branchMovement.count({
        where: { productId: prenda.id, movementType: { in: ["TRANSFER_OUT", "TRANSFER_IN"] } },
      })
    ).toBe(0);
  });

  it("(c) cobrar el pedido sigue funcionando y descuenta exactamente una vez", async () => {
    const prenda = await altaPrenda("pollera cobrada");
    const pedidoId = await reservar(prenda.id);

    const cobro = await pedidos.cobrarPedido({ id: pedidoId, metodo: "EFECTIVO" });
    expect(cobro.success).toBe(true);
    if (!cobro.success) return;

    expect(await stockEn(origenId, prenda.id)).toBe(0);
    expect(
      await prisma.branchMovement.count({
        where: { productId: prenda.id, movementType: "EXIT" },
      })
    ).toBe(1);
    expect(await reserva.disponibilidadPrenda({ productId: prenda.id })).toEqual({
      success: true,
      data: { disponible: 0, reservado: 0, vendida: true },
    });
  });

  it("(d) cancelar libera la reserva y la venta directa pasa", async () => {
    const prenda = await altaPrenda("camisa cancelada");
    const pedidoId = await reservar(prenda.id);

    // Con la reserva viva, la venta no pasa (misma prenda, mismo stock 1).
    const bloqueada = await ventas.registerSale({
      branchId: origenId,
      items: [{ productId: prenda.id, price: 12000, quantity: 1 }],
    });
    expect(bloqueada.success).toBe(false);

    const cancelado = await pedidos.cancelarPedido({
      id: pedidoId,
      motivo: `${marca}: se arrepintió`,
    });
    expect(cancelado.success).toBe(true);

    const liberada = await ventas.registerSale({
      branchId: origenId,
      items: [{ productId: prenda.id, price: 12000, quantity: 1 }],
    });
    expect(liberada.success).toBe(true);
    expect(await stockEn(origenId, prenda.id)).toBe(0);
    expect(await prisma.saleItem.count({ where: { productId: prenda.id } })).toBe(1);
  });
});
