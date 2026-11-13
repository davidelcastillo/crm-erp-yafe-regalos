/**
 * Integration test for createProduct Server Action
 */
import { createProduct, createProductsBatch, getProducts, searchProducts } from "../actions/product";
import { createProductsBatchSchema } from "@/lib/validations/product";
import { prefixLockKey } from "@/lib/utils/product-code";
import { revalidatePath } from "next/cache";

// Mock the entire prisma module with inline factory
jest.mock("@/lib/prisma", () => {
  const mockFindMany = jest.fn();
  const mockProductCreate = jest.fn();
  const mockCreateManyAndReturn = jest.fn();
  const mockCategoryFindUnique = jest.fn();
  const mockCategoryFindMany = jest.fn();
  const mockBranchFindFirst = jest.fn();
  const mockInventoryCreateManyAndReturn = jest.fn();
  const mockMovementCreateMany = jest.fn();
  const mockExecuteRawUnsafe = jest.fn().mockResolvedValue(undefined);
  const mockTransaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      product: {
        findMany: mockFindMany,
        create: mockProductCreate,
        createManyAndReturn: mockCreateManyAndReturn,
      },
      branchInventory: { createManyAndReturn: mockInventoryCreateManyAndReturn },
      branchMovement: { createMany: mockMovementCreateMany },
      $executeRawUnsafe: mockExecuteRawUnsafe,
    };
    return callback(tx);
  });

  return {
    prisma: {
      $transaction: mockTransaction,
      $executeRawUnsafe: mockExecuteRawUnsafe,
      product: {
        create: mockProductCreate,
        findMany: mockFindMany,
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        createManyAndReturn: mockCreateManyAndReturn,
      },
      category: {
        findUnique: mockCategoryFindUnique,
        findMany: mockCategoryFindMany,
      },
      branch: { findFirst: mockBranchFindFirst },
      branchInventory: { createManyAndReturn: mockInventoryCreateManyAndReturn },
      branchMovement: { createMany: mockMovementCreateMany },
    },
  };
});

import { prisma } from "@/lib/prisma";

