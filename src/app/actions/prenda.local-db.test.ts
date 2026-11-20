/** @jest-environment node */

/**
 * Alta de prenda contra la base local (`npm run test:local-db`).
 *
 * Lo que recién acá se puede probar: el código `PK…` sale del generador real
 * con su advisory lock, la ficha completa queda escrita en Postgres, la fila de
 * inventario y el movimiento `ENTRY` coinciden con el comprobante, y una falla
 * DESPUÉS del insert del producto no deja nada a medias (atomicidad
 * multi-sentencia).
 */

jest.setTimeout(60000);

const sufijo = Math.floor(1000 + Math.random() * 9000);
const marca = `QA prenda ${sufijo}`;
const CODIGO_SUCURSAL = `QP${sufijo}`;
const NOMBRE_SUCURSAL = `${marca} deposito`;

type Cliente = (typeof import("@/lib/prisma"))["prisma"];
type Acciones = typeof import("@/app/actions/prenda");

let prisma: Cliente;
let acciones: Acciones;
let branchId = 0;
let categoriaId = 0;
let condicionId = 0;
let estiloId = 0;
let estiloId2 = 0;
let medidaTipoId = 0;

const limpiarProductos = async () => {
  // `PrendaDetalle`, estilos, medidas, publicaciones, inventario y movimientos
  // cuelgan del producto con `onDelete: Cascade`.
  await prisma.product.deleteMany({ where: { name: { startsWith: marca } } });
};

