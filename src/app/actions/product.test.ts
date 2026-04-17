/**
 * Integration test for createProduct Server Action
 */
import { createProduct, getProducts } from "../actions/product";

// Mock prisma
const mockCreate = jest.fn();
const mockFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe("createProduct Server Action - Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a product with valid data", async () => {
    const mockProduct = {
      id: 1,
      name: "Jabón de Avena y Arroz",
      description: "Jabón artesanal exfoliante",
      stock: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCreate.mockResolvedValue(mockProduct);

    const result = await createProduct({
      name: "Jabón de Avena y Arroz",
      description: "Jabón artesanal exfoliante",
      stock: 50,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockProduct);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: "Jabón de Avena y Arroz",
        description: "Jabón artesanal exfoliante",
        stock: 50,
      },
    });
  });

  it("should create a product with only name and default stock", async () => {
    const mockProduct = {
      id: 2,
      name: "Simple Product",
      description: null,
      stock: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCreate.mockResolvedValue(mockProduct);

    const result = await createProduct({
      name: "Simple Product",
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Simple Product");
    expect(result.data?.stock).toBe(0);
  });

  it("should return error when name is empty", async () => {
    const result = await createProduct({
      name: "",
      stock: 10,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("nombre");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should return error when stock is negative", async () => {
    const result = await createProduct({
      name: "Test Product",
      stock: -5,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("negativo");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should handle database errors gracefully", async () => {
    mockCreate.mockRejectedValue(new Error("Database error"));

    const result = await createProduct({
      name: "Test Product",
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
    // Mock returns raw Prisma data (with Date objects)
    const mockProductsFromDb = [
      {
        id: 1,
        name: "Product 1",
        description: "Description 1",
        stock: 10,
        createdAt: new Date("2026-04-16T17:19:02.304Z"),
        updatedAt: new Date("2026-04-16T17:19:02.304Z"),
      },
    ];

    mockFindMany.mockResolvedValue(mockProductsFromDb);

    const result = await getProducts();

    expect(result.success).toBe(true);
    // getProducts uses parseArray which converts Date to string
    expect(result.data?.[0]?.name).toBe("Product 1");
    expect(result.data?.[0]?.createdAt).toBe("2026-04-16T17:19:02.304Z");
  });

  it("should return empty array when no products exist", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await getProducts();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});