describe("createProduct Server Action - Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a product with valid data (prefix + price)", async () => {
    const mockProduct = {
      id: 1,
      name: "Jabón de Avena y Arroz",
      description: "Jabón artesanal exfoliante",
      price: 1500,
      code: "AA000",
      codePrefix: "AA",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Access mocks from the mocked module
    const { product } = prisma;
    (product.findMany as jest.Mock).mockResolvedValue([]);
    (product.create as jest.Mock).mockResolvedValue(mockProduct);

    const result = await createProduct({
      name: "Jabón de Avena y Arroz",
      description: "Jabón artesanal exfoliante",
      stock: 50,
      prefix: "AA",
      price: 1500,
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Jabón de Avena y Arroz");
    expect(result.data?.code).toBe("AA000");
    expect(result.data?.codePrefix).toBe("AA");
    expect(result.data?.price).toBe(1500);
  });

  it("should create a product with only required fields (prefix + price)", async () => {
    const mockProduct = {
      id: 2,
      name: "Simple Product",
      description: "-",
      price: 100,
      code: "SP000",
      codePrefix: "SP",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { product } = prisma;
    (product.findMany as jest.Mock).mockResolvedValue([]);
    (product.create as jest.Mock).mockResolvedValue(mockProduct);

    const result = await createProduct({
      name: "Simple Product",
      prefix: "SP",
      price: 100,
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Simple Product");
    expect(result.data?.code).toBe("SP000");
    expect(result.data?.price).toBe(100);
  });

  it("persists the chosen category when creating a product (H2)", async () => {
    const { product } = prisma;
    (product.findMany as jest.Mock).mockResolvedValue([]);
    (product.create as jest.Mock).mockResolvedValue({ id: 3, name: "Con categoría", code: "CC000" });

    const result = await createProduct({
      name: "Con categoría",
      prefix: "CC",
      price: 100,
      categoryId: 7,
    });

    expect(result.success).toBe(true);
    expect(product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ categoryId: 7 }) })
    );
  });

  it("persists a null category when none is chosen", async () => {
    const { product } = prisma;
    (product.findMany as jest.Mock).mockResolvedValue([]);
    (product.create as jest.Mock).mockResolvedValue({ id: 4, name: "Sin categoría", code: "SC000" });

    const result = await createProduct({
      name: "Sin categoría",
      prefix: "SC",
      price: 100,
    });

    expect(result.success).toBe(true);
    expect(product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ categoryId: null }) })
    );
  });

  it("should return error when name is empty", async () => {
    const result = await createProduct({
      name: "",
      prefix: "AA",
      price: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("nombre");
  });

  it("should return error when prefix is invalid", async () => {
    const result = await createProduct({
      name: "Test Product",
      prefix: "A", // too short
      price: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Prefijo");
  });

  it("should return error when price is negative", async () => {
    const result = await createProduct({
      name: "Test Product",
      prefix: "AA",
      price: -10,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("negativo");
  });

  it("should handle database errors gracefully", async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error("Database error"));

    const result = await createProduct({
      name: "Test Product",
      prefix: "AA",
      price: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Error al crear el producto");
  });

  it("avisa cuando la categoría elegida ya no existe", async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("Foreign key constraint failed"), { code: "P2003" }),
    );

    const result = await createProduct({
      name: "Test Product",
      prefix: "AA",
      price: 100,
      categoryId: 7,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("La categoría seleccionada no existe");
  });
});

describe("getProducts Server Action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return all products ordered by creation date", async () => {
    const mockProductsFromDb = [
      {
        id: 1,
        name: "Product 1",
        description: "Description 1",
        stock: 10,
        price: 100,
        code: "PR000",
        codePrefix: "PR",
        createdAt: new Date("2026-04-16T17:19:02.304Z"),
        updatedAt: new Date("2026-04-16T17:19:02.304Z"),
      },
    ];

    const { product } = prisma;
    (product.findMany as jest.Mock).mockResolvedValue(mockProductsFromDb);

    const result = await getProducts();

    expect(result.success).toBe(true);
    expect(result.data?.[0]?.name).toBe("Product 1");
    expect(result.data?.[0]?.createdAt).toBe("2026-04-16T17:19:02.304Z");
    expect(result.data?.[0]?.code).toBe("PR000");
    expect(result.data?.[0]?.price).toBe(100);
  });

  it("should return empty array when no products exist", async () => {
    const { product } = prisma;
    (product.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getProducts();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it("excludes inactive products by default (where.active: true)", async () => {
    const { product } = prisma;
    (product.findMany as jest.Mock).mockResolvedValue([]);

    await getProducts();

    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      })
    );
  });
});

describe("searchProducts Server Action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return empty array for empty query (no DB call)", async () => {
    const { product } = prisma;

    const result = await searchProducts({ query: "" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(product.findMany).not.toHaveBeenCalled();

    const result2 = await searchProducts({ query: "   " });
    expect(result2.success).toBe(true);
    expect(result2.data).toEqual([]);
    expect(product.findMany).not.toHaveBeenCalled();
  });

  it("should return empty array for undefined query", async () => {
    const { product } = prisma;

    const result = await searchProducts({ query: undefined });
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(product.findMany).not.toHaveBeenCalled();
  });

  it("should search by code prefix (ILIKE)", async () => {
    const { product } = prisma;
    const mockProducts = [
      { id: 1, code: "AA001", name: "Producto A", price: 100, inventory: [{ stock: 10, branchId: 1 }] },
      { id: 2, code: "AAB001", name: "Producto B", price: 200, inventory: [{ stock: 5, branchId: 1 }] },
    ];
    (product.findMany as jest.Mock).mockResolvedValue(mockProducts);

    const result = await searchProducts({ query: "AA" });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0]?.code).toBe("AA001");
    expect(result.data?.[1]?.code).toBe("AAB001");
    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ code: expect.objectContaining({ contains: "AA", mode: "insensitive" }) }),
            expect.objectContaining({ name: expect.objectContaining({ contains: "AA", mode: "insensitive" }) }),
          ]),
        }),
        select: expect.objectContaining({
          id: true,
          code: true,
          name: true,
          price: true,
          inventory: expect.objectContaining({
            select: expect.objectContaining({ stock: true, branchId: true }),
          }),
        }),
        take: 20,
      })
    );
  });

  it("should search by name fragment (ILIKE)", async () => {
    const { product } = prisma;
    const mockProducts = [
      { id: 1, code: "PR001", name: "Jabón de Avena", price: 100, inventory: [{ stock: 10, branchId: 1 }] },
      { id: 2, code: "PR002", name: "Jabón de Glicerina", price: 150, inventory: [{ stock: 5, branchId: 1 }] },
    ];
    (product.findMany as jest.Mock).mockResolvedValue(mockProducts);

    const result = await searchProducts({ query: "Jabón" });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0]?.name).toBe("Jabón de Avena");
    expect(result.data?.[1]?.name).toBe("Jabón de Glicerina");
  });

  it("should limit results to 20 (take: 20)", async () => {
    const { product } = prisma;
    // Create 25 mock products
    const mockProducts = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      code: `PR${String(i).padStart(3, "0")}`,
      name: `Product ${i}`,
      price: 100,
      inventory: [{ stock: 10, branchId: 1 }],
    }));
    (product.findMany as jest.Mock).mockResolvedValue(mockProducts.slice(0, 20)); // DB returns max 20 due to take

    const result = await searchProducts({ query: "P" });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(20);
    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });

  it("should return only projected fields (id, code, name, price, stock)", async () => {
    const { product } = prisma;
    // Mock returns only the selected fields (as real Prisma would with select)
    const mockProducts = [
      { id: 1, code: "AA001", name: "Test", price: 100, inventory: [{ stock: 5, branchId: 1 }] },
    ];
    (product.findMany as jest.Mock).mockResolvedValue(mockProducts);

    const result = await searchProducts({ query: "AA" });

    expect(result.success).toBe(true);
    expect(result.data?.[0]).toEqual(
      expect.objectContaining({
        id: 1,
        code: "AA001",
        name: "Test",
        price: 100,
        stock: 5,
      })
    );
    // Verify select was used (no description, no codePrefix in result)
    expect(result.data?.[0]).not.toHaveProperty("description");
    expect(result.data?.[0]).not.toHaveProperty("codePrefix");
  });
});
// AGENTS.md §0.2: sesión + rol admin antes de validar y antes de Prisma.
describe("productos: autorización admin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rechaza createProduct sin sesión admin y no toca Prisma", async () => {
    const { requireAdmin } = jest.requireMock<{ requireAdmin: jest.Mock }>(
      "@/lib/auth-guard"
    );
    requireAdmin.mockResolvedValueOnce({ ok: false, error: "No autorizado" });

    // Prefijo inválido: si el guardián no fuera primero, el error sería de Zod.
    const result = await createProduct({
      name: "Test",
      prefix: "X",
      price: 100,
    });

    expect(result).toEqual({ success: false, error: "No autorizado" });
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(prisma.product.create).not.toHaveBeenCalled();
  });
});

