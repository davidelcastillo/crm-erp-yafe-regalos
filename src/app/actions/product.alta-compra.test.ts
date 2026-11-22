/**
 * @jest-environment node
 *
 * Alta de producto con stock y compra (odd/tasks/talles-y-compra-alta.md, T3 y T4).
 *
 * Lo que se fija acá: el alta individual sigue igual sin los campos nuevos; con
 * sucursal + cantidad inicial deja la fila de inventario y su movimiento
 * `ENTRY` («ALTA DE PRODUCTO»); con costo además registra la compra del alta
 * (precio = costo, cantidad = cantidad inicial) sin tocar stock; el lote genera
 * UNA sola compra con las filas que tienen costo Y stock; la edición no escribe
 * nada de esto.
 */
import { createProduct, createProductsBatch, updateProduct, updateProductExtended } from "./product";
import { createProductsBatchSchema, createProductSchema } from "@/lib/validations/product";
import { prefixLockKey } from "@/lib/utils/product-code";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => {
  const delegate = () => ({
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
    createManyAndReturn: jest.fn(),
  });
  const delegados = {
    product: delegate(),
    branchInventory: delegate(),
    branchMovement: delegate(),
    purchase: delegate(),
    purchaseItem: delegate(),
  };
  const $executeRawUnsafe = jest.fn().mockResolvedValue(undefined);
  const tx = { ...delegados, $executeRawUnsafe };
  const $transaction = jest.fn(async (callback: (t: unknown) => Promise<unknown>) =>
    callback(tx)
  );

  return {
    prisma: {
      ...delegados,
      $executeRawUnsafe,
      $transaction,
      branch: { findFirst: jest.fn() },
      category: { findMany: jest.fn(), findUnique: jest.fn() },
    },
  };
});

const altaIndividual = { name: "Jabón de Avena", prefix: "AA", price: 1500 };

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.product.create as jest.Mock).mockResolvedValue({
    id: 9,
    code: "AA000",
    name: "Jabón de Avena",
    price: 1500,
  });
  (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 3 });
  (prisma.purchase.create as jest.Mock).mockResolvedValue({ id: 77 });
});

describe("createProduct: sin los campos nuevos el alta queda como hoy", () => {
  it("crea solo el producto: ni sucursal, ni inventario, ni movimiento, ni compra", async () => {
    const result = await createProduct(altaIndividual);

    expect(result.success).toBe(true);
    expect(prisma.product.create).toHaveBeenCalledTimes(1);
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
    expect(prisma.branchInventory.create).not.toHaveBeenCalled();
    expect(prisma.branchMovement.create).not.toHaveBeenCalled();
    expect(prisma.purchase.create).not.toHaveBeenCalled();
    expect(prisma.purchaseItem.createMany).not.toHaveBeenCalled();
  });
});

describe("createProduct: cantidad inicial y costo (T3)", () => {
  it("con sucursal y cantidad inicial deja la fila de inventario y su ENTRY, sin costo", async () => {
    (prisma.branchInventory.create as jest.Mock).mockResolvedValue({ stock: 5 });

    const result = await createProduct({
      ...altaIndividual,
      branchId: 3,
      cantidadInicial: 5,
    });

    expect(result.success).toBe(true);
    // La sucursal se valida antes de escribir y como activa.
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: 3, isActive: true },
      select: { id: true },
    });
    expect((prisma.branchInventory.create as jest.Mock).mock.calls[0][0].data).toEqual({
      branchId: 3,
      productId: 9,
      stock: 5,
    });
    expect((prisma.branchMovement.create as jest.Mock).mock.calls[0][0].data).toEqual({
      productId: 9,
      branchId: 3,
      movementType: "ENTRY",
      quantity: 5,
      reference: "ALTA DE PRODUCTO",
      performedBy: "test@feria.test",
    });
    // Sin costo no hay compra.
    expect(prisma.purchase.create).not.toHaveBeenCalled();
    expect(prisma.purchaseItem.createMany).not.toHaveBeenCalled();
  });

  it("con costo registra la compra del alta con el precio y la cantidad cargados", async () => {
    (prisma.branchInventory.create as jest.Mock).mockResolvedValue({ stock: 5 });

    const result = await createProduct({
      ...altaIndividual,
      branchId: 3,
      cantidadInicial: 5,
      costoUnitario: 100,
    });

    expect(result.success).toBe(true);
    expect((prisma.purchase.create as jest.Mock).mock.calls[0][0].data).toEqual({
      totalAmount: 500,
      branchId: 3,
    });
    expect((prisma.purchaseItem.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { purchaseId: 77, productId: 9, price: 100, quantity: 5, subtotal: 500 },
    ]);
    // El ENTRY ya ingresó el stock: la compra no lo vuelve a tocar.
    expect(prisma.branchInventory.create).toHaveBeenCalledTimes(1);
    expect(prisma.branchMovement.create).toHaveBeenCalledTimes(1);
  });

  it("costo 0 no genera compra pero sí el ingreso de stock", async () => {
    (prisma.branchInventory.create as jest.Mock).mockResolvedValue({ stock: 2 });

    await createProduct({
      ...altaIndividual,
      branchId: 3,
      cantidadInicial: 2,
      costoUnitario: 0,
    });

    expect(prisma.branchInventory.create).toHaveBeenCalledTimes(1);
    expect(prisma.purchase.create).not.toHaveBeenCalled();
  });

  it("sin cantidad inicial no crea inventario, movimiento ni compra", async () => {
    await createProduct({ ...altaIndividual, branchId: 3, costoUnitario: 0 });

    expect(prisma.branchInventory.create).not.toHaveBeenCalled();
    expect(prisma.branchMovement.create).not.toHaveBeenCalled();
    expect(prisma.purchase.create).not.toHaveBeenCalled();

    // Cantidad 0 es lo mismo que no cargarla.
    (prisma.branchInventory.create as jest.Mock).mockClear();
    await createProduct({
      ...altaIndividual,
      name: "Otro jabón",
      branchId: 3,
      cantidadInicial: 0,
    });
    expect(prisma.branchInventory.create).not.toHaveBeenCalled();
  });

  it("una sucursal inactiva o inexistente no crea nada", async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await createProduct({
      ...altaIndividual,
      branchId: 99,
      cantidadInicial: 1,
    });

    expect(result).toEqual({ success: false, error: "Sucursal inválida o inactiva" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.product.create).not.toHaveBeenCalled();
  });
});

