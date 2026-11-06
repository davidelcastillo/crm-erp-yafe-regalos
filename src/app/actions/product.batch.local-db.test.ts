/** @jest-environment node */

/**
 * Alta masiva de productos (`createProductsBatch`) contra la base local.
 *
 * Lo que se fija acá es lo observable del contrato: códigos consecutivos por
 * prefijo en el orden de las filas, nombre duplicado que bloquea solo si el
 * producto existente está activo, y todo o nada cuando una fila falla, el
 * prefijo se agota o la categoría no existe.
 *
 * T5 suma el ingreso inicial (S2, S11): stock por fila en una sucursal global
 * del lote, movimiento `ENTRY` y comprobante solo para las filas con stock, y
 * la atomicidad multi-sentencia que recién acá se puede probar.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */

jest.setTimeout(60000);

const sufijo = Math.floor(1000 + Math.random() * 9000);
const letra = (n: number) => String.fromCharCode(65 + (n % 26));
const base = `${letra(sufijo)}${letra(Math.floor(sufijo / 26))}`;
const marca = `QA lote ${sufijo}`;

const PREFIJO_TREINTA = `${base}A`;
const PREFIJO_MIXTO = `${base}B`;
const PREFIJO_OTRO = `${base}C`;
const PREFIJO_INVALIDO = `${base}D`;
const PREFIJO_AGOTADO = `${base}E`;
const PREFIJO_CONCURRENTE = `${base}F`;
const PREFIJO_CONFLICTO = `${base}G`;
const PREFIJO_ATOMICO = `${base}H`;
const PREFIJO_STOCK = `${base}J`;
const PREFIJO_SIN_SUCURSAL = `${base}K`;
const PREFIJO_ATOMICO_STOCK = `${base}L`;

const PREFIJOS = [
  PREFIJO_TREINTA,
  PREFIJO_MIXTO,
  PREFIJO_OTRO,
  PREFIJO_INVALIDO,
  PREFIJO_AGOTADO,
  PREFIJO_CONCURRENTE,
  PREFIJO_CONFLICTO,
  PREFIJO_ATOMICO,
  PREFIJO_STOCK,
  PREFIJO_SIN_SUCURSAL,
  PREFIJO_ATOMICO_STOCK,
];

const NOMBRE_SUCURSAL = `QA lote sucursal ${sufijo}`;
const CODIGO_SUCURSAL = `QS${sufijo}`;
const CODIGO_SUCURSAL_INACTIVA = `QT${sufijo}`;

const NOMBRE_EXISTENTE = `${marca} nombre existente`;
const NOMBRE_INACTIVO = `${marca} nombre inactivo`;
const CATEGORIA_INEXISTENTE = 2_000_000_001;

type Cliente = (typeof import("@/lib/prisma"))["prisma"];
type Acciones = typeof import("@/app/actions/product");

let prisma: Cliente;
let acciones: Acciones;
let categoryId = 0;
let categoryId2 = 0;
let branchId = 0;
let branchInactivaId = 0;

const limpiar = async () => {
  await prisma.product.deleteMany({
    where: { OR: [{ codePrefix: { in: PREFIJOS } }, { name: { startsWith: marca } }] },
  });
};