// Alta masiva (ODD `productos-alta-masiva`, T2): contrato del lote y autorización.
describe("createProductsBatch", () => {
  beforeEach(() => jest.clearAllMocks());

  const fila = (n: number) => ({ name: `Producto ${n}`, prefix: "ZZ", price: 10 });

  it("el esquema acepta 1 y 50 filas y rechaza 0 y 51", () => {
    expect(createProductsBatchSchema.safeParse({ rows: [fila(1)] }).success).toBe(true);
    expect(
      createProductsBatchSchema.safeParse({ rows: Array.from({ length: 50 }, (_, i) => fila(i)) }).success
    ).toBe(true);

    const vacio = createProductsBatchSchema.safeParse({ rows: [] });
    expect(vacio.success).toBe(false);
    expect(vacio.success === false && vacio.error.issues[0]?.message).toBe("Agregá al menos un producto");

    const lleno = createProductsBatchSchema.safeParse({ rows: Array.from({ length: 51 }, (_, i) => fila(i)) });
    expect(lleno.success).toBe(false);
    expect(lleno.success === false && lleno.error.issues[0]?.message).toBe("Máximo 50 productos por carga");
  });

  // S4: la categoría es de cada fila, no del lote. Una fila sin categoría es válida.
  it("la categoría va por fila y es opcional", () => {
    const parsed = createProductsBatchSchema.safeParse({
      rows: [
        { name: "Producto A", prefix: "ZZ", price: 10, categoryId: 5 },
        { name: "Producto B", prefix: "ZZ", price: 10 },
        { name: "Producto C", prefix: "ZZ", price: 10, categoryId: null },
      ],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.rows.map((row) => row.categoryId)).toEqual([5, undefined, null]);

    const invalida = createProductsBatchSchema.safeParse({
      rows: [{ name: "Producto A", prefix: "ZZ", price: 10, categoryId: 0 }],
    });
    expect(invalida.success).toBe(false);
    if (invalida.success) return;
    expect(invalida.error.issues[0]?.message).toBe("Categoría inválida");
    expect(invalida.error.issues[0]?.path).toEqual(["rows", 0, "categoryId"]);
  });

  it("el error de una fila lleva su índice en el path", () => {
    const parsed = createProductsBatchSchema.safeParse({
      rows: [fila(1), { name: "", prefix: "ZZ", price: 10 }],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.map((i) => i.path)).toContainEqual(["rows", 1, "name"]);
  });

  it("el nombre repetido dentro del lote se marca en la fila repetida", () => {
    const parsed = createProductsBatchSchema.safeParse({
      rows: [
        { name: "Jabón de Avena", prefix: "ZZ", price: 10 },
        { name: "jabón de avena", prefix: "ZZ", price: 20 },
      ],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(["rows", 1, "name"]);
  });

  it("rechaza sin sesión admin y no toca Prisma", async () => {
    const { requireAdmin } = jest.requireMock<{ requireAdmin: jest.Mock }>("@/lib/auth-guard");
    requireAdmin.mockResolvedValueOnce({ ok: false, error: "No autorizado" });

    // Fila inválida a propósito: si el guardián no fuera primero, el error sería de Zod.
    const result = await createProductsBatch({ rows: [{ name: "", prefix: "Z", price: -1 }] });

    expect(result).toEqual({ success: false, error: "No autorizado" });
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(prisma.product.createManyAndReturn).not.toHaveBeenCalled();
  });

  it("un error de Zod devuelve rowErrors de todas las filas inválidas y no toca Prisma", async () => {
    const result = await createProductsBatch({
      rows: [
        { name: "", prefix: "ZZ", price: 10 },
        { name: "Producto bueno", prefix: "ZZ", price: 10 },
        { name: "Producto malo", prefix: "1", price: -5 },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const filas = Array.from(new Set((result.rowErrors ?? []).map((e) => e.row)));
    expect(filas).toEqual([0, 2]);
    expect((result.rowErrors ?? []).every((e) => typeof e.field === "string")).toBe(true);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it("devuelve los productos en el orden de las filas, cruzando por código", async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    // `createManyAndReturn` no promete orden: la respuesta se arma cruzando por código.
    (prisma.product.createManyAndReturn as jest.Mock).mockResolvedValue([
      { id: 3, code: "ZZ001", name: "Producto C" },
      { id: 1, code: "ZZ000", name: "Producto A" },
    ]);

    const result = await createProductsBatch({
      rows: [
        { name: "Producto A", prefix: "ZZ", price: 10 },
        { name: "Producto C", prefix: "ZZ", price: 20 },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.products).toEqual([
      { id: 1, code: "ZZ000", name: "Producto A" },
      { id: 3, code: "ZZ001", name: "Producto C" },
    ]);
  });

  it("revalida /inventario y /productos al crear y no revalida nada si falla", async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.product.createManyAndReturn as jest.Mock).mockResolvedValue([
      { id: 1, code: "ZZ000", name: "Producto A" },
    ]);

    const exito = await createProductsBatch({ rows: [{ name: "Producto A", prefix: "ZZ", price: 10 }] });

    expect(exito.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/inventario");
    expect(revalidatePath).toHaveBeenCalledWith("/productos");

    (revalidatePath as jest.Mock).mockClear();
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error("Database error"));
    const fallo = await createProductsBatch({ rows: [{ name: "Producto B", prefix: "ZZ", price: 10 }] });
    consoleError.mockRestore();

    expect(fallo).toEqual({ success: false, error: "Error al crear los productos" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // Cubre el mapeo de la rama P2003, no la carrera de FK que la dispara en producción.
  it("un P2003 del insert vuelve como categoría inexistente", async () => {
    (prisma.category.findMany as jest.Mock).mockResolvedValue([{ id: 5 }]);
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.product.createManyAndReturn as jest.Mock).mockRejectedValueOnce({ code: "P2003" });

    const result = await createProductsBatch({
      rows: [{ name: "Producto A", prefix: "ZZ", price: 10, categoryId: 5 }],
    });

    expect(result).toEqual({ success: false, error: "La categoría seleccionada no existe" });
  });

  it("verifica las categorías distintas en una sola consulta y escribe la de cada fila", async () => {
    (prisma.category.findMany as jest.Mock).mockResolvedValue([{ id: 5 }, { id: 7 }]);
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.product.createManyAndReturn as jest.Mock).mockResolvedValue([
      { id: 1, code: "ZZ000", name: "Producto A" },
      { id: 2, code: "ZZ001", name: "Producto B" },
      { id: 3, code: "ZZ002", name: "Producto C" },
    ]);

    const result = await createProductsBatch({
      rows: [
        { name: "Producto A", prefix: "ZZ", price: 10, categoryId: 5 },
        { name: "Producto B", prefix: "ZZ", price: 10, categoryId: 7 },
        { name: "Producto C", prefix: "ZZ", price: 10 },
      ],
    });

    expect(result.success).toBe(true);
    // Una sola consulta, con los ids distintos y sin repetir.
    expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { id: { in: [5, 7] } },
      select: { id: true },
    });
    // Cada fila se inserta con la suya; la que no tiene queda en null.
    const data = (prisma.product.createManyAndReturn as jest.Mock).mock.calls[0][0].data;
    expect(data.map((row: { categoryId: number | null }) => row.categoryId)).toEqual([5, 7, null]);
  });

  it("una categoría inexistente falla el lote entero y marca solo sus filas", async () => {
    (prisma.category.findMany as jest.Mock).mockResolvedValue([{ id: 5 }]);

    const result = await createProductsBatch({
      rows: [
        { name: "Producto A", prefix: "ZZ", price: 10, categoryId: 5 },
        { name: "Producto B", prefix: "ZZ", price: 10 },
        { name: "Producto C", prefix: "ZZ", price: 10, categoryId: 999 },
      ],
    });

    expect(result).toEqual({
      success: false,
      error: "La categoría seleccionada no existe",
      rowErrors: [{ row: 2, field: "categoryId", message: "La categoría seleccionada no existe" }],
    });
    expect(prisma.product.createManyAndReturn).not.toHaveBeenCalled();
  });
});

// Alta masiva con stock inicial (ODD `productos-alta-masiva`, T5; S2 y S11):
// inventario para todas las filas, movimiento y comprobante solo para las que
// tienen stock, y sucursal opcional mientras la UI no la mande (D8).
describe("createProductsBatch: stock inicial y comprobante", () => {
  beforeEach(() => jest.clearAllMocks());

  const fila = (n: number, initialStock?: number) => ({
    name: `Producto ${n}`,
    prefix: "ZZ",
    price: n * 10,
    ...(initialStock === undefined ? {} : { initialStock }),
  });

  it("el stock inicial es un entero >= 0 opcional y la sucursal del lote es opcional", () => {
    const ok = createProductsBatchSchema.safeParse({
      branchId: 3,
      rows: [fila(1, 0), fila(2, 12), fila(3)],
    });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.branchId).toBe(3);
    // Sin valor, el stock no viaja: la acción lo trata como 0.
    expect(ok.data.rows.map((row) => row.initialStock)).toEqual([0, 12, undefined]);

    // Sin sucursal sigue siendo válido: la UI todavía no la manda.
    expect(createProductsBatchSchema.safeParse({ rows: [fila(1)] }).success).toBe(true);

    const negativo = createProductsBatchSchema.safeParse({ rows: [fila(1, -1)] });
    expect(negativo.success).toBe(false);
    if (negativo.success) return;
    expect(negativo.error.issues[0]?.message).toBe("El stock no puede ser negativo");
    expect(negativo.error.issues[0]?.path).toEqual(["rows", 0, "initialStock"]);

    expect(createProductsBatchSchema.safeParse({ rows: [fila(1, 1.5)] }).success).toBe(false);

    for (const branchId of [0, -3]) {
      const sucursal = createProductsBatchSchema.safeParse({ branchId, rows: [fila(1)] });
      expect(sucursal.success).toBe(false);
      if (sucursal.success) return;
      expect(sucursal.error.issues[0]?.message).toBe("Sucursal inválida");
      expect(sucursal.error.issues[0]?.path).toEqual(["branchId"]);
    }
  });

  it("sin sucursal devuelve receipt null y no toca inventario ni movimientos", async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.product.createManyAndReturn as jest.Mock).mockResolvedValue([
      { id: 1, code: "ZZ000", name: "Producto 1", price: 10 },
    ]);

    const result = await createProductsBatch({ rows: [fila(1, 3)] });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.receipt).toBeNull();
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
    expect(prisma.branchInventory.createManyAndReturn).not.toHaveBeenCalled();
    expect(prisma.branchMovement.createMany).not.toHaveBeenCalled();
  });

  it("una sucursal inactiva o inexistente falla antes de la transacción y no escribe nada", async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await createProductsBatch({ branchId: 7, rows: [fila(1, 1)] });

    expect(result).toEqual({ success: false, error: "Sucursal inválida o inactiva" });
    // Una sola consulta, y trae el `code` que necesita el comprobante.
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: 7, isActive: true },
      select: { id: true, name: true, code: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.product.createManyAndReturn).not.toHaveBeenCalled();
  });

  it("deja inventario de todas las filas y movimiento y comprobante solo de las que tienen stock", async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 7, name: "Centro", code: "CE" });
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    // Devueltos al revés a propósito: todo se cruza por código o por id, nunca por posición.
    (prisma.product.createManyAndReturn as jest.Mock).mockResolvedValue([
      { id: 3, code: "ZZ002", name: "Producto 3", price: 30 },
      { id: 1, code: "ZZ000", name: "Producto 1", price: 10 },
      { id: 2, code: "ZZ001", name: "Producto 2", price: 20 },
    ]);
    (prisma.branchInventory.createManyAndReturn as jest.Mock).mockResolvedValue([
      { productId: 2, stock: 0 },
      { productId: 3, stock: 12 },
      { productId: 1, stock: 5 },
    ]);

    const result = await createProductsBatch({
      branchId: 7,
      rows: [fila(1, 5), fila(2), fila(3, 12)],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.products.map((p) => p.id)).toEqual([1, 2, 3]);

    // Inventario: las tres filas, incluida la de stock 0 (S11/H1).
    const inventario = (prisma.branchInventory.createManyAndReturn as jest.Mock).mock.calls[0][0].data;
    expect(inventario).toEqual([
      { branchId: 7, productId: 1, stock: 5 },
      { branchId: 7, productId: 2, stock: 0 },
      { branchId: 7, productId: 3, stock: 12 },
    ]);

    // Movimiento: solo las de stock > 0, con el motivo y el admin de la sesión.
    const movimientos = (prisma.branchMovement.createMany as jest.Mock).mock.calls[0][0].data;
    expect(movimientos).toEqual([
      {
        productId: 1,
        branchId: 7,
        movementType: "ENTRY",
        quantity: 5,
        reference: "ALTA DE PRODUCTOS",
        performedBy: "test@feria.test",
      },
      {
        productId: 3,
        branchId: 7,
        movementType: "ENTRY",
        quantity: 12,
        reference: "ALTA DE PRODUCTOS",
        performedBy: "test@feria.test",
      },
    ]);

    // Comprobante: cabecera del lote y solo las filas con stock, con el saldo devuelto.
    expect(result.data.receipt).toEqual({
      movementType: "ENTRY",
      branchId: 7,
      branchName: "Centro",
      branchCode: "CE",
      reference: "ALTA DE PRODUCTOS",
      date: expect.any(String),
      rows: [
        { productId: 1, code: "ZZ000", name: "Producto 1", price: 10, quantity: 5, stock: 5 },
        { productId: 3, code: "ZZ002", name: "Producto 3", price: 30, quantity: 12, stock: 12 },
      ],
    });
    // El historial de movimientos cambió: se revalida junto con el resto.
    expect(revalidatePath).toHaveBeenCalledWith("/movimientos");
  });

  it("con sucursal y ninguna fila con stock no hay movimiento ni comprobante", async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 7, name: "Centro", code: "CE" });
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.product.createManyAndReturn as jest.Mock).mockResolvedValue([
      { id: 1, code: "ZZ000", name: "Producto 1", price: 10 },
    ]);
    (prisma.branchInventory.createManyAndReturn as jest.Mock).mockResolvedValue([
      { productId: 1, stock: 0 },
    ]);

    const result = await createProductsBatch({ branchId: 7, rows: [fila(1)] });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.receipt).toBeNull();
    expect(prisma.branchInventory.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(prisma.branchMovement.createMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalledWith("/movimientos");
  });

  it("sin email del admin el movimiento queda con un responsable explícito", async () => {
    const { requireAdmin } = jest.requireMock<{ requireAdmin: jest.Mock }>("@/lib/auth-guard");
    requireAdmin.mockResolvedValueOnce({ ok: true, email: "" });
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 7, name: "Centro", code: "CE" });
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.product.createManyAndReturn as jest.Mock).mockResolvedValue([
      { id: 1, code: "ZZ000", name: "Producto 1", price: 10 },
    ]);
    (prisma.branchInventory.createManyAndReturn as jest.Mock).mockResolvedValue([
      { productId: 1, stock: 4 },
    ]);

    const result = await createProductsBatch({ branchId: 7, rows: [fila(1, 4)] });

    expect(result.success).toBe(true);
    const movimientos = (prisma.branchMovement.createMany as jest.Mock).mock.calls[0][0].data;
    expect(movimientos[0].performedBy).toBe("sistema");
  });
});

