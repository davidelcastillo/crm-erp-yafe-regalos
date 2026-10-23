/** @jest-environment node */

/**
 * Integración contra la base local del guardado y el cierre del control de stock.
 *
 * Producción: un control de 136 productos no se podía guardar. La transacción
 * interactiva hacía un viaje por ítem y Prisma la cortaba a los 5 s (P2028); el
 * usuario veía «Error al guardar el conteo». El guardado pasó a transacción en
 * lote (un viaje) y el cierre tiene límites explícitos.
 *
 * Lo que se fija acá es lo observable: los 136 conteos y el motivo quedan
 * guardados, un control cerrado no se reescribe, y el cierre ajusta solo las
 * diferencias aceptadas dejando un movimiento por cada una.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */

jest.setTimeout(120000);

const sufijo = Math.floor(1000 + Math.random() * 9000);
const PRODUCTOS = 136;
const STOCK_INICIAL = 10;

type Cliente = (typeof import("@/lib/prisma"))["prisma"];
type Acciones = typeof import("@/app/actions/stockControl");

let prisma: Cliente;
let acciones: Acciones;

let branchId = 0;
let controlId = 0;
const productIds: number[] = [];

describe("control de stock (integración, base local)", () => {
  beforeAll(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    jest.resetModules();

    prisma = (await import("@/lib/prisma")).prisma;
    acciones = await import("@/app/actions/stockControl");

    // `authUserId` no nulo: `branchAdminService.populateAuthUserIds` actualiza
    // todas las sucursales sin authUserId y pisaría las fixtures.
    const branch = await prisma.branch.create({
      data: {
        name: `QA control ${sufijo}`,
        code: `QC${sufijo}`,
        authUserId: `qa-control-${sufijo}`,
      },
    });
    branchId = branch.id;

    await prisma.product.createMany({
      data: Array.from({ length: PRODUCTOS }, (_, i) => ({
        name: `QA control producto ${sufijo}-${i}`,
        code: `QC${sufijo}-${i}`,
        price: 100,
      })),
    });
    const productos = await prisma.product.findMany({
      where: { code: { startsWith: `QC${sufijo}-` } },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    productIds.push(...productos.map((p) => p.id));

    await prisma.branchInventory.createMany({
      data: productIds.map((productId) => ({
        branchId,
        productId,
        stock: STOCK_INICIAL,
      })),
    });

    const abierto = await acciones.startStockControl({ branchId });
    if (!abierto.success) {
      throw new Error(`No se pudo abrir el control: ${abierto.error}`);
    }
    controlId = abierto.data.controlId as number;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.stockControl.deleteMany({ where: { branchId } });
    await prisma.branchMovement.deleteMany({ where: { branchId } });
    await prisma.branchInventory.deleteMany({ where: { branchId } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
  });

  const stockDe = async (productId: number) => {
    const fila = await prisma.branchInventory.findFirst({
      where: { branchId, productId },
      select: { stock: true },
    });
    return fila?.stock ?? null;
  };

  it("guarda los 136 conteos y el motivo de un borrador grande", async () => {
    const items = productIds.map((productId, i) => ({
      productId,
      countedStock: i < 3 ? [7, 12, 4][i] : STOCK_INICIAL,
      decision: (i < 2 ? "ACCEPTED" : "PENDING") as "ACCEPTED" | "PENDING",
    }));

    const resultado = await acciones.saveStockControlCounts({
      controlId,
      reason: "cierre quincenal QA",
      items,
    });

    expect(resultado).toEqual({ success: true, data: { saved: PRODUCTOS } });

    const guardado = await acciones.getStockControl({ controlId });
    expect(guardado.success).toBe(true);
    if (!guardado.success) return;
    expect(guardado.data.reason).toBe("cierre quincenal QA");

    const guardados = guardado.data.items as {
      productId: number;
      systemStock: number;
      countedStock: number;
      decision: string;
    }[];
    expect(guardados).toHaveLength(PRODUCTOS);
    for (const item of guardados) {
      const esperado = items.find((i) => i.productId === item.productId)!;
      expect(item.countedStock).toBe(esperado.countedStock);
      expect(item.decision).toBe(esperado.decision);
    }
  });

  it("cierra ajustando solo las diferencias aceptadas, con un movimiento por cada una", async () => {
    const resultado = await acciones.closeStockControl({
      controlId,
      reason: "ajuste quincenal QA",
    });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    const receipt = resultado.data.receipt as {
      adjustedCount: number;
      pendingCount: number;
      items: { productId: number; difference: number }[];
    };
    expect(receipt.adjustedCount).toBe(2);
    expect(receipt.pendingCount).toBe(1);

    // El aceptado queda en lo contado; el pendiente conserva el stock del sistema
    // para poder seguir buscando la mercadería.
    expect(await stockDe(productIds[0])).toBe(7);
    expect(await stockDe(productIds[1])).toBe(12);
    expect(await stockDe(productIds[2])).toBe(STOCK_INICIAL);
    expect(await stockDe(productIds[3])).toBe(STOCK_INICIAL);

    const movimientos = await prisma.branchMovement.findMany({
      where: { branchId, reference: `CONTROL-${controlId}` },
      select: { productId: true, movementType: true, quantity: true, performedBy: true },
      orderBy: { productId: "asc" },
    });
    expect(movimientos).toEqual([
      {
        productId: productIds[0],
        movementType: "ADJUSTMENT",
        quantity: -3,
        performedBy: "test@feria.test",
      },
      {
        productId: productIds[1],
        movementType: "ADJUSTMENT",
        quantity: 2,
        performedBy: "test@feria.test",
      },
    ]);

    const control = await prisma.stockControl.findUnique({
      where: { id: controlId },
      select: { status: true, closedBy: true, reason: true },
    });
    expect(control).toEqual({
      status: "CLOSED",
      closedBy: "test@feria.test",
      reason: "ajuste quincenal QA",
    });
  });

  it("no reescribe un control cerrado ni vuelve a tocar el stock", async () => {
    const resultado = await acciones.saveStockControlCounts({
      controlId,
      items: [{ productId: productIds[0], countedStock: 99, decision: "ACCEPTED" }],
    });
    expect(resultado).toEqual({ success: false, error: "El control ya está cerrado" });

    const cerrado = await acciones.closeStockControl({ controlId, reason: "otra vez" });
    expect(cerrado).toEqual({ success: false, error: "El control ya está cerrado" });

    expect(await stockDe(productIds[0])).toBe(7);
    const item = await prisma.stockControlItem.findFirst({
      where: { controlId, productId: productIds[0] },
      select: { countedStock: true },
    });
    expect(item?.countedStock).toBe(7);
  });
});