describe("createProductsBatch (integración, base local)", () => {
  beforeAll(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    jest.resetModules();

    prisma = (await import("@/lib/prisma")).prisma;
    acciones = await import("@/app/actions/product");

    await limpiar();

    // `code` de sucursal es único: si una corrida anterior se cortó, se limpia antes.
    await prisma.branch.deleteMany({ where: { code: { in: [CODIGO_SUCURSAL, CODIGO_SUCURSAL_INACTIVA] } } });
    // `authUserId` no nulo: `branchAdminService.populateAuthUserIds` actualiza
    // todas las sucursales sin authUserId y pisaría las fixtures.
    const sucursal = await prisma.branch.create({
      data: { name: NOMBRE_SUCURSAL, code: CODIGO_SUCURSAL, authUserId: `qa-lote-${sufijo}` },
    });
    branchId = sucursal.id;
    const sucursalInactiva = await prisma.branch.create({
      data: { name: `QA lote inactiva ${sufijo}`, code: CODIGO_SUCURSAL_INACTIVA, isActive: false },
    });
    branchInactivaId = sucursalInactiva.id;

    const categoria = await prisma.category.create({
      data: { name: `${marca} categoria` },
    });
    categoryId = categoria.id;

    const categoria2 = await prisma.category.create({
      data: { name: `${marca} categoria dos` },
    });
    categoryId2 = categoria2.id;

    await prisma.product.create({
      data: { name: NOMBRE_EXISTENTE, code: `${base}EX`, price: 1 },
    });
    await prisma.product.create({
      data: { name: NOMBRE_INACTIVO, code: `${base}IN`, price: 1, active: false },
    });
  });

  afterAll(async () => {
    await limpiar();
    await prisma.category.deleteMany({ where: { id: { in: [categoryId, categoryId2] } } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchId, branchInactivaId] } } });
    await prisma.$disconnect();
  });

  it("crea 30 filas del mismo prefijo con códigos consecutivos en el orden de las filas", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      name: `${marca} treinta ${i}`,
      prefix: PREFIJO_TREINTA,
      price: 10 + i,
      categoryId,
    }));

    const resultado = await acciones.createProductsBatch({ rows });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    const productos = resultado.data.products;
    expect(productos).toHaveLength(30);
    expect(productos.map((p) => p.code)).toEqual(
      Array.from({ length: 30 }, (_, i) => `${PREFIJO_TREINTA}${String(i).padStart(3, "0")}`)
    );
    expect(productos.map((p) => p.name)).toEqual(rows.map((r) => r.name));
    // Cada fila escribió la categoría que traía (S4: una por fila).
    const guardados = await prisma.product.findMany({
      where: { code: { in: productos.map((p) => p.code) } },
      select: { categoryId: true },
    });
    expect(guardados.every((p) => p.categoryId === categoryId)).toBe(true);
  });

  // S4: la categoría dejó de ser compartida; cada fila guarda la suya.
  it("dos filas con categorías distintas guardan cada una la propia", async () => {
    const resultado = await acciones.createProductsBatch({
      rows: [
        { name: `${marca} categorias a`, prefix: PREFIJO_CONFLICTO, price: 1, categoryId },
        { name: `${marca} categorias b`, prefix: PREFIJO_CONFLICTO, price: 1, categoryId: categoryId2 },
      ],
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    const guardados = await prisma.product.findMany({
      where: { code: { in: resultado.data.products.map((p) => p.code) } },
      select: { name: true, categoryId: true },
    });
    const porNombre = new Map(guardados.map((p) => [p.name, p.categoryId]));
    expect(porNombre.get(`${marca} categorias a`)).toBe(categoryId);
    expect(porNombre.get(`${marca} categorias b`)).toBe(categoryId2);
  });

  it("una fila sin categoría se crea igual y la guarda en null", async () => {
    const resultado = await acciones.createProductsBatch({
      rows: [{ name: `${marca} sin categoria`, prefix: PREFIJO_CONFLICTO, price: 1, categoryId: null }],
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    const guardado = await prisma.product.findUnique({
      where: { code: resultado.data.products[0].code },
      select: { categoryId: true },
    });
    expect(guardado).toEqual({ categoryId: null });
  });

  it("prefijos mezclados: sigue la secuencia del prefijo y el otro arranca en 000", async () => {
    await prisma.product.create({
      data: { name: `${marca} mixto existente`, code: `${PREFIJO_MIXTO}005`, codePrefix: PREFIJO_MIXTO, price: 1 },
    });

    const resultado = await acciones.createProductsBatch({
      rows: [
        { name: `${marca} mixto a`, prefix: PREFIJO_MIXTO, price: 1 },
        { name: `${marca} mixto b`, prefix: PREFIJO_OTRO, price: 1 },
        { name: `${marca} mixto c`, prefix: PREFIJO_MIXTO, price: 1 },
      ],
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.products.map((p) => p.code)).toEqual([
      `${PREFIJO_MIXTO}006`,
      `${PREFIJO_OTRO}000`,
      `${PREFIJO_MIXTO}007`,
    ]);
  });

  it("una fila inválida en el índice 16 no crea nada y vuelve con rowErrors", async () => {
    const rows = Array.from({ length: 17 }, (_, i) => ({
      name: i === 16 ? "" : `${marca} invalido ${i}`,
      prefix: PREFIJO_INVALIDO,
      price: 1,
    }));
    const antes = await prisma.product.count({ where: { codePrefix: PREFIJO_INVALIDO } });

    const resultado = await acciones.createProductsBatch({ rows });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    expect(resultado.rowErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ row: 16, field: "name" })])
    );
    expect(await prisma.product.count({ where: { codePrefix: PREFIJO_INVALIDO } })).toBe(antes);
  });

  it("con el prefijo agotado falla con el mensaje exacto y no escribe ninguna fila", async () => {
    await prisma.product.create({
      data: { name: `${marca} agotado tope`, code: `${PREFIJO_AGOTADO}998`, codePrefix: PREFIJO_AGOTADO, price: 1 },
    });
    const antes = await prisma.product.count({ where: { codePrefix: PREFIJO_AGOTADO } });
    expect(antes).toBe(1);

    const resultado = await acciones.createProductsBatch({
      rows: [
        { name: `${marca} agotado a`, prefix: PREFIJO_AGOTADO, price: 1 },
        { name: `${marca} agotado b`, prefix: PREFIJO_AGOTADO, price: 1 },
        { name: `${marca} agotado c`, prefix: PREFIJO_AGOTADO, price: 1 },
      ],
    });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    expect(resultado.error).toBe(`Prefijo ${PREFIJO_AGOTADO} agotado (máximo 999 códigos)`);
    expect((resultado.rowErrors ?? []).map((e) => e.row)).toEqual([0, 1, 2]);
    expect(await prisma.product.count({ where: { codePrefix: PREFIJO_AGOTADO } })).toBe(antes);
  });

  // La categoría es de cada fila: la que no existe falla el lote entero y se marca solo ahí.
  it("con una categoría inexistente en una fila falla todo y no escribe nada", async () => {
    const antes = await prisma.product.count({ where: { codePrefix: PREFIJO_CONFLICTO } });

    const resultado = await acciones.createProductsBatch({
      rows: [
        { name: `${marca} categoria buena`, prefix: PREFIJO_CONFLICTO, price: 1, categoryId },
        { name: `${marca} categoria mala`, prefix: PREFIJO_CONFLICTO, price: 1, categoryId: CATEGORIA_INEXISTENTE },
      ],
    });

    expect(resultado).toEqual({
      success: false,
      error: "La categoría seleccionada no existe",
      rowErrors: [{ row: 1, field: "categoryId", message: "La categoría seleccionada no existe" }],
    });
    expect(await prisma.product.count({ where: { codePrefix: PREFIJO_CONFLICTO } })).toBe(antes);
  });

  it("rechaza 51 filas sin escribir", async () => {
    const antes = await prisma.product.count({ where: { codePrefix: PREFIJO_CONFLICTO } });

    const resultado = await acciones.createProductsBatch({
      rows: Array.from({ length: 51 }, (_, i) => ({
        name: `${marca} cincuenta y uno ${i}`,
        prefix: PREFIJO_CONFLICTO,
        price: 1,
      })),
    });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    expect(resultado.error).toBe("Máximo 50 productos por carga");
    expect(await prisma.product.count({ where: { codePrefix: PREFIJO_CONFLICTO } })).toBe(antes);
  });

  it("un nombre activo existente bloquea su fila y no se escribe nada", async () => {
    const antes = await prisma.product.count({ where: { codePrefix: PREFIJO_CONFLICTO } });

    const resultado = await acciones.createProductsBatch({
      rows: [
        { name: `${marca} libre`, prefix: PREFIJO_CONFLICTO, price: 1 },
        { name: NOMBRE_EXISTENTE.toUpperCase(), prefix: PREFIJO_CONFLICTO, price: 1 },
      ],
    });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    expect(resultado.rowErrors).toEqual([
      { row: 1, field: "name", message: "Ya existe un producto con ese nombre" },
    ]);
    expect(await prisma.product.count({ where: { codePrefix: PREFIJO_CONFLICTO } })).toBe(antes);
  });

  it("un nombre de un producto inactivo no bloquea", async () => {
    const resultado = await acciones.createProductsBatch({
      rows: [{ name: NOMBRE_INACTIVO, prefix: PREFIJO_CONFLICTO, price: 1 }],
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.products).toHaveLength(1);
  });

  // Prueba que no se repiten códigos, no que las rutas se excluyan: `code` es único y ambas reintentan ante P2002, así que pasaría sin el lock.
  it("createProduct y createProductsBatch en paralelo sobre el mismo prefijo no repiten código", async () => {
    const [lote, individual] = await Promise.all([
      acciones.createProductsBatch({
        rows: [
          { name: `${marca} paralelo a`, prefix: PREFIJO_CONCURRENTE, price: 1 },
          { name: `${marca} paralelo b`, prefix: PREFIJO_CONCURRENTE, price: 1 },
          { name: `${marca} paralelo c`, prefix: PREFIJO_CONCURRENTE, price: 1 },
        ],
      }),
      acciones.createProduct({ name: `${marca} paralelo individual`, prefix: PREFIJO_CONCURRENTE, price: 1 }),
    ]);

    expect(lote.success).toBe(true);
    expect(individual.success).toBe(true);
    if (!lote.success || !individual.success) return;

    const codigos = [
      ...lote.data.products.map((p) => p.code),
      String(individual.data?.code),
    ];
    expect(new Set(codigos).size).toBe(4);
    expect(codigos.sort()).toEqual(["000", "001", "002", "003"].map((n) => `${PREFIJO_CONCURRENTE}${n}`));
  });

  it("si el insert choca, no queda ninguna fila del lote y el producto heredado sigue intacto", async () => {
    // Peligro heredado (H3): un código viejo con `codePrefix` nulo no lo ve la
    // búsqueda por prefijo, así que el lote regenera ese mismo código y el
    // insert choca contra la unicidad global de `code`. Es el único caso que
    // falla EN el insert: los demás abortan antes de escribir nada.
    const codigoHeredado = `${PREFIJO_ATOMICO}000`;
    const heredado = await prisma.product.create({
      data: { name: `${marca} legado atomico`, code: codigoHeredado, price: 1 },
    });
    const antes = await prisma.product.count({ where: { code: { startsWith: PREFIJO_ATOMICO } } });
    expect(antes).toBe(1);

    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const resultado = await acciones.createProductsBatch({
      rows: [
        { name: `${marca} atomico a`, prefix: PREFIJO_ATOMICO, price: 1 },
        { name: `${marca} atomico b`, prefix: PREFIJO_ATOMICO, price: 1 },
        { name: `${marca} atomico c`, prefix: PREFIJO_ATOMICO, price: 1 },
      ],
    });
    consoleError.mockRestore();

    // Los 3 intentos chocan y se agotan: el error es el genérico, sin rowErrors.
    expect(resultado).toEqual({ success: false, error: "Error al crear los productos" });
    // Ninguna fila del lote quedó: con ese prefijo solo está el heredado.
    expect(await prisma.product.count({ where: { code: { startsWith: PREFIJO_ATOMICO } } })).toBe(1);
    // El heredado sigue ahí, sin tocar.
    expect(
      await prisma.product.findUnique({
        where: { id: heredado.id },
        select: { code: true, codePrefix: true, name: true },
      })
    ).toEqual({ code: codigoHeredado, codePrefix: null, name: `${marca} legado atomico` });
  });
  // C1 del documento (S2, S11): stock inicial, movimiento ENTRY y comprobante.
  it("C1: deja inventario de las tres filas, movimiento ENTRY solo de las que tienen stock y su comprobante", async () => {
    const resultado = await acciones.createProductsBatch({
      branchId,
      rows: [
        { name: `${marca} c1 a`, prefix: PREFIJO_STOCK, price: 10, initialStock: 5 },
        { name: `${marca} c1 b`, prefix: PREFIJO_STOCK, price: 20, initialStock: 0 },
        { name: `${marca} c1 c`, prefix: PREFIJO_STOCK, price: 30, initialStock: 12 },
      ],
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    const { products, receipt } = resultado.data;
    expect(products.map((p) => p.code)).toEqual([
      `${PREFIJO_STOCK}000`,
      `${PREFIJO_STOCK}001`,
      `${PREFIJO_STOCK}002`,
    ]);
    const [a, b, c] = products.map((p) => p.id);

    // Inventario: las tres filas, incluida la de stock 0 (S11/H1).
    const inventario = await prisma.branchInventory.findMany({
      where: { branchId, productId: { in: [a, b, c] } },
      select: { productId: true, stock: true },
    });
    expect(inventario).toHaveLength(3);
    const stockPorProducto = new Map(inventario.map((i) => [i.productId, i.stock]));
    expect(stockPorProducto.get(a)).toBe(5);
    expect(stockPorProducto.get(b)).toBe(0);
    expect(stockPorProducto.get(c)).toBe(12);

    // Movimientos: exactamente dos, ENTRY, con el motivo y el admin de la sesión.
    const movimientos = await prisma.branchMovement.findMany({
      where: { branchId, productId: { in: [a, b, c] } },
      select: {
        productId: true,
        movementType: true,
        quantity: true,
        reference: true,
        performedBy: true,
      },
    });
    expect(movimientos).toHaveLength(2);
    expect(movimientos).toEqual(
      expect.arrayContaining([
        {
          productId: a,
          movementType: "ENTRY",
          quantity: 5,
          reference: "ALTA DE PRODUCTOS",
          performedBy: "test@feria.test",
        },
        {
          productId: c,
          movementType: "ENTRY",
          quantity: 12,
          reference: "ALTA DE PRODUCTOS",
          performedBy: "test@feria.test",
        },
      ])
    );

    // Cabecera del comprobante.
    expect(receipt).not.toBeNull();
    if (!receipt) return;
    expect(receipt.movementType).toBe("ENTRY");
    expect(receipt.branchId).toBe(branchId);
    expect(receipt.branchName).toBe(NOMBRE_SUCURSAL);
    expect(receipt.branchCode).toBe(CODIGO_SUCURSAL);
    expect(receipt.reference).toBe("ALTA DE PRODUCTOS");
    expect(Number.isNaN(Date.parse(receipt.date))).toBe(false);

    // Filas: solo A y C, en el orden de las filas, con el saldo leído de la base.
    expect(receipt.rows).toEqual([
      {
        productId: a,
        code: products[0].code,
        name: products[0].name,
        price: 10,
        quantity: 5,
        stock: stockPorProducto.get(a),
      },
      {
        productId: c,
        code: products[2].code,
        name: products[2].name,
        price: 30,
        quantity: 12,
        stock: stockPorProducto.get(c),
      },
    ]);
    // La fila con stock 0 no va al comprobante: las etiquetas exigen cantidad >= 1.
    expect(receipt.rows.some((row) => row.productId === b)).toBe(false);

    // Cruce: un movimiento por fila del comprobante y ninguno queda sin fila.
    for (const row of receipt.rows) {
      const propios = movimientos.filter((m) => m.productId === row.productId);
      expect(propios).toHaveLength(1);
      expect(propios[0].quantity).toBe(row.quantity);
    }

    // El PDF del comprobante se arma con este snapshot (pdf-lib corre en node).
    const { generateStockMovementPdf } = await import("@/lib/utils/stock-movement-pdf");
    const pdf = await generateStockMovementPdf(receipt);
    expect(pdf.byteLength).toBeGreaterThan(0);
  });

  // Sucursal inactiva: falla antes de la transacción y no deja rastro.
  it("con una sucursal inactiva no crea productos, inventario ni movimientos", async () => {
    const contar = () =>
      Promise.all([
        prisma.product.count({ where: { codePrefix: PREFIJO_SIN_SUCURSAL } }),
        prisma.branchInventory.count({ where: { branchId: branchInactivaId } }),
        prisma.branchMovement.count({ where: { branchId: branchInactivaId } }),
      ]);
    const antes = await contar();

    const resultado = await acciones.createProductsBatch({
      branchId: branchInactivaId,
      rows: [
        { name: `${marca} inactiva a`, prefix: PREFIJO_SIN_SUCURSAL, price: 10, initialStock: 4 },
      ],
    });

    expect(resultado).toEqual({ success: false, error: "Sucursal inválida o inactiva" });
    expect(await contar()).toEqual(antes);
  });

  // La UI todavía no manda sucursal: el lote tiene que seguir igual que antes.
  it("sin sucursal sigue creando solo productos y devuelve receipt null", async () => {
    const resultado = await acciones.createProductsBatch({
      rows: [
        { name: `${marca} sin sucursal a`, prefix: PREFIJO_SIN_SUCURSAL, price: 10 },
        { name: `${marca} sin sucursal b`, prefix: PREFIJO_SIN_SUCURSAL, price: 10, initialStock: 7 },
      ],
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.receipt).toBeNull();

    const ids = resultado.data.products.map((p) => p.id);
    expect(await prisma.branchInventory.count({ where: { productId: { in: ids } } })).toBe(0);
    expect(await prisma.branchMovement.count({ where: { productId: { in: ids } } })).toBe(0);
  });

  // Atomicidad MULTI-SENTENCIA, la que T2b no podía probar: acá hay una segunda
  // escritura (BranchInventory) después del insert de productos. El fallo se
  // fuerza con un stock de 3.000 millones, que no entra en un INTEGER de
  // Postgres: el insert de productos ya se ejecutó y el de inventario revienta.
  it("si el stock inicial falla después del insert, no queda ningún producto ni stock", async () => {
    const antes = await prisma.product.count({ where: { codePrefix: PREFIJO_ATOMICO_STOCK } });
    expect(antes).toBe(0);

    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const resultado = await acciones.createProductsBatch({
      branchId,
      rows: [
        { name: `${marca} atomico stock a`, prefix: PREFIJO_ATOMICO_STOCK, price: 10, initialStock: 3 },
        {
          name: `${marca} atomico stock b`,
          prefix: PREFIJO_ATOMICO_STOCK,
          price: 10,
          initialStock: 3_000_000_000,
        },
      ],
    });
    consoleError.mockRestore();

    expect(resultado).toEqual({ success: false, error: "Error al crear los productos" });
    // La fila válida (stock 3) tampoco quedó: la transacción revirtió las dos escrituras.
    expect(await prisma.product.count({ where: { codePrefix: PREFIJO_ATOMICO_STOCK } })).toBe(0);
    expect(
      await prisma.branchInventory.count({
        where: { branchId, product: { code: { startsWith: PREFIJO_ATOMICO_STOCK } } },
      })
    ).toBe(0);
    expect(
      await prisma.branchMovement.count({
        where: { branchId, product: { code: { startsWith: PREFIJO_ATOMICO_STOCK } } },
      })
    ).toBe(0);
  });
});

export {};
