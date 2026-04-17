"use server";

import { prisma } from "@/lib/prisma";
import { parseArray, parseObject } from "@/lib/parse-prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Schema para crear cliente
const createCustomerSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255),
  surname: z.string().min(1, "El apellido es requerido").max(255),
});

// Schema para actualizar cliente
const updateCustomerSchema = z.object({
  id: z.number().int().positive("ID inválido"),
  name: z.string().min(1).max(255).optional(),
  surname: z.string().min(1).max(255).optional(),
});

// Schema para eliminar cliente
const deleteCustomerSchema = z.object({
  id: z.number().int().positive("ID inválido"),
});

// Schema para registrar pago (usa coerce para convertir strings a números)
const registerPaymentSchema = z.object({
  customerId: z.coerce.number().int().positive("Cliente inválido"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
});

export async function createCustomer(data: unknown) {
  try {
    const validatedData = createCustomerSchema.parse(data);

    const customer = await prisma.customer.create({
      data: {
        name: validatedData.name,
        surname: validatedData.surname,
        totalBalance: 0,
      },
    });

    return { success: true, data: parseObject(customer) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error creating customer:", error);
    return { success: false, error: "Error al crear el cliente" };
  }
}

export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: [{ surname: "asc" }, { name: "asc" }],
    });
    return { success: true, data: parseArray(customers) };
  } catch (error) {
    console.error("Error fetching customers:", error);
    return { success: false, error: "Error al obtener los clientes" };
  }
}

export async function getCustomerById(id: number) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          include: {
            items: {
              include: { product: true },
            },
          },
          orderBy: { date: "desc" },
        },
        payments: {
          orderBy: { date: "desc" },
        },
      },
    });

    if (!customer) {
      return { success: false, error: "Cliente no encontrado" };
    }

    return { success: true, data: parseObject(customer) };
  } catch (error) {
    console.error("Error fetching customer:", error);
    return { success: false, error: "Error al obtener el cliente" };
  }
}

export async function updateCustomer(data: unknown) {
  try {
    const validatedData = updateCustomerSchema.parse(data);

    const customer = await prisma.customer.update({
      where: { id: validatedData.id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.surname && { surname: validatedData.surname }),
      },
    });

    return { success: true, data: parseObject(customer) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error updating customer:", error);
    return { success: false, error: "Error al actualizar el cliente" };
  }
}

export async function deleteCustomer(data: unknown) {
  try {
    const validatedData = deleteCustomerSchema.parse(data);

    // Verificar que no tenga deuda antes de eliminar
    const customer = await prisma.customer.findUnique({
      where: { id: validatedData.id },
    });

    if (customer && Number(customer.totalBalance) > 0) {
      return {
        success: false,
        error: "No se puede eliminar un cliente con deuda pendiente",
      };
    }

    await prisma.customer.delete({
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
    console.error("Error deleting customer:", error);
    return { success: false, error: "Error al eliminar el cliente" };
  }
}

export async function registerPayment(data: unknown) {
  try {
    // Debug: log what we receive
    console.log("Monto recibido (raw):", data);
    
    const validatedData = registerPaymentSchema.parse(data);
    
    // Debug: log after Zod validation
    console.log("Monto validado:", validatedData.amount, "Tipo:", typeof validatedData.amount);
    
    // Explicit conversion for safety
    const amount = Number(validatedData.amount);
    console.log("Monto convertido a número:", amount);

    // Verificar que el cliente existe
    const customer = await prisma.customer.findUnique({
      where: { id: validatedData.customerId },
    });

    if (!customer) {
      return { success: false, error: "Cliente no encontrado" };
    }

    // Use Number() to compare Decimal with number
    const currentBalance = Number(customer.totalBalance);
    if (amount > currentBalance) {
      return {
        success: false,
        error: `El monto no puede ser mayor al saldo deudor ($${currentBalance})`,
      };
    }

    // Transacción: crear pago y restar del balance
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el registro de pago
      const payment = await tx.payment.create({
        data: {
          customerId: validatedData.customerId,
          amount: amount,
        },
      });

      // 2. Restar del totalBalance del cliente
      const updatedCustomer = await tx.customer.update({
        where: { id: validatedData.customerId },
        data: {
          totalBalance: {
            decrement: amount,
          },
        },
      });

      return { payment, customer: updatedCustomer };
    });

    // Revalidate cache for clientes page
    revalidatePath("/clientes");

    return { success: true, data: parseObject(result) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error registering payment:", error);
    return { success: false, error: "Error al registrar el pago" };
  }
}

// Obtener clientes con búsqueda
export async function searchCustomers(query: string) {
  try {
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { surname: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ surname: "asc" }, { name: "asc" }],
      take: 10,
    });
    return { success: true, data: parseArray(customers) };
  } catch (error) {
    console.error("Error searching customers:", error);
    return { success: false, error: "Error al buscar clientes" };
  }
}

// Schema para obtener historial de cliente
const getCustomerHistorySchema = z.object({
  customerId: z.coerce.number().int().positive("Cliente inválido"),
});

export async function getCustomerHistory(data: unknown) {
  try {
    const validatedData = getCustomerHistorySchema.parse(data);

    const customer = await prisma.customer.findUnique({
      where: { id: validatedData.customerId },
      include: {
        sales: {
          orderBy: { date: "desc" },
          include: {
            items: {
              include: { product: true },
            },
          },
        },
        payments: {
          orderBy: { date: "desc" },
        },
      },
    });

    if (!customer) {
      return { success: false, error: "Cliente no encontrado" };
    }

    // Deep serialization - parse all nested decimals
    const parsedCustomer = {
      ...customer,
      totalBalance: Number(customer.totalBalance),
      sales: customer.sales.map((sale) => ({
        ...sale,
        totalAmount: Number(sale.totalAmount),
        amountPaid: Number(sale.amountPaid),
        pendingBalance: Number(sale.pendingBalance),
        // Deep parse: iterate over sale.items
        items: sale.items.map((item) => ({
          ...item,
          price: Number(item.price),
          subtotal: Number(item.subtotal),
        })),
      })),
      payments: customer.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    };

    return { success: true, data: parsedCustomer };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }
    console.error("Error fetching customer history:", error);
    return { success: false, error: "Error al obtener el historial" };
  }
}