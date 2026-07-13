/**
 * Integration test for createProduct Server Action
 */
import { createProduct, getProducts, searchProducts } from "../actions/product";

// Mock the entire prisma module with inline factory
jest.mock("@/lib/prisma", () => {
  const mockFindMany = jest.fn();
  const mockProductCreate = jest.fn();
  const mockExecuteRawUnsafe = jest.fn().mockResolvedValue(undefined);
  const mockTransaction = jest.fn(async (callback: (tx: any) => Promise<any>) => {
    const tx = {
      product: {
        findMany: mockFindMany,
        create: mockProductCreate,
      },
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
      },
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
      stock: 50,
      price: 1500,
      code: "AA000",
      codePrefix: "AA",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Access mocks from the mocked module
    const { product } = prisma;
    product.findMany.mockResolvedValue([]);
    product.create.mockResolvedValue(mockProduct);

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
      stock: 0,
      price: 100,
      code: "SP000",
      codePrefix: "SP",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { product } = prisma;
    product.findMany.mockResolvedValue([]);
    product.create.mockResolvedValue(mockProduct);

    const result = await createProduct({
      name: "Simple Product",
      prefix: "SP",
      price: 100,
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Simple Product");
    expect(result.data?.stock).toBe(0);
    expect(result.data?.code).toBe("SP000");
    expect(result.data?.price).toBe(100);
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

  it("should return error when stock is negative", async () => {
    const result = await createProduct({
      name: "Test Product",
      prefix: "AA",
      price: 100,
      stock: -5,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("negativo");
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
    const { prisma: mockPrisma } = require("@/lib/prisma");
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("Database error"));

    const result = await createProduct({
      name: "Test Product",
      prefix: "AA",
      price: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Error al crear el producto");
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
    product.findMany.mockResolvedValue(mockProductsFromDb);

    const result = await getProducts();

    expect(result.success).toBe(true);
    expect(result.data?.[0]?.name).toBe("Product 1");
    expect(result.data?.[0]?.createdAt).toBe("2026-04-16T17:19:02.304Z");
    expect(result.data?.[0]?.code).toBe("PR000");
    expect(result.data?.[0]?.price).toBe(100);
  });

  it("should return empty array when no products exist", async () => {
    const { product } = prisma;
    product.findMany.mockResolvedValue([]);

    const result = await getProducts();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
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
      { id: 1, code: "AA001", name: "Producto A", price: 100, stock: 10 },
      { id: 2, code: "AAB001", name: "Producto B", price: 200, stock: 5 },
    ];
    product.findMany.mockResolvedValue(mockProducts);

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
        select: expect.objectContaining({ id: true, code: true, name: true, price: true, stock: true }),
        take: 20,
      })
    );
  });

  it("should search by name fragment (ILIKE)", async () => {
    const { product } = prisma;
    const mockProducts = [
      { id: 1, code: "PR001", name: "Jabón de Avena", price: 100, stock: 10 },
      { id: 2, code: "PR002", name: "Jabón de Glicerina", price: 150, stock: 5 },
    ];
    product.findMany.mockResolvedValue(mockProducts);

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
      stock: 10,
    }));
    product.findMany.mockResolvedValue(mockProducts.slice(0, 20)); // DB returns max 20 due to take

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
      { id: 1, code: "AA001", name: "Test", price: 100, stock: 5 },
    ];
    product.findMany.mockResolvedValue(mockProducts);

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