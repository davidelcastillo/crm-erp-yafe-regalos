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

type Cliente = (typeof import("@/lib/prisma"))["prisma"];
type Acciones = typeof import("@/app/actions/product");

let prisma: Cliente;
let acciones: Acciones;

describe("createProduct (integración, base local)", () => {
  beforeAll(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    jest.resetModules();

    prisma = (await import("@/lib/prisma")).prisma;
    acciones = await import("@/app/actions/product");

    await prisma.product.deleteMany({
      where: { codePrefix: { in: [PREFIJO_NUEVO, PREFIJO_AGOTADO] } },
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: { codePrefix: { in: [PREFIJO_NUEVO, PREFIJO_AGOTADO] } },
    });
    await prisma.$disconnect();
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
});

export {};
