/**
 * Control de stock por sucursal (S1, S2, S6, S7, S9, S11).
 *
 * El control es un evento manual por sucursal: se abre un borrador con el stock
 * del sistema, se cargan los conteos físicos y al cerrar SOLO las diferencias
 * aceptadas mueven stock (`ADJUSTMENT`). Las pendientes quedan registradas y no
 * tocan nada: ajustar es siempre una decisión explícita.
 */
import {
  startStockControl,
  getStockControl,
  saveStockControlCounts,
  closeStockControl,
  getLastClosedStockControl,
} from "@/app/actions/stockControl";

// ---------------------------------------------------------------------------
// Prisma mock factory (mismo patrón que inventory.test.ts)
// ---------------------------------------------------------------------------
const mockBranchFindUnique = jest.fn();
const mockBranchInventoryFindMany = jest.fn();
const mockBranchInventoryUpsert = jest.fn();
const mockBranchMovementCreate = jest.fn();
const mockStockControlFindFirst = jest.fn();
const mockStockControlFindUnique = jest.fn();
const mockStockControlCreate = jest.fn();
const mockStockControlUpdateMany = jest.fn();
const mockStockControlUpdate = jest.fn();
const mockStockControlItemUpdateMany = jest.fn();
const mockTransaction = jest.fn(
  async (callback: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      branchInventory: { upsert: (...args: unknown[]) => mockBranchInventoryUpsert(...args) },
      branchMovement: { create: (...args: unknown[]) => mockBranchMovementCreate(...args) },
      stockControl: {
        updateMany: (...args: unknown[]) => mockStockControlUpdateMany(...args),
        update: (...args: unknown[]) => mockStockControlUpdate(...args),
      },
      stockControlItem: {
        updateMany: (...args: unknown[]) => mockStockControlItemUpdateMany(...args),
      },
    };
    return callback(tx);
  }
);

jest.mock("@/lib/prisma", () => ({
  prisma: {
    branch: {
      findUnique: (...args: unknown[]) => mockBranchFindUnique(...args),
    },
    branchInventory: {
      findMany: (...args: unknown[]) => mockBranchInventoryFindMany(...args),
      upsert: (...args: unknown[]) => mockBranchInventoryUpsert(...args),
    },
    branchMovement: {
      create: (...args: unknown[]) => mockBranchMovementCreate(...args),
    },
    stockControl: {
      findFirst: (...args: unknown[]) => mockStockControlFindFirst(...args),
      findUnique: (...args: unknown[]) => mockStockControlFindUnique(...args),
      create: (...args: unknown[]) => mockStockControlCreate(...args),
      update: (...args: unknown[]) => mockStockControlUpdate(...args),
    },
    stockControlItem: {
      updateMany: (...args: unknown[]) => mockStockControlItemUpdateMany(...args),
    },
    $transaction: (...args: unknown[]) =>
      (mockTransaction as (...a: unknown[]) => unknown)(...args),
  },
}));

const STARTED_AT = new Date("2026-10-21T10:00:00.000Z");

beforeEach(() => {
  jest.clearAllMocks();
  mockBranchInventoryUpsert.mockResolvedValue({ stock: 0 });
  mockBranchMovementCreate.mockResolvedValue({ id: 1 });
  mockStockControlUpdateMany.mockResolvedValue({ count: 1 });
  mockStockControlItemUpdateMany.mockResolvedValue({ count: 1 });
});