describe("createProductSchema: campos opcionales del alta", () => {
  it("acepta el alta sin sucursal, cantidad ni costo", () => {
    expect(createProductSchema.safeParse(altaIndividual).success).toBe(true);
  });

  it("rechaza un costo sin cantidad: no hay unidades para la compra", () => {
    const parsed = createProductSchema.safeParse({ ...altaIndividual, costoUnitario: 100 });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.message).toBe(
      "Para registrar el costo cargá la cantidad inicial (1 o más)"
    );
    expect(parsed.error.issues[0]?.path).toEqual(["cantidadInicial"]);
    // Sin sucursal el costo SÍ se registra (decisión del dueño: compra sin sucursal).
    const conCantidad = createProductSchema.safeParse({
      ...altaIndividual,
      costoUnitario: 100,
      cantidadInicial: 2,
    });
    expect(conCantidad.success).toBe(true);
  });

  it("la cantidad inicial es un entero entre 0 y 999", () => {
    for (const cantidadInicial of [-1, 1.5, 1000]) {
      expect(
        createProductSchema.safeParse({ ...altaIndividual, branchId: 3, cantidadInicial }).success
      ).toBe(false);
    }
    expect(
      createProductSchema.safeParse({ ...altaIndividual, branchId: 3, cantidadInicial: 999 }).success
    ).toBe(true);
  });

  it("el costo no puede ser negativo", () => {
    const parsed = createProductSchema.safeParse({
      ...altaIndividual,
      branchId: 3,
      cantidadInicial: 1,
      costoUnitario: -1,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.message).toBe("El costo no puede ser negativo");
  });
});

