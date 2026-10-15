/** @jest-environment node */

/**
 * Integración contra la base local (T6 / S6): una compra con muchos ítems no
 * puede multiplicar los viajes a la base. La transacción interactiva de Prisma
 * tiene un tope de tiempo, así que ~3 viajes por ítem hacen que una compra de
 * 25 líneas falle con el error genérico en el pooler remoto, mientras que una
 * de 10 entra cómoda.
 *
 * Además del techo de viajes, se fija el resultado observable: cabecera, un
 * PurchaseItem por línea, un BranchMovement por línea (solo con `performedBy`)
 * y el stock final por par (branchId, productId), incluidos los pares repetidos
 * que la sentencia de inventario tiene que agregar antes de escribir.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */

jest.setTimeout(60000)

const sufijo = Math.floor(1000 + Math.random() * 9000)

const ITEMS_ESCALA = 25
/** Techo holgado: el camino actual hace ~3 viajes por ítem (~79 con 25 ítems). */
const TECHO_DE_VIAJES = 15

type Cliente = (typeof import("@/lib/prisma"))["prisma"]
type CrearCompra = (typeof import("./purchase"))["createPurchaseWithBranchSplit"]

interface DatosCompra {
  purchase: { id: number; branchId: number; totalAmount: number }
  items: unknown[]
}

interface Linea {
  productId: number
  branchId: number
  quantity: number
  price: number
}

// El cliente y la acción se cargan en `beforeAll` con NODE_ENV=development
// porque `src/lib/prisma.ts` solo loguea las queries en ese entorno.
let prisma: Cliente
let createPurchaseWithBranchSplit: CrearCompra

let branchA = 0
let branchB = 0
let branchEscala = 0
const productIds: number[] = []
const purchaseIds: number[] = []

let itemsEscala: Linea[] = []
let productoRepetido = 0
let productoMultiSucursal = 0
let productoSinMovimientos = 0

let contando = false
const queries: string[] = []

const datosDe = (resultado: { success: boolean; data?: unknown }) =>
  resultado.data as unknown as DatosCompra;