// ===========================================================================
// startStockControl
// ===========================================================================
describe("startStockControl", () => {
  it("crea el borrador con un ítem por producto activo con fila en la sucursal", async () => {
    mockBranchFindUnique.mockResolvedValue({ id: 1 });
    mockStockControlFindFirst.mockResolvedValue(null);
    mockBranchInventoryFindMany.mockResolvedValue([
      { productId: 10, stock: 5 },
      { productId: 11, stock: 0 },
    ]);
    mockStockControlCreate.mockResolvedValue({
      id: 99,
      branchId: 1,
      status: "DRAFT",
      startedAt: STARTED_AT,
    });

    const result = await startStockControl({ branchId: 1 });

    expect(result).toEqual({
      success: true,
      data: {
        controlId: 99,
        branchId: 1,
        status: "DRAFT",
        startedAt: "2026-10-21T10:00:00.000Z",
        reused: false,
      },
    });
    // Solo productos activos, y el stock del sistema es el stock actual.
    expect(mockBranchInventoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 1, product: { active: true } },
      })
    );
    expect(mockStockControlCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branchId: 1,
          items: {
            create: [
              { productId: 10, systemStock: 5, countedStock: 5, decision: "PENDING" },
              { productId: 11, systemStock: 0, countedStock: 0, decision: "PENDING" },
            ],
          },
        }),
      })
    );
  });

  it("reutiliza el borrador existente de la sucursal en vez de crear otro", async () => {
    mockBranchFindUnique.mockResolvedValue({ id: 1 });
    mockStockControlFindFirst.mockResolvedValue({
      id: 42,
      branchId: 1,
      status: "DRAFT",
      startedAt: STARTED_AT,
    });

    const result = await startStockControl({ branchId: 1 });

    expect(result).toEqual({
      success: true,
      data: {
        controlId: 42,
        branchId: 1,
        status: "DRAFT",
        startedAt: "2026-10-21T10:00:00.000Z",
        reused: true,
      },
    });
    expect(mockStockControlCreate).not.toHaveBeenCalled();
    expect(mockBranchInventoryFindMany).not.toHaveBeenCalled();
  });

  it("rechaza una sucursal inexistente sin crear nada", async () => {
    mockBranchFindUnique.mockResolvedValue(null);

    const result = await startStockControl({ branchId: 404 });

    expect(result).toEqual({ success: false, error: "Sucursal no encontrada" });
    expect(mockStockControlCreate).not.toHaveBeenCalled();
  });

  it("rechaza sin sesión admin y no toca Prisma (S7)", async () => {
    const { requireAdmin } = jest.requireMock<{ requireAdmin: jest.Mock }>(
      "@/lib/auth-guard"
    );
    requireAdmin.mockResolvedValueOnce({ ok: false, error: "No autorizado" });

    const result = await startStockControl({ branchId: 1 });

    expect(result).toEqual({ success: false, error: "No autorizado" });
    expect(mockBranchFindUnique).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// getStockControl
// ===========================================================================
describe("getStockControl", () => {
  it("devuelve el control con la sucursal y los ítems ordenados por código", async () => {
    mockStockControlFindUnique.mockResolvedValue({
      id: 7,
      branchId: 2,
      status: "DRAFT",
      startedAt: STARTED_AT,
      closedAt: null,
      closedBy: null,
      reason: null,
      branch: { name: "Centro", code: "CEN" },
      items: [
        {
          productId: 12,
          systemStock: 3,
          countedStock: 1,
          decision: "PENDING",
          product: { code: "AAA002", name: "Fideos", price: "10.5" },
        },
        {
          productId: 11,
          systemStock: 4,
          countedStock: 4,
          decision: "ACCEPTED",
          product: { code: "AAA001", name: "Arroz", price: "7" },
        },
      ],
    });

    const result = await getStockControl({ controlId: 7 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      id: 7,
      branchId: 2,
      branchName: "Centro",
      branchCode: "CEN",
      status: "DRAFT",
      startedAt: "2026-10-21T10:00:00.000Z",
      closedAt: null,
      closedBy: null,
      reason: null,
      items: [
        {
          productId: 11,
          code: "AAA001",
          name: "Arroz",
          price: 7,
          systemStock: 4,
          countedStock: 4,
          decision: "ACCEPTED",
        },
        {
          productId: 12,
          code: "AAA002",
          name: "Fideos",
          price: 10.5,
          systemStock: 3,
          countedStock: 1,
          decision: "PENDING",
        },
      ],
    });
  });

  it("devuelve error si el control no existe", async () => {
    mockStockControlFindUnique.mockResolvedValue(null);

    const result = await getStockControl({ controlId: 404 });

    expect(result).toEqual({ success: false, error: "Control no encontrado" });
  });
});

// ===========================================================================
// saveStockControlCounts
// ===========================================================================
describe("saveStockControlCounts", () => {
  it("guarda los conteos y las decisiones de un borrador", async () => {
    mockStockControlFindUnique.mockResolvedValue({ id: 7, status: "DRAFT" });

    const result = await saveStockControlCounts({
      controlId: 7,
      items: [
        { productId: 11, countedStock: 3, decision: "ACCEPTED" },
        { productId: 12, countedStock: 1, decision: "PENDING" },
      ],
    });

    expect(result).toEqual({ success: true, data: { saved: 2 } });
    expect(mockStockControlItemUpdateMany).toHaveBeenCalledWith({
      where: { controlId: 7, productId: 11 },
      data: { countedStock: 3, decision: "ACCEPTED" },
    });
    expect(mockStockControlItemUpdateMany).toHaveBeenCalledWith({
      where: { controlId: 7, productId: 12 },
      data: { countedStock: 1, decision: "PENDING" },
    });
  });

  it("guarda el motivo del ajuste junto con el borrador (S10)", async () => {
    mockStockControlFindUnique.mockResolvedValue({ id: 7, status: "DRAFT" });

    const result = await saveStockControlCounts({
      controlId: 7,
      reason: "cierre quincenal",
      items: [{ productId: 11, countedStock: 3, decision: "PENDING" }],
    });

    expect(result).toEqual({ success: true, data: { saved: 1 } });
    expect(mockStockControlUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { reason: "cierre quincenal" },
    });
  });

  it("sin motivo no escribe nada en el control", async () => {
    mockStockControlFindUnique.mockResolvedValue({ id: 7, status: "DRAFT" });

    await saveStockControlCounts({
      controlId: 7,
      items: [{ productId: 11, countedStock: 3, decision: "PENDING" }],
    });

    expect(mockStockControlUpdate).not.toHaveBeenCalled();
  });

  it("rechaza guardar en un control ya cerrado sin escribir nada", async () => {
    mockStockControlFindUnique.mockResolvedValue({ id: 7, status: "CLOSED" });

    const result = await saveStockControlCounts({
      controlId: 7,
      items: [{ productId: 11, countedStock: 3, decision: "ACCEPTED" }],
    });

    expect(result).toEqual({ success: false, error: "El control ya está cerrado" });
    expect(mockStockControlItemUpdateMany).not.toHaveBeenCalled();
  });

  it("rechaza un conteo negativo o no entero (Zod, mensaje en español)", async () => {
    mockStockControlFindUnique.mockResolvedValue({ id: 7, status: "DRAFT" });

    const result = await saveStockControlCounts({
      controlId: 7,
      items: [{ productId: 11, countedStock: -1, decision: "PENDING" }],
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).toContain("negativ");
    expect(mockStockControlItemUpdateMany).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// closeStockControl
// ===========================================================================
const controlConDiferencias = () => ({
  id: 7,
  branchId: 2,
  status: "DRAFT",
  reason: null,
  branch: { name: "Centro", code: "CEN" },
  items: [
    {
      productId: 11,
      systemStock: 10,
      countedStock: 7,
      decision: "ACCEPTED",
      product: { code: "AAA001", name: "Arroz" },
    },
    {
      productId: 12,
      systemStock: 5,
      countedStock: 5,
      decision: "ACCEPTED",
      product: { code: "AAA002", name: "Fideos" },
    },
    {
      productId: 13,
      systemStock: 4,
      countedStock: 2,
      decision: "PENDING",
      product: { code: "AAA003", name: "Azúcar" },
    },
  ],
});

describe("closeStockControl", () => {
  it("exige motivo cuando hay diferencias aceptadas y no toca Prisma", async () => {
    mockStockControlFindUnique.mockResolvedValue(controlConDiferencias());

    const result = await closeStockControl({ controlId: 7, reason: "   " });

    expect(result).toEqual({
      success: false,
      error: "El motivo del ajuste es obligatorio",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockBranchInventoryUpsert).not.toHaveBeenCalled();
    expect(mockBranchMovementCreate).not.toHaveBeenCalled();
    expect(mockStockControlUpdateMany).not.toHaveBeenCalled();
  });

  it("ajusta solo lo aceptado y deja el control cerrado con su actor", async () => {
    mockStockControlFindUnique.mockResolvedValue(controlConDiferencias());

    const result = await closeStockControl({
      controlId: 7,
      reason: "Rotura en depósito",
    });

    expect(result.success).toBe(true);
    // Stock absoluto (no incremento) y un ADJUSTMENT con la diferencia firmada.
    expect(mockBranchInventoryUpsert).toHaveBeenCalledTimes(1);
    expect(mockBranchInventoryUpsert).toHaveBeenCalledWith({
      where: { branchId_productId: { branchId: 2, productId: 11 } },
      create: { branchId: 2, productId: 11, stock: 7 },
      update: { stock: 7 },
    });
    // Pendientes y diferencia 0 no generan movimiento.
    expect(mockBranchMovementCreate).toHaveBeenCalledTimes(1);
    expect(mockBranchMovementCreate).toHaveBeenCalledWith({
      data: {
        productId: 11,
        branchId: 2,
        movementType: "ADJUSTMENT",
        quantity: -3,
        reference: "CONTROL-7",
        performedBy: "test@feria.test",
      },
    });
    // El cierre se reclama con una guarda: solo cierra si sigue en DRAFT.
    expect(mockStockControlUpdateMany).toHaveBeenCalledWith({
      where: { id: 7, status: "DRAFT" },
      data: {
        status: "CLOSED",
        closedAt: expect.any(Date),
        closedBy: "test@feria.test",
        reason: "Rotura en depósito",
      },
    });
  });

  it("no ajusta nada si otro proceso cerró el control primero", async () => {
    mockStockControlFindUnique.mockResolvedValue(controlConDiferencias());
    // La guarda no encuentra el control en DRAFT: otro cierre ya lo tomó.
    mockStockControlUpdateMany.mockResolvedValue({ count: 0 });

    const result = await closeStockControl({ controlId: 7, reason: "Rotura en depósito" });

    expect(result).toEqual({ success: false, error: "El control ya está cerrado" });
    expect(mockBranchInventoryUpsert).not.toHaveBeenCalled();
    expect(mockBranchMovementCreate).not.toHaveBeenCalled();
  });

  it("registra un sobrante aceptado con la diferencia positiva", async () => {
    mockStockControlFindUnique.mockResolvedValue({
      id: 8,
      branchId: 2,
      status: "DRAFT",
      reason: null,
      branch: { name: "Centro", code: "CEN" },
      items: [
        {
          productId: 11,
          systemStock: 2,
          countedStock: 6,
          decision: "ACCEPTED",
          product: { code: "AAA001", name: "Arroz" },
        },
      ],
    });

    await closeStockControl({ controlId: 8, reason: "Apareció mercadería" });

    expect(mockBranchMovementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantity: 4, reference: "CONTROL-8" }),
    });
  });

  it("devuelve un comprobante con solo las diferencias, ordenado por código", async () => {
    mockStockControlFindUnique.mockResolvedValue(controlConDiferencias());

    const result = await closeStockControl({
      controlId: 7,
      reason: "Rotura en depósito",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const receipt = result.data.receipt;
    expect(receipt).toEqual({
      controlId: 7,
      branchId: 2,
      branchName: "Centro",
      branchCode: "CEN",
      closedAt: expect.any(String),
      reason: "Rotura en depósito",
      adjustedCount: 1,
      pendingCount: 1,
      items: [
        {
          code: "AAA001",
          name: "Arroz",
          systemStock: 10,
          countedStock: 7,
          difference: -3,
          decision: "ACCEPTED",
        },
        {
          code: "AAA003",
          name: "Azúcar",
          systemStock: 4,
          countedStock: 2,
          difference: -2,
          decision: "PENDING",
        },
      ],
    });
  });

  it("rechaza cerrar un control ya cerrado", async () => {
    mockStockControlFindUnique.mockResolvedValue({
      ...controlConDiferencias(),
      status: "CLOSED",
    });

    const result = await closeStockControl({ controlId: 7, reason: "Otra vez" });

    expect(result).toEqual({ success: false, error: "El control ya está cerrado" });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// getLastClosedStockControl
// ===========================================================================
describe("getLastClosedStockControl", () => {
  it("devuelve el último control cerrado de la sucursal", async () => {
    mockStockControlFindFirst.mockResolvedValue({
      id: 5,
      closedAt: STARTED_AT,
      closedBy: "admin@feria.test",
    });

    const result = await getLastClosedStockControl({ branchId: 2 });

    expect(result).toEqual({
      success: true,
      data: { id: 5, closedAt: "2026-10-21T10:00:00.000Z", closedBy: "admin@feria.test" },
    });
    expect(mockStockControlFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 2, status: "CLOSED" },
        orderBy: { closedAt: "desc" },
      })
    );
  });

  it("devuelve null si la sucursal nunca tuvo un control cerrado", async () => {
    mockStockControlFindFirst.mockResolvedValue(null);

    const result = await getLastClosedStockControl({ branchId: 2 });

    expect(result).toEqual({ success: true, data: null });
  });
});
