/**
 * Unit tests de `createCustomer`: el teléfono opcional de la clienta
 * (decisión del dueño, cuarta ronda del ADR de prendas: «Teléfono sí») y que
 * sin teléfono no se manda la columna opcional.
 *
 * Refs: odd/tasks/prendas-pedidos.md (U5, deuda del worker), AGENTS.md §0.2.
 */
import { createCustomer } from "./customer";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth-guard", () => ({
  requireAdmin: jest.fn().mockResolvedValue({ ok: true, email: "test@feria.test" }),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.customer.create as jest.Mock).mockResolvedValue({
    id: 9,
    name: "Ana",
    surname: "Pérez",
    totalBalance: 0,
  });
});

describe("createCustomer — teléfono opcional de la clienta", () => {
  it("crea la clienta con su teléfono cuando llega", async () => {
    const result = await createCustomer({
      name: "Ana",
      surname: "Pérez",
      phone: "387-4567890",
    });

    expect(result.success).toBe(true);
    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Ana",
        surname: "Pérez",
        phone: "387-4567890",
      }),
    });
  });

  it("sin teléfono no manda la columna opcional", async () => {
    const result = await createCustomer({ name: "Ana", surname: "Pérez" });

    expect(result.success).toBe(true);
    const data = (prisma.customer.create as jest.Mock).mock.calls[0][0].data;
    expect(data.phone).toBeUndefined();
  });
});
