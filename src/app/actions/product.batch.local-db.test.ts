/** @jest-environment node */

/**
 * Alta masiva de productos (`createProductsBatch`) contra la base local.
 *
 * Lo que se fija acá es lo observable del contrato: códigos consecutivos por
 * prefijo en el orden de las filas, nombre duplicado que bloquea solo si el
 * producto existente está activo, y todo o nada cuando una fila falla, el
 * prefijo se agota o la categoría no existe.
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

const PREFIJOS = [
  PREFIJO_TREINTA,
  PREFIJO_MIXTO,
  PREFIJO_OTRO,
  PREFIJO_INVALIDO,
  PREFIJO_AGOTADO,
  PREFIJO_CONCURRENTE,
  PREFIJO_CONFLICTO,
];

const NOMBRE_EXISTENTE = `${marca} nombre existente`;
const NOMBRE_INACTIVO = `${marca} nombre inactivo`;
const CATEGORIA_INEXISTENTE = 2_000_000_001;

type Cliente = (typeof import("@/lib/prisma"))["prisma"];
type Acciones = typeof import("@/app/actions/product");

let prisma: Cliente;
let acciones: Acciones;
let categoryId = 0;

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

    const categoria = await prisma.category.create({
      data: { name: `${marca} categoria` },
    });
    categoryId = categoria.id;

    await prisma.product.create({
      data: { name: NOMBRE_EXISTENTE, code: `${base}EX`, price: 1 },
    });
    await prisma.product.create({
      data: { name: NOMBRE_INACTIVO, code: `${base}IN`, price: 1, active: false },
    });
  });

  afterAll(async () => {
    await limpiar();
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.$disconnect();
  });

  it("crea 30 filas del mismo prefijo con códigos consecutivos en el orden de las filas", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      name: `${marca} treinta ${i}`,
      prefix: PREFIJO_TREINTA,
      price: 10 + i,
    }));

    const resultado = await acciones.createProductsBatch({ categoryId, rows });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    const productos = resultado.data.products;
    expect(productos).toHaveLength(30);
    expect(productos.map((p) => p.code)).toEqual(
      Array.from({ length: 30 }, (_, i) => `${PREFIJO_TREINTA}${String(i).padStart(3, "0")}`)
    );
    expect(productos.map((p) => p.name)).toEqual(rows.map((r) => r.name));
    // La categoría es una sola para todo el lote.
    const guardados = await prisma.product.findMany({
      where: { code: { in: productos.map((p) => p.code) } },
      select: { categoryId: true },
    });
    expect(guardados.every((p) => p.categoryId === categoryId)).toBe(true);
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

  it("con una categoría inexistente falla y no escribe nada", async () => {
    const antes = await prisma.product.count({ where: { codePrefix: PREFIJO_CONFLICTO } });

    const resultado = await acciones.createProductsBatch({
      categoryId: CATEGORIA_INEXISTENTE,
      rows: [{ name: `${marca} categoria mala`, prefix: PREFIJO_CONFLICTO, price: 1 }],
    });

    expect(resultado).toEqual({ success: false, error: "La categoría seleccionada no existe" });
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
});

export {};
