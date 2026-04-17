"use server";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { z } from "zod";

// Schema de validación para crear producto
const createProductSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255, "El nombre es muy largo"),
  description: z.string().max(500, "La descripción es muy larga").optional(),
  stock: z.number().int().min(0, "El stock no puede ser negativo").default(0),
});

// Schema para actualizar producto
const updateProductSchema = z.object({
  id: z.number().int().positive("ID inválido"),
  name: z.string().min(1, "El nombre es requerido").max(255, "El nombre es muy largo").optional(),
  description: z.string().max(500, "La descripción es muy larga").optional().nullable(),
  stock: z.number().int().min(0, "El stock no puede ser negativo").optional(),
});

// Schema para eliminar producto
const deleteProductSchema = z.object({
  id: z.number().int().positive("ID inválido"),
});

export async function createProduct(data: unknown) {
  try {
    const validatedData = createProductSchema.parse(data);

    const product = await prisma.product.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
        stock: validatedData.stock,
      },
    });

    return { success: true, data: product };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error creating product:", error);
    return { success: false, error: "Error al crear el producto" };
  }
}

export async function getProducts() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: parseArray(products) };
  } catch (error) {
    console.error("Error fetching products:", error);
    return { success: false, error: "Error al obtener los productos" };
  }
}

export async function getProductById(id: number) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
    });
    if (!product) {
      return { success: false, error: "Producto no encontrado" };
    }
    return { success: true, data: parseObject(product) };
  } catch (error) {
    console.error("Error fetching product:", error);
    return { success: false, error: "Error al obtener el producto" };
  }
}

export async function updateProduct(data: unknown) {
  try {
    const validatedData = updateProductSchema.parse(data);

    const product = await prisma.product.update({
      where: { id: validatedData.id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.stock !== undefined && { stock: validatedData.stock }),
      },
    });

    return { success: true, data: product };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error updating product:", error);
    return { success: false, error: "Error al actualizar el producto" };
  }
}

export async function deleteProduct(data: unknown) {
  try {
    const validatedData = deleteProductSchema.parse(data);

    await prisma.product.delete({
      where: { id: validatedData.id },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error deleting product:", error);
    return { success: false, error: "Error al eliminar el producto" };
  }
}