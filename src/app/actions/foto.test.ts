/**
 * @jest-environment node
 *
 * Fotos de producto (S1/S4, T1 de `odd/tasks/fotos-vidriera-polkalinas.md`):
 * `firmarSubidaFoto`, `confirmarFoto`, `quitarFoto` y `getFotosProducto`.
 *
 * Lo que se fija acá: guardián admin primero en las cuatro acciones, hash y
 * bytes validados antes de tocar Storage, dos URLs firmadas por foto bajo el
 * path del producto (`<productId>/<hash>_lg.webp` y `<productId>/<hash>_sm.webp`)
 * para que dos productos con la misma imagen no compartan objeto, tope de 4 con
 * posición libre (0 = portada), borrado que compacta las posiciones sin huecos
 * y limpieza del bucket best-effort después de la transacción.
 */
import { confirmarFoto, firmarSubidaFoto, getFotosProducto, quitarFoto } from "./foto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { MAX_FOTOS, nombresFoto, posicionLibre } from "@/lib/storage";

jest.mock("@/lib/prisma", () => {
  const productImage = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const product = { findUnique: jest.fn() };
  const tx = { product, productImage };
  const $transaction = jest.fn(async (callback: (client: unknown) => Promise<unknown>) =>
    callback(tx)
  );

  return { prisma: { ...tx, $transaction } };
});

const mockCreateSignedUploadUrl = jest.fn();
const mockRemove = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
        remove: mockRemove,
      }),
    },
  }),
}));

type Delegate = {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

const mockPrisma = prisma as unknown as {
  product: { findUnique: jest.Mock };
  productImage: Delegate;
  $transaction: jest.Mock;
};
const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;

/** SHA-256 hex en minúsculas, tal cual lo manda el navegador. */
const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ ok: true, email: "test@feria.test" });
  mockCreateSignedUploadUrl.mockImplementation(async (path: string) => ({
    data: { signedUrl: `https://storage.test/${path}`, path, token: `token-${path}` },
    error: null,
  }));
  mockRemove.mockResolvedValue({ data: [], error: null });
  mockPrisma.product.findUnique.mockResolvedValue({ id: 7 });
  mockPrisma.productImage.findMany.mockResolvedValue([]);
  mockPrisma.productImage.create.mockResolvedValue({});
  mockPrisma.productImage.update.mockResolvedValue({});
  mockPrisma.productImage.delete.mockResolvedValue({});
});

describe("guardián admin primero", () => {
  test.each([
    ["firmarSubidaFoto", firmarSubidaFoto],
    ["confirmarFoto", confirmarFoto],
    ["quitarFoto", quitarFoto],
    ["getFotosProducto", getFotosProducto],
  ])("%s rechaza sin sesión admin y no toca Prisma ni Storage", async (_nombre, action) => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "No autorizado" });

    await expect(action({})).resolves.toEqual({ success: false, error: "No autorizado" });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.productImage.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.productImage.create).not.toHaveBeenCalled();
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });
});

describe("convención de dos tamaños", () => {
  test("los nombres salen del producto y el hash: lg para la ficha, sm para la miniatura", () => {
    expect(nombresFoto(7, HASH)).toEqual([`7/${HASH}_lg.webp`, `7/${HASH}_sm.webp`]);
  });

  test("la primera posición libre es la menor de 0..3; sin lugar devuelve null", () => {
    expect(posicionLibre([0, 1, 2])).toBe(3);
    expect(posicionLibre([0, 2])).toBe(1);
    expect(posicionLibre([1, 2, 3])).toBe(0);
    expect(posicionLibre([0, 1, 2, 3])).toBeNull();
  });
});

