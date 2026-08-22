// src/app/actions/category.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
} from '@/lib/validations/category';

/**
 * isPrismaError helper — distinguish Prisma P2002 (unique constraint) from other errors.
 * Prisma client errors expose a `code` property (e.g. P2002, P2003, P2025).
 */
function isPrismaError(err: unknown, code: string): boolean {
  return (
    err instanceof Object &&
    'code' in err &&
    (err as { code: unknown }).code === code
  );
}

/**
 * createCategory — Zod-validated; rejects empty/oversized name.
 * P2002 (name @unique) → friendly Spanish message.
 */
export async function createCategory(data: { name: string }) {
  try {
    const { name } = createCategorySchema.parse(data);

    const category = await prisma.category.create({
      data: { name },
    });

    revalidatePath('/categorias');
    revalidatePath("/inventario");
    return { success: true as const, data: category };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.issues.map((e) => e.message).join(', '),
      };
    }
    if (isPrismaError(error, 'P2002')) {
      return {
        success: false as const,
        error: 'Ya existe una categoría con ese nombre',
      };
    }
    console.error('Error creating category:', error);
    return { success: false as const, error: 'Error al crear la categoría' };
  }
}

/**
 * getCategories — returns all categories ordered by name asc, with
 * `_count.products` per category (used by the list page).
 */
export async function getCategories() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return { success: true as const, data: categories };
  } catch (error) {
    console.error('Error fetching categories:', error);
    return { success: false as const, error: 'Error al obtener las categorías' };
  }
}

/**
 * getCategoryById — returns one category with `_count.products`.
 */
export async function getCategoryById(id: number) {
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) {
      return { success: false as const, error: 'Categoría no encontrada' };
    }
    return { success: true as const, data: category };
  } catch (error) {
    console.error('Error fetching category:', error);
    return { success: false as const, error: 'Error al obtener la categoría' };
  }
}

/**
 * updateCategory — Zod-validated; P2002 → friendly message.
 * Note: the schema allows updating name even when the category has products,
 * because renaming does not change the product→category link integrity.
 */
export async function updateCategory(data: { id: number; name?: string }) {
  try {
    const validatedData = updateCategorySchema.parse(data);

    const category = await prisma.category.update({
      where: { id: validatedData.id },
      data: { name: validatedData.name },
      select: { id: true, name: true },
    });

    revalidatePath('/categorias');
    revalidatePath(`/categorias/${validatedData.id}`);
    return { success: true as const, data: category };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.issues.map((e) => e.message).join(', '),
      };
    }
    if (isPrismaError(error, 'P2002')) {
      return {
        success: false as const,
        error: 'Ya existe una categoría con ese nombre',
      };
    }
    if (isPrismaError(error, 'P2025')) {
      return {
        success: false as const,
        error: 'Categoría no encontrada',
      };
    }
    console.error('Error updating category:', error);
    return { success: false as const, error: 'Error al actualizar la categoría' };
  }
}

/**
 * deleteCategory — Zod-validated (object signature `{ id }` per test contract).
 * Blocks deletion when the category has products assigned (HAS_DEPENDENT_DATA),
 * returning an error that includes the product count and "Reasigna primero".
 */
export async function deleteCategory(data: { id: number }) {
  try {
    const { id } = deleteCategorySchema.parse(data);

    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      return {
        success: false as const,
        error: `La categoría tiene ${productCount} producto(s) asociado(s). Reasigna primero los productos a otra categoría antes de eliminar.`,
      };
    }

    await prisma.category.delete({ where: { id } });

    revalidatePath('/categorias');
    return { success: true as const };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.issues.map((e) => e.message).join(', '),
      };
    }
    if (isPrismaError(error, 'P2025')) {
      return { success: false as const, error: 'Categoría no encontrada' };
    }
    console.error('Error deleting category:', error);
    return { success: false as const, error: 'Error al eliminar la categoría' };
  }
}

/**
 * getCategoryOptions — returns minimal id+name projection for dropdowns/selectors.
 */
export async function getCategoryOptions() {
  try {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return { success: true as const, data: categories };
  } catch (error) {
    console.error('Error fetching category options:', error);
    return {
      success: false as const,
      error: 'Error al obtener opciones de categoría',
    };
  }
}