describe("alta masiva: costo por fila (T4)", () => {
  const lote = (rows: unknown[], branchId?: number) => ({
    ...(branchId === undefined ? {} : { branchId }),
    rows,
  });

  beforeEach(() => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({
      id: 3,
      name: "Centro",
      code: "CE",
    });
    (prisma.product.createManyAndReturn as jest.Mock).mockResolvedValue([
      { id: 1, code: "AA000", name: "Producto 1", price: 10 },
      { id: 2, code: "AA001", name: "Producto 2", price: 20 },
      { id: 3, code: "AA002", name: "Producto 3", price: 30 },
    ]);
    (prisma.branchInventory.createManyAndReturn as jest.Mock).mockResolvedValue([
      { productId: 1, stock: 2 },
      { productId: 2, stock: 3 },
      { productId: 3, stock: 0 },
    ]);
    (prisma.purchase.create as jest.Mock).mockResolvedValue({ id: 88 });
  });

  it("una sola compra del lote con las filas que tienen costo y stock", async () => {
    const result = await createProductsBatch(
      lote(
        [
          { name: "Producto 1", prefix: "AA", price: 10, initialStock: 2, costo: 100 },
          { name: "Producto 2", prefix: "AA", price: 20, initialStock: 3, costo: 50 },
          // Costo sin stock: queda fuera de la compra.
          { name: "Producto 3", prefix: "AA", price: 30, initialStock: 0, costo: 70 },
        ],
        3
      )
    );

    expect(result.success).toBe(true);
    // UNA cabecera con el total de los subtotales (2×100 + 3×50).
    expect(prisma.purchase.create).toHaveBeenCalledTimes(1);
    expect((prisma.purchase.create as jest.Mock).mock.calls[0][0].data).toEqual({
      totalAmount: 350,
      branchId: 3,
    });
    expect(prisma.purchaseItem.createMany).toHaveBeenCalledTimes(1);
    expect((prisma.purchaseItem.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { purchaseId: 88, productId: 1, price: 100, quantity: 2, subtotal: 200 },
      { purchaseId: 88, productId: 2, price: 50, quantity: 3, subtotal: 150 },
    ]);
  });

  it("sin costos el lote queda como hoy: no hay compra", async () => {
    const result = await createProductsBatch(
      lote(
        [
          { name: "Producto 1", prefix: "AA", price: 10, initialStock: 2 },
          { name: "Producto 2", prefix: "AA", price: 20, initialStock: 3, costo: 0 },
        ],
        3
      )
    );

    expect(result.success).toBe(true);
    expect(prisma.purchase.create).not.toHaveBeenCalled();
    expect(prisma.purchaseItem.createMany).not.toHaveBeenCalled();
  });

  it("solo filas con costo pero stock 0 no generan compra", async () => {
    (prisma.branchInventory.createManyAndReturn as jest.Mock).mockResolvedValue([
      { productId: 1, stock: 0 },
      { productId: 2, stock: 0 },
      { productId: 3, stock: 0 },
    ]);

    const result = await createProductsBatch(
      lote(
        [
          { name: "Producto 1", prefix: "AA", price: 10, initialStock: 0, costo: 100 },
          { name: "Producto 2", prefix: "AA", price: 20, costo: 50 },
          { name: "Producto 3", prefix: "AA", price: 30, costo: 70 },
        ],
        3
      )
    );

    expect(result.success).toBe(true);
    expect(prisma.purchase.create).not.toHaveBeenCalled();
    expect(prisma.purchaseItem.createMany).not.toHaveBeenCalled();
  });

  it("el lote sin sucursal acepta el costo si la fila trae stock inicial", () => {
    const parsed = createProductsBatchSchema.safeParse({
      rows: [{ name: "Producto 1", prefix: "AA", price: 10, initialStock: 2, costo: 100 }],
    });

    // La compra puede no tener sucursal (decisión del dueño).
    expect(parsed.success).toBe(true);

    // Pero sin unidades no hay compra que registrar: se rechaza con el path de la fila.
    const sinStock = createProductsBatchSchema.safeParse({
      rows: [{ name: "Producto 1", prefix: "AA", price: 10, costo: 100 }],
    });
    expect(sinStock.success).toBe(false);
    if (sinStock.success) return;
    expect(sinStock.error.issues[0]?.message).toContain("stock inicial");
  });

  it("el costo de la fila no puede ser negativo", () => {
    const parsed = createProductsBatchSchema.safeParse({
      branchId: 3,
      rows: [{ name: "Producto 1", prefix: "AA", price: 10, initialStock: 2, costo: -5 }],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.message).toBe("El costo no puede ser negativo");
    expect(parsed.error.issues[0]?.path).toEqual(["rows", 0, "costo"]);
  });
});

describe("la edición no toca inventario ni compras", () => {
  beforeEach(() => {
    (prisma.product.update as jest.Mock).mockResolvedValue({ id: 9 });
  });

  it("updateProduct solo actualiza la ficha", async () => {
    await updateProduct({ id: 9, name: "Renombrado", costoUnitario: 100, cantidadInicial: 5 });

    expect(prisma.product.update).toHaveBeenCalledTimes(1);
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
    expect(prisma.branchInventory.create).not.toHaveBeenCalled();
    expect(prisma.branchInventory.update).not.toHaveBeenCalled();
    expect(prisma.branchMovement.create).not.toHaveBeenCalled();
    expect(prisma.purchase.create).not.toHaveBeenCalled();
  });

  it("updateProductExtended tampoco genera movimientos ni compras", async () => {
    await updateProductExtended({ id: 9, name: "Renombrado", costoUnitario: 100 });

    expect(prisma.product.update).toHaveBeenCalledTimes(1);
    expect(prisma.branchInventory.create).not.toHaveBeenCalled();
    expect(prisma.branchInventory.update).not.toHaveBeenCalled();
    expect(prisma.branchMovement.create).not.toHaveBeenCalled();
    expect(prisma.purchase.create).not.toHaveBeenCalled();
  });
});

// El lock por prefijo ya está cubierto por `product.test.ts`; acá se deja
// constancia de que el alta con stock no cambia la clave.
it("el alta con stock sigue tomando el advisory lock del prefijo", async () => {
  await createProduct({ ...altaIndividual, branchId: 3, cantidadInicial: 1 });

  const sql = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.map((c) => String(c[0]));
  expect(sql).toEqual([`SELECT pg_advisory_xact_lock(${prefixLockKey("AA")})`]);
});