// El alta individual y el lote tienen que tomar el MISMO advisory lock por prefijo:
// si la clave difiere, ninguna prueba secuencial nota que dejaron de excluirse.
describe("clave del advisory lock", () => {
  beforeEach(() => jest.clearAllMocks());

  it("createProduct y createProductsBatch toman la misma clave con el prefijo en distinta capitalización", async () => {
    // Si la clave se calculara sobre el prefijo crudo, "ab" y "AB" no se excluirían.
    expect(prefixLockKey("ab")).not.toBe(prefixLockKey("AB"));
    const esperado = `SELECT pg_advisory_xact_lock(${prefixLockKey("AB")})`;

    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.product.create as jest.Mock).mockResolvedValue({
      id: 1,
      name: "Individual",
      description: "-",
      price: 1,
      code: "AB000",
      codePrefix: "AB",
    });
    await createProduct({ name: "Individual", prefix: "ab", price: 1 });

    const sqlIndividual = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(sqlIndividual).toEqual([esperado]);

    (prisma.$executeRawUnsafe as jest.Mock).mockClear();
    (prisma.product.createManyAndReturn as jest.Mock).mockResolvedValue([
      { id: 2, code: "AB000", name: "Lote" },
    ]);
    const lote = await createProductsBatch({ rows: [{ name: "Lote", prefix: "Ab", price: 1 }] });

    expect(lote.success).toBe(true);
    const sqlLote = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(sqlLote).toEqual(sqlIndividual);
  });
});