describe("createPrenda (integración, base local)", () => {
  beforeAll(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    jest.resetModules();

    prisma = (await import("@/lib/prisma")).prisma;
    acciones = await import("@/app/actions/prenda");

    await limpiarProductos();
    await prisma.branch.deleteMany({ where: { code: CODIGO_SUCURSAL } });
    await prisma.categoriaPrenda.deleteMany({ where: { name: { startsWith: marca } } });
    await prisma.condicionPrenda.deleteMany({ where: { name: { startsWith: marca } } });
    await prisma.estiloPrenda.deleteMany({ where: { name: { startsWith: marca } } });
    await prisma.medidaTipo.deleteMany({ where: { name: { startsWith: marca } } });

    // `authUserId` no nulo: el poblador de sucursales lo exigiría después.
    const sucursal = await prisma.branch.create({
      data: { name: NOMBRE_SUCURSAL, code: CODIGO_SUCURSAL, authUserId: `qa-prenda-${sufijo}` },
    });
    branchId = sucursal.id;

    categoriaId = (
      await prisma.categoriaPrenda.create({
        data: { name: `${marca} categoria`, esUnicaPorDefecto: true },
      })
    ).id;
    condicionId = (
      await prisma.condicionPrenda.create({ data: { name: `${marca} condicion` } })
    ).id;
    estiloId = (await prisma.estiloPrenda.create({ data: { name: `${marca} estilo uno` } })).id;
    estiloId2 = (await prisma.estiloPrenda.create({ data: { name: `${marca} estilo dos` } })).id;
    medidaTipoId = (await prisma.medidaTipo.create({ data: { name: `${marca} axila` } })).id;
  });

  afterAll(async () => {
    await limpiarProductos();
    await prisma.categoriaPrenda.deleteMany({ where: { id: categoriaId } });
    await prisma.condicionPrenda.deleteMany({ where: { id: condicionId } });
    await prisma.estiloPrenda.deleteMany({ where: { id: { in: [estiloId, estiloId2] } } });
    await prisma.medidaTipo.deleteMany({ where: { id: medidaTipoId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
  });

  const altaUnica = (nombre: string) => ({
    nombre,
    descripcion: "Segunda mano",
    precio: 12000,
    costo: 4000,
    categoriaPrendaId: categoriaId,
    talle: "Único",
    condicionId,
    detalleCondicion: "Mancha chica",
    detalleIntervencion: "",
    estilos: [estiloId, estiloId2],
    medidas: [{ medidaTipoId, valorCm: 48.5 }],
    esUnica: true,
    cantidad: 1,
    branchId,
    publicadaEn: ["Web", "Instagram"],
  });

  it("crea la prenda completa, deja el stock, el movimiento y su comprobante", async () => {
    const resultado = await acciones.createPrenda(altaUnica(`${marca} campera`));

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    const { product, receipt } = resultado.data;
    const productId = product.id;

    // Código del generador real, con el prefijo de las prendas.
    expect(product.code).toMatch(/^PK\d{3}$/);
    expect(product.code).toBe(
      await prisma.product
        .findUnique({ where: { id: productId }, select: { code: true } })
        .then((p) => p?.code)
    );

    // Producto + ficha.
    const fila = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        kind: true,
        codePrefix: true,
        name: true,
        description: true,
        price: true,
        prenda: {
          select: {
            esUnica: true,
            categoriaId: true,
            condicionId: true,
            talle: true,
            detalleCondicion: true,
            detalleIntervencion: true,
            costo: true,
            estilos: { select: { estiloId: true } },
            medidas: { select: { medidaTipoId: true, valorCm: true } },
          },
        },
        publicaciones: { select: { canal: true } },
      },
    });
    expect(fila?.kind).toBe("PRENDA");
    expect(fila?.codePrefix).toBe("PK");
    expect(Number(fila?.price)).toBe(12000);
    expect(fila?.prenda).toMatchObject({
      esUnica: true,
      categoriaId,
      condicionId,
      talle: "Único",
      detalleCondicion: "Mancha chica",
      detalleIntervencion: null,
    });
    expect(Number(fila?.prenda?.costo)).toBe(4000);
    expect(fila?.prenda?.estilos.map((e) => e.estiloId).sort()).toEqual([estiloId, estiloId2].sort());
    expect(fila?.prenda?.medidas).toHaveLength(1);
    expect(Number(fila?.prenda?.medidas[0].valorCm)).toBe(48.5);
    expect(fila?.publicaciones.map((p) => p.canal).sort()).toEqual(["Instagram", "Web"]);

    // Stock y movimiento de ingreso.
    expect(
      await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId, productId } },
        select: { stock: true },
      })
    ).toEqual({ stock: 1 });

    const movimientos = await prisma.branchMovement.findMany({
      where: { productId },
      select: { movementType: true, quantity: true, reference: true, performedBy: true, branchId: true },
    });
    expect(movimientos).toEqual([
      {
        movementType: "ENTRY",
        quantity: 1,
        reference: "ALTA DE PRENDA",
        performedBy: "test@feria.test",
        branchId,
      },
    ]);

    // Comprobante: cabecera de la sucursal y la fila con el saldo real.
    expect(receipt).toMatchObject({
      movementType: "ENTRY",
      branchId,
      branchName: NOMBRE_SUCURSAL,
      branchCode: CODIGO_SUCURSAL,
      reference: "ALTA DE PRENDA",
    });
    expect(Number.isNaN(Date.parse(receipt.date))).toBe(false);
    expect(receipt.rows).toEqual([
      { productId, code: product.code, name: product.name, price: 12000, quantity: 1, stock: 1 },
    ]);

    // El PDF del comprobante se arma con este snapshot.
    const { generateStockMovementPdf } = await import("@/lib/utils/stock-movement-pdf");
    expect((await generateStockMovementPdf(receipt)).byteLength).toBeGreaterThan(0);

    // La ficha se puede volver a leer tal como la espera el formulario.
    expect(await acciones.getPrenda(productId)).toMatchObject({
      success: true,
      data: {
        id: productId,
        categoriaPrendaId: categoriaId,
        condicionId,
        esUnica: true,
        estilos: expect.arrayContaining([estiloId, estiloId2]),
        publicadaEn: expect.arrayContaining(["Web", "Instagram"]),
      },
    });
  });

  it("los códigos de prenda siguen la secuencia del prefijo PK", async () => {
    const primera = await acciones.createPrenda(altaUnica(`${marca} remera a`));
    const segunda = await acciones.createPrenda(altaUnica(`${marca} remera b`));

    expect(primera.success).toBe(true);
    expect(segunda.success).toBe(true);
    if (!primera.success || !segunda.success) return;

    const a = Number(primera.data.product.code.slice(2));
    const b = Number(segunda.data.product.code.slice(2));
    expect(b).toBe(a + 1);
  });

  it("si una escritura falla después del insert del producto, no queda nada a medias", async () => {
    const nombre = `${marca} atomica`;
    const antes = await Promise.all([
      prisma.product.count({ where: { name: nombre } }),
      prisma.prendaDetalle.count(),
      prisma.branchInventory.count({ where: { branchId } }),
      prisma.branchMovement.count({ where: { branchId } }),
    ]);

    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    // `costo` no entra en el DECIMAL(10,2) de `PrendaDetalle`: el producto ya se
    // insertó y la falla ocurre en la escritura siguiente de la transacción.
    const resultado = await acciones.createPrenda({ ...altaUnica(nombre), costo: 1e9 });
    consoleError.mockRestore();

    expect(resultado).toEqual({ success: false, error: "Error al crear la prenda" });
    expect(
      await Promise.all([
        prisma.product.count({ where: { name: nombre } }),
        prisma.prendaDetalle.count(),
        prisma.branchInventory.count({ where: { branchId } }),
        prisma.branchMovement.count({ where: { branchId } }),
      ])
    ).toEqual(antes);
  });
});
