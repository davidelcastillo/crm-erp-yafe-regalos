/** @jest-environment node */

/**
 * Regresión del alta individual (`createProduct`) contra la base local.
 *
 * El alta masiva comparte con esta acción el esquema de creación y la clave del
 * advisory lock, así que lo que se fija acá es lo que no puede cambiar: el
 * código secuencial por prefijo y el mensaje de prefijo agotado, sin escribir
 * nada cuando se agota.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */

jest.setTimeout(60000);

const sufijo = Math.floor(1000 + Math.random() * 9000);
const letra = (n: number) => String.fromCharCode(65 + (n % 26));
const PREFIJO_NUEVO = `${letra(sufijo)}${letra(Math.floor(sufijo / 26))}N`;
const PREFIJO_AGOTADO = `${letra(sufijo)}${letra(Math.floor(sufijo / 26))}X`;
const PREFIJO_CATEGORIA = `${letra(sufijo)}${letra(Math.floor(sufijo / 26))}C`;
const PREFIJO_COMPRA = `${letra(sufijo)}${letra(Math.floor(sufijo / 26))}P`;
const NOMBRE_CATEGORIA = `QA categoría individual ${sufijo}`;

type Cliente = (typeof import("@/lib/prisma"))["prisma"];
type Acciones = typeof import("@/app/actions/product");

let prisma: Cliente;
let acciones: Acciones;
let categoryId = 0;

describe("createProduct (integración, base local)", () => {
  beforeAll(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    jest.resetModules();

    prisma = (await import("@/lib/prisma")).prisma;
    acciones = await import("@/app/actions/product");

    await prisma.product.deleteMany({
      where: { codePrefix: { in: [PREFIJO_NUEVO, PREFIJO_AGOTADO, PREFIJO_CATEGORIA, PREFIJO_COMPRA] } },
    });

    const categoria = await prisma.category.create({ data: { name: NOMBRE_CATEGORIA } });
    categoryId = categoria.id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: { codePrefix: { in: [PREFIJO_NUEVO, PREFIJO_AGOTADO, PREFIJO_CATEGORIA, PREFIJO_COMPRA] } },
    });
    await prisma.category.deleteMany({ where: { name: NOMBRE_CATEGORIA } });
    await prisma.$disconnect();
  });

  it("con sucursal, cantidad y costo deja el stock, su ingreso y la compra del alta (S2/S3)", async () => {
    const sucursal = await prisma.branch.create({
      data: {
        name: `QA compra alta ${sufijo}`,
        code: `QB${sufijo}`,
        authUserId: `qa-compra-${sufijo}`,
      },
    });

    try {
      const resultado = await acciones.createProduct({
        name: `QA alta individual ${sufijo} con compra`,
        prefix: PREFIJO_COMPRA,
        price: 10,
        branchId: sucursal.id,
        cantidadInicial: 3,
        costoUnitario: 4.5,
      });
      expect(resultado.success).toBe(true);
      if (!resultado.success) return;
      const producto = await prisma.product.findFirstOrThrow({
        where: { codePrefix: PREFIJO_COMPRA },
        select: { id: true },
      });

      // Stock e ingreso.
      expect(
        await prisma.branchInventory.findUnique({
          where: { branchId_productId: { branchId: sucursal.id, productId: producto.id } },
          select: { stock: true },
        })
      ).toEqual({ stock: 3 });
      expect(
        await prisma.branchMovement.findFirst({
          where: { productId: producto.id, branchId: sucursal.id },
          select: { movementType: true, quantity: true, reference: true },
        })
      ).toMatchObject({ movementType: "ENTRY", quantity: 3, reference: "ALTA DE PRODUCTO" });

      // S2: una compra del alta, con el costo unitario y la cantidad ingresada.
      const compras = await prisma.purchase.findMany({
        where: { branchId: sucursal.id },
        select: {
          totalAmount: true,
          items: { select: { productId: true, price: true, quantity: true, subtotal: true } },
        },
      });
      expect(compras).toHaveLength(1);
      expect(Number(compras[0].totalAmount)).toBe(13.5);
      expect(compras[0].items).toHaveLength(1);
      expect(compras[0].items[0].productId).toBe(producto.id);
      expect(Number(compras[0].items[0].price)).toBe(4.5);
      expect(compras[0].items[0].quantity).toBe(3);
      expect(Number(compras[0].items[0].subtotal)).toBe(13.5);
    } finally {
      // La compra retiene la sucursal por el FK: se borra antes.
      await prisma.purchase.deleteMany({ where: { branchId: sucursal.id } });
      await prisma.branch.deleteMany({ where: { id: sucursal.id } });
    }
  });

  it("crea el código siguiente del prefijo", async () => {
    const primero = await acciones.createProduct({
      name: `QA alta individual ${sufijo} 1`,
      prefix: PREFIJO_NUEVO,
      price: 10,
    });
    expect(primero.success).toBe(true);
    expect(primero.success && primero.data).toMatchObject({ code: `${PREFIJO_NUEVO}000` });

    const segundo = await acciones.createProduct({
      name: `QA alta individual ${sufijo} 2`,
      prefix: PREFIJO_NUEVO,
      price: 20,
    });
    expect(segundo.success).toBe(true);
    expect(segundo.success && segundo.data).toMatchObject({ code: `${PREFIJO_NUEVO}001` });
  });

  it("con el prefijo agotado falla con el mensaje exacto y no escribe", async () => {
    await prisma.product.create({
      data: {
        name: `QA alta individual ${sufijo} tope`,
        code: `${PREFIJO_AGOTADO}999`,
        codePrefix: PREFIJO_AGOTADO,
        price: 1,
      },
    });
    const antes = await prisma.product.count({ where: { codePrefix: PREFIJO_AGOTADO } });
    expect(antes).toBe(1);

    const resultado = await acciones.createProduct({
      name: `QA alta individual ${sufijo} 3`,
      prefix: PREFIJO_AGOTADO,
      price: 30,
    });

    expect(resultado).toEqual({
      success: false,
      error: `Prefijo ${PREFIJO_AGOTADO} agotado (máximo 999 códigos)`,
    });
    const despues = await prisma.product.count({ where: { codePrefix: PREFIJO_AGOTADO } });
    expect(despues).toBe(antes);
  });

  it("guarda la categoría elegida al crear (H2)", async () => {
    const resultado = await acciones.createProduct({
      name: `QA alta individual ${sufijo} con categoría`,
      prefix: PREFIJO_CATEGORIA,
      price: 40,
      categoryId,
    });
    expect(resultado.success).toBe(true);

    const guardado = await prisma.product.findFirst({
      where: { codePrefix: PREFIJO_CATEGORIA },
      select: { categoryId: true },
    });
    expect(guardado).toEqual({ categoryId });
  });
});

export {};
