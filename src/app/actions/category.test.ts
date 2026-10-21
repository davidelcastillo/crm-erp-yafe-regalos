/**
 * Unit/Integration tests for Category Management (Fase 3)
 *
 * Covers:
 *   - createCategory (CRUD + unique name P2002 guard)
 *   - getCategories, getCategoryOptions, getCategoryById
 *   - updateCategory
 *   - deleteCategory ( bloquea si tiene productos asignados)
 *
 * Acceptance criteria sourced from:
 *   - openspec/changes/fase3-inventory-branch-interfaces/specs/category-management/spec.md
 */

import {
  createCategory,
  getCategories,
  getCategoryOptions,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "@/app/actions/category";
import { revalidatePath } from "next/cache";

const mockCategoryCreate = jest.fn();
const mockCategoryFindMany = jest.fn();
const mockCategoryFindUnique = jest.fn();
const mockCategoryUpdate = jest.fn();
const mockCategoryDelete = jest.fn();
const mockProductCount = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      create: (...args: unknown[]) => mockCategoryCreate(...args),
      findMany: (...args: unknown[]) => mockCategoryFindMany(...args),
      findUnique: (...args: unknown[]) => mockCategoryFindUnique(...args),
      update: (...args: unknown[]) => mockCategoryUpdate(...args),
      delete: (...args: unknown[]) => mockCategoryDelete(...args),
    },
    product: {
      count: (...args: unknown[]) => mockProductCount(...args),
    },
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const mockRevalidatePath = revalidatePath as jest.Mock;

describe("createCategory (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates a category and returns its data", async () => {
    mockCategoryCreate.mockResolvedValue({ id: 1, name: "General" });

    const result = await createCategory({ name: "General" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1, name: "General" });
    expect(mockCategoryCreate).toHaveBeenCalledWith({ data: { name: "General" } });
  });

  it("revalidates /categorias and /inventario after a successful create", async () => {
    mockCategoryCreate.mockResolvedValue({ id: 1, name: "General" });

    await createCategory({ name: "General" });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/categorias");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/inventario");
  });

  it("rejects an empty name (Zod)", async () => {
    const result = await createCategory({ name: "" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("nombre");
    expect(mockCategoryCreate).not.toHaveBeenCalled();
  });

  it("returns P2002 unique-constraint message when name already exists", async () => {
    mockCategoryCreate.mockRejectedValue({ code: "P2002" });

    const result = await createCategory({ name: "Duplicado" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Ya existe");
    // P2002 must NOT trigger any revalidation
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("getCategories + getCategoryOptions (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("getCategories returns all categories with product counts", async () => {
    mockCategoryFindMany.mockResolvedValue([
      { id: 1, name: "A", _count: { products: 3 } },
      { id: 2, name: "B", _count: { products: 0 } },
    ]);

    const result = await getCategories();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(mockCategoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } },
      })
    );
  });

  it("getCategoryOptions returns only id+name for dropdowns", async () => {
    mockCategoryFindMany.mockResolvedValue([
      { id: 1, name: "General" },
      { id: 2, name: "Limpieza" },
    ]);

    const result = await getCategoryOptions();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      { id: 1, name: "General" },
      { id: 2, name: "Limpieza" },
    ]);
    expect(mockCategoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, name: true },
      })
    );
  });
});

describe("getCategoryById (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns a category with its count when found", async () => {
    mockCategoryFindUnique.mockResolvedValue({
      id: 1,
      name: "General",
      _count: { products: 5 },
    });

    const result = await getCategoryById(1);

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("General");
  });

  it("returns not-found error when category does not exist", async () => {
    mockCategoryFindUnique.mockResolvedValue(null);

    const result = await getCategoryById(999);

    expect(result.success).toBe(false);
    expect(result.error).toContain("no encontrada");
  });
});

describe("updateCategory (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates name and returns the updated category", async () => {
    mockCategoryUpdate.mockResolvedValue({ id: 1, name: "Nuevo" });

    const result = await updateCategory({ id: 1, name: "Nuevo" });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Nuevo");
    expect(mockCategoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { name: "Nuevo" },
      })
    );
  });

  it("returns P2002 message on duplicate name", async () => {
    mockCategoryUpdate.mockRejectedValue({ code: "P2002" });

    const result = await updateCategory({ id: 1, name: "Repetido" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Ya existe");
  });
});

describe("deleteCategory (Fase 3)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("blocks deletion when the category has products assigned (HAS_DEPENDENT_DATA)", async () => {
    mockProductCount.mockResolvedValue(4);

    const result = await deleteCategory({ id: 1 });

    expect(result.success).toBe(false);
    expect(result.error).toContain("4");
    expect(result.error).toContain("Reasigna primero");
    expect(mockCategoryDelete).not.toHaveBeenCalled();
  });

  it("deletes an empty category when no products use it", async () => {
    mockProductCount.mockResolvedValue(0);
    mockCategoryDelete.mockResolvedValue(undefined);

    const result = await deleteCategory({ id: 7 });

    expect(result.success).toBe(true);
    expect(mockCategoryDelete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it("rejects an invalid id (Zod)", async () => {
    const result = await deleteCategory({ id: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("ID");
  });
});

// AGENTS.md §0.2: sesión + rol admin antes de validar y antes de Prisma.
describe("categorías: autorización admin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rechaza createCategory sin sesión admin y no toca Prisma", async () => {
    const { requireAdmin } = jest.requireMock<{ requireAdmin: jest.Mock }>(
      "@/lib/auth-guard"
    );
    requireAdmin.mockResolvedValueOnce({ ok: false, error: "No autorizado" });

    // Nombre inválido: si el guardián no fuera primero, el error sería de Zod.
    const result = await createCategory({ name: "" });

    expect(result).toEqual({ success: false, error: "No autorizado" });
    expect(mockCategoryCreate).not.toHaveBeenCalled();
  });
});