describe("firmarSubidaFoto", () => {
  test("firma una subida por tamaño bajo el path del producto", async () => {
    const result = await firmarSubidaFoto({ productId: 7, hash: HASH, bytes: 180_000 });

    expect(result).toEqual({
      success: true,
      data: {
        subidas: {
          lg: {
            path: `7/${HASH}_lg.webp`,
            token: `token-7/${HASH}_lg.webp`,
            signedUrl: `https://storage.test/7/${HASH}_lg.webp`,
          },
          sm: {
            path: `7/${HASH}_sm.webp`,
            token: `token-7/${HASH}_sm.webp`,
            signedUrl: `https://storage.test/7/${HASH}_sm.webp`,
          },
        },
      },
    });
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledTimes(2);
    expect(mockCreateSignedUploadUrl).toHaveBeenNthCalledWith(1, `7/${HASH}_lg.webp`);
    expect(mockCreateSignedUploadUrl).toHaveBeenNthCalledWith(2, `7/${HASH}_sm.webp`);
  });

  test.each([
    ["productId ausente", { hash: HASH, bytes: 1_000 }],
    ["productId inválido", { productId: 0, hash: HASH, bytes: 1_000 }],
    ["hash ausente", { productId: 7 }],
    ["hash no hexadecimal", { productId: 7, hash: "campera-de-jean", bytes: 1_000 }],
    ["hash demasiado corto", { productId: 7, hash: "abc123", bytes: 1_000 }],
    ["bytes cero", { productId: 7, hash: HASH, bytes: 0 }],
    ["bytes negativos", { productId: 7, hash: HASH, bytes: -5 }],
    ["bytes por encima de 2 MB", { productId: 7, hash: HASH, bytes: 2 * 1024 * 1024 + 1 }],
  ])("rechaza %s sin firmar nada", async (_caso, payload) => {
    const result = await firmarSubidaFoto(payload);

    expect(result.success).toBe(false);
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
  });

  test("sin cliente de storage informado, falla en vez de devolver una URL vacía", async () => {
    mockCreateSignedUploadUrl.mockResolvedValueOnce({
      data: null,
      error: { message: "bucket no existe" },
    });

    const result = await firmarSubidaFoto({ productId: 7, hash: HASH, bytes: 1_000 });

    expect(result.success).toBe(false);
  });
});

describe("confirmarFoto", () => {
  test("la primera foto del producto es la portada (posición 0)", async () => {
    const result = await confirmarFoto({ productId: 7, hash: HASH });

    expect(result).toEqual({ success: true, data: { position: 0 } });
    expect(mockPrisma.productImage.create).toHaveBeenCalledWith({
      data: { productId: 7, position: 0, path: HASH, alt: null, bytes: 0 },
    });
  });

  test("toma la posición libre y guarda el alt recortado", async () => {
    mockPrisma.productImage.findMany.mockResolvedValue([{ position: 0 }, { position: 2 }]);

    const result = await confirmarFoto({ productId: 7, hash: HASH, alt: "  Campera de jean  " });

    expect(result).toEqual({ success: true, data: { position: 1 } });
    expect(mockPrisma.productImage.create).toHaveBeenCalledWith({
      data: { productId: 7, position: 1, path: HASH, alt: "Campera de jean", bytes: 0 },
    });
  });

  test("rechaza el quinto archivo sin escribir la fila", async () => {
    mockPrisma.productImage.findMany.mockResolvedValue(
      Array.from({ length: MAX_FOTOS }, (_, position) => ({ position }))
    );

    const result = await confirmarFoto({ productId: 7, hash: HASH });

    expect(result.success).toBe(false);
    expect(mockPrisma.productImage.create).not.toHaveBeenCalled();
  });

  test("rechaza un producto inexistente sin escribir la fila", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const result = await confirmarFoto({ productId: 404, hash: HASH });

    expect(result.success).toBe(false);
    expect(mockPrisma.productImage.create).not.toHaveBeenCalled();
  });

  test("rechaza hash y productId inválidos", async () => {
    await expect(confirmarFoto({ productId: 7, hash: "../escape" })).resolves.toMatchObject({
      success: false,
    });
    await expect(confirmarFoto({ productId: 0, hash: HASH })).resolves.toMatchObject({
      success: false,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("quitarFoto", () => {
  test("borra la fila y compacta las posiciones restantes sin huecos", async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue({ path: HASH });
    mockPrisma.productImage.findMany.mockResolvedValue([
      { position: 1 },
      { position: 2 },
      { position: 3 },
    ]);

    const result = await quitarFoto({ productId: 7, position: 0 });

    expect(result).toEqual({ success: true, data: { position: 0 } });
    expect(mockPrisma.productImage.delete).toHaveBeenCalledWith({
      where: { productId_position: { productId: 7, position: 0 } },
    });
    // 1→0 (la primera pasa a ser la portada), 2→1, 3→2.
    expect(mockPrisma.productImage.update).toHaveBeenCalledTimes(3);
    expect(mockPrisma.productImage.update).toHaveBeenNthCalledWith(1, {
      where: { productId_position: { productId: 7, position: 1 } },
      data: { position: 0 },
    });
    expect(mockPrisma.productImage.update).toHaveBeenNthCalledWith(2, {
      where: { productId_position: { productId: 7, position: 2 } },
      data: { position: 1 },
    });
    expect(mockPrisma.productImage.update).toHaveBeenNthCalledWith(3, {
      where: { productId_position: { productId: 7, position: 3 } },
      data: { position: 2 },
    });
  });

  test("no reescribe las filas que ya estaban en su lugar", async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue({ path: HASH });
    mockPrisma.productImage.findMany.mockResolvedValue([{ position: 0 }, { position: 1 }]);

    await quitarFoto({ productId: 7, position: 2 });

    expect(mockPrisma.productImage.update).not.toHaveBeenCalled();
  });

  test("borra los dos objetos del bucket best-effort después de la transacción", async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue({ path: HASH });

    await quitarFoto({ productId: 7, position: 0 });

    expect(mockRemove).toHaveBeenCalledWith(nombresFoto(7, HASH));
    expect(mockPrisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(
      mockRemove.mock.invocationCallOrder[0]
    );
  });

  test("si el bucket falla, la fila ya borrada no vuelve atrás", async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue({ path: HASH });
    mockRemove.mockResolvedValue({ data: null, error: { message: "storage caído" } });

    const result = await quitarFoto({ productId: 7, position: 0 });

    expect(result).toEqual({ success: true, data: { position: 0 } });
  });

  test("rechaza una posición inexistente sin borrar objetos", async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue(null);

    const result = await quitarFoto({ productId: 7, position: 3 });

    expect(result.success).toBe(false);
    expect(mockPrisma.productImage.delete).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  test("rechaza una posición fuera de 0..3 antes de tocar Prisma", async () => {
    await expect(quitarFoto({ productId: 7, position: 4 })).resolves.toMatchObject({
      success: false,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("getFotosProducto", () => {
  test("lee las fotos ordenadas por posición", async () => {
    const filas = [
      { position: 0, path: HASH, alt: "Portada", bytes: 1_000 },
      { position: 1, path: "b2c3d4e5f60718293a4b5c6d7e8f90aa", alt: null, bytes: 2_000 },
    ];
    mockPrisma.productImage.findMany.mockResolvedValue(filas);

    const result = await getFotosProducto({ productId: 7 });

    expect(result).toEqual({ success: true, data: filas });
    expect(mockPrisma.productImage.findMany).toHaveBeenCalledWith({
      where: { productId: 7 },
      orderBy: { position: "asc" },
      select: { position: true, path: true, alt: true, bytes: true },
    });
  });

  test("rechaza un productId inválido sin consultar la base", async () => {
    await expect(getFotosProducto({ productId: "7" })).resolves.toMatchObject({ success: false });
    expect(mockPrisma.productImage.findMany).not.toHaveBeenCalled();
  });
});