describe("createPurchaseWithBranchSplit (escala, base local)", () => {
  beforeAll(async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = "development";
    jest.resetModules();

    prisma = (await import("@/lib/prisma")).prisma;
    createPurchaseWithBranchSplit = (await import("./purchase"))
      .createPurchaseWithBranchSplit;

    // El `log` con "query" no está en el tipo del cliente exportado, así que se
    // tipa la suscripción a mano.
    const clienteConQueryLog = prisma as unknown as {
      $on: (evento: "query", callback: (e: { query: string }) => void) => void;
    };
    clienteConQueryLog.$on("query", (evento) => {
      if (contando) queries.push(evento.query);
    });

    // `authUserId` no nulo: así `branchAdminService.populateAuthUserIds` (que
    // actualiza TODAS las sucursales sin authUserId de la base) no toca estas
    // fixtures mientras corre en paralelo.
    const [a, b, escala] = await Promise.all([
      prisma.branch.create({
        data: {
          name: `QA escala A ${sufijo}`,
          code: `QEA${sufijo}`,
          authUserId: `qa-escala-a-${sufijo}`,
        },
      }),
      prisma.branch.create({
        data: {
          name: `QA escala B ${sufijo}`,
          code: `QEB${sufijo}`,
          authUserId: `qa-escala-b-${sufijo}`,
        },
      }),
      prisma.branch.create({
        data: {
          name: `QA escala C ${sufijo}`,
          code: `QEC${sufijo}`,
          authUserId: `qa-escala-c-${sufijo}`,
        },
      }),
    ]);
    branchA = a.id;
    branchB = b.id;
    branchEscala = escala.id;

    const productos = await Promise.all(
      Array.from({ length: ITEMS_ESCALA }, (_, i) =>
        prisma.product.create({
          data: {
            name: `QA escala producto ${sufijo}-${i}`,
            code: `QE${sufijo}-${i}`,
            price: 10 + i,
          },
        })
      )
    );
    const extra = await Promise.all([
      prisma.product.create({ data: { name: `QA repetido ${sufijo}`, code: `QER${sufijo}`, price: 5 } }),
      prisma.product.create({ data: { name: `QA multi ${sufijo}`, code: `QEM${sufijo}`, price: 7 } }),
      prisma.product.create({ data: { name: `QA sin mov ${sufijo}`, code: `QES${sufijo}`, price: 3 } }),
    ]);

    productIds.push(...productos.map((p) => p.id), ...extra.map((p) => p.id));
    productoRepetido = extra[0].id;
    productoMultiSucursal = extra[1].id;
    productoSinMovimientos = extra[2].id;

    itemsEscala = productos.map((p, i) => ({
      productId: p.id,
      branchId: branchA,
      quantity: i + 1,
      price: 10 + i,
    }));
  });

  afterAll(async () => {
    if (!prisma) return;
    const branches = [branchA, branchB, branchEscala];
    await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
    await prisma.branchMovement.deleteMany({ where: { branchId: { in: branches } } });
    await prisma.branchInventory.deleteMany({ where: { branchId: { in: branches } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.branch.deleteMany({ where: { id: { in: branches } } });
    await prisma.$disconnect();
  });

  it("una compra de 25 ítems deja 1 cabecera, 25 ítems, 25 movimientos y el stock exacto", async () => {
    const resultado = await createPurchaseWithBranchSplit({
      items: itemsEscala,
      performedBy: "qa-escala",
    });
    expect(resultado.success).toBe(true);

    const data = datosDe(resultado);
    purchaseIds.push(data.purchase.id);

    expect(data.items).toHaveLength(ITEMS_ESCALA);
    expect(data.purchase.totalAmount).toBe(
      itemsEscala.reduce((suma, it) => suma + it.price * it.quantity, 0)
    );
    expect(data.purchase.branchId).toBe(branchA);

    const items = await prisma.purchaseItem.findMany({
      where: { purchaseId: data.purchase.id },
    });
    expect(items).toHaveLength(ITEMS_ESCALA);

    const movimientos = await prisma.branchMovement.findMany({
      where: { reference: `PURCHASE-${data.purchase.id}` },
    });
    expect(movimientos).toHaveLength(ITEMS_ESCALA);
    expect(
      movimientos.every((m) => m.movementType === "ENTRY" && m.branchId === branchA)
    ).toBe(true);

    const inventario = await prisma.branchInventory.findMany({
      where: { branchId: branchA, productId: { in: itemsEscala.map((it) => it.productId) } },
    });
    expect(inventario).toHaveLength(ITEMS_ESCALA);
    const stockPorProducto = new Map(inventario.map((fila) => [fila.productId, fila.stock]));
    for (const it of itemsEscala) {
      expect(stockPorProducto.get(it.productId)).toBe(it.quantity);
    }
  });

  it("dos líneas del mismo producto en la misma sucursal suman el stock en una sola fila", async () => {
    await prisma.branchInventory.create({
      data: { branchId: branchA, productId: productoRepetido, stock: 10 },
    });

    const resultado = await createPurchaseWithBranchSplit({
      items: [
        { productId: productoRepetido, branchId: branchA, quantity: 2, price: 5 },
        { productId: productoRepetido, branchId: branchA, quantity: 3, price: 5 },
      ],
      performedBy: "qa-escala",
    });
    expect(resultado.success).toBe(true);

    const { purchase } = datosDe(resultado);
    purchaseIds.push(purchase.id);

    expect(await prisma.purchaseItem.count({ where: { purchaseId: purchase.id } })).toBe(2);
    expect(
      await prisma.branchMovement.count({ where: { reference: `PURCHASE-${purchase.id}` } })
    ).toBe(2);

    const inventario = await prisma.branchInventory.findUnique({
      where: { branchId_productId: { branchId: branchA, productId: productoRepetido } },
    });
    expect(inventario?.stock).toBe(15);
  });

  it("el mismo producto en sucursales distintas va a cada sucursal", async () => {
    const resultado = await createPurchaseWithBranchSplit({
      items: [
        { productId: productoMultiSucursal, branchId: branchA, quantity: 4, price: 7 },
        { productId: productoMultiSucursal, branchId: branchB, quantity: 6, price: 7 },
      ],
      performedBy: "qa-escala",
    });
    expect(resultado.success).toBe(true);

    const { purchase } = datosDe(resultado);
    purchaseIds.push(purchase.id);
    // La cabecera toma el branchId de la primera línea (NOT NULL en el schema).
    expect(purchase.branchId).toBe(branchA);

    const filas = await prisma.branchInventory.findMany({
      where: { productId: productoMultiSucursal, branchId: { in: [branchA, branchB] } },
    });
    expect(new Map(filas.map((f) => [f.branchId, f.stock]))).toEqual(
      new Map([
        [branchA, 4],
        [branchB, 6],
      ])
    );
  });

  it("sin performedBy no crea movimientos y el stock igual sube", async () => {
    const resultado = await createPurchaseWithBranchSplit({
      items: [{ productId: productoSinMovimientos, branchId: branchA, quantity: 8, price: 3 }],
    });
    expect(resultado.success).toBe(true);

    const { purchase } = datosDe(resultado);
    purchaseIds.push(purchase.id);

    expect(
      await prisma.branchMovement.count({ where: { reference: `PURCHASE-${purchase.id}` } })
    ).toBe(0);
    expect(
      await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: branchA, productId: productoSinMovimientos } },
      })
    ).toMatchObject({ stock: 8 });
  });

  // Va después de los casos de stock a propósito, para que el doble incremento
  // del caso de escala no dependa del orden de ejecución; usa su propia sucursal.
  it("no hace crecer los viajes a la base con 25 ítems", async () => {
    contando = true;
    queries.length = 0;
    let purchaseId = 0;
    try {
      const resultado = await createPurchaseWithBranchSplit({
        items: itemsEscala.map((it) => ({ ...it, branchId: branchEscala })),
        performedBy: "qa-escala",
      });
      expect(resultado.success).toBe(true);
      purchaseId = datosDe(resultado).purchase.id;
    } finally {
      contando = false;
    }
    purchaseIds.push(purchaseId);

    console.log(`viajes de la compra de 25 ítems: ${queries.length}`);
    expect(queries.length).toBeLessThanOrEqual(TECHO_DE_VIAJES);
  });
});
