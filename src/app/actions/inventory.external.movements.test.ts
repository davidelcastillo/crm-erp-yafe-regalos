/**
 * Movimientos públicos desde el último control de stock (S3, S5, S7).
 *
 * El catálogo externo muestra el detalle de cada movimiento —fecha, tipo y
 * cantidad— y **no** publica quién lo hizo ni la referencia del documento, que
 * revelaría compra, venta o proveedor. Sin control cerrado no hay sección.
 *
 * Prisma va mockeado como en `inventory.external.test.ts`: lo que se verifica es
 * el corte por fecha que recibe cada consulta y la forma del payload público.
 */
import { getExternalBranchMovementsSinceControl } from "@/app/actions/inventory.external";

const mockBranchFindUnique = jest.fn();
const mockControlFindFirst = jest.fn();
const mockPurchaseItemFindMany = jest.fn();
const mockSaleItemFindMany = jest.fn();
const mockBranchMovementFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    branch: { findUnique: (...args: unknown[]) => mockBranchFindUnique(...args) },
    stockControl: { findFirst: (...args: unknown[]) => mockControlFindFirst(...args) },
    purchaseItem: { findMany: (...args: unknown[]) => mockPurchaseItemFindMany(...args) },
    saleItem: { findMany: (...args: unknown[]) => mockSaleItemFindMany(...args) },
    branchMovement: { findMany: (...args: unknown[]) => mockBranchMovementFindMany(...args) },
  },
}));

const cierre = new Date("2026-01-11T12:00:00.000Z");

beforeEach(() => {
  jest.clearAllMocks();
  mockBranchFindUnique.mockResolvedValue({ isPublic: true, isActive: true });
  mockControlFindFirst.mockResolvedValue({ closedAt: cierre });
  mockPurchaseItemFindMany.mockResolvedValue([]);
  mockSaleItemFindMany.mockResolvedValue([]);
  mockBranchMovementFindMany.mockResolvedValue([]);
});

describe("getExternalBranchMovementsSinceControl", () => {
  it("no publica nada de una sucursal que no es pública y activa", async () => {
    mockBranchFindUnique.mockResolvedValue({ isPublic: false, isActive: true });

    const resultado = await getExternalBranchMovementsSinceControl({ branchId: 7 });

    expect(resultado).toEqual({ success: false });
    expect(mockControlFindFirst).not.toHaveBeenCalled();
    expect(mockBranchMovementFindMany).not.toHaveBeenCalled();
  });

  it("rechaza un branchId inválido antes de consultar", async () => {
    const resultado = await getExternalBranchMovementsSinceControl({ branchId: -1 });

    expect(resultado.success).toBe(false);
    expect(mockBranchFindUnique).not.toHaveBeenCalled();
  });

  it("sin control cerrado no hay sección: data null y ninguna consulta de movimientos", async () => {
    mockControlFindFirst.mockResolvedValue(null);

    const resultado = await getExternalBranchMovementsSinceControl({ branchId: 7 });

    expect(resultado).toEqual({ success: true, data: null, controlClosedAt: null });
    expect(mockPurchaseItemFindMany).not.toHaveBeenCalled();
    expect(mockBranchMovementFindMany).not.toHaveBeenCalled();
  });

  it("corta los movimientos en la fecha del último control y los agrupa por código", async () => {
    mockPurchaseItemFindMany.mockResolvedValue([
      {
        id: 1,
        productId: 10,
        quantity: 5,
        product: { code: "P1" },
        purchase: { id: 3, date: new Date("2026-01-12T10:00:00.000Z"), branch: { name: "Centro" } },
      },
    ]);
    mockBranchMovementFindMany.mockResolvedValue([
      {
        id: 2,
        productId: 11,
        quantity: 2,
        movementType: "ADJUSTMENT",
        reference: "CONTROL-9",
        createdAt: new Date("2026-01-12T12:00:00.000Z"),
        product: { code: "P2" },
        branch: { name: "Centro" },
      },
    ]);

    const resultado = await getExternalBranchMovementsSinceControl({ branchId: 7 });

    expect(resultado.success).toBe(true);
    if (!resultado.success) throw new Error("esperaba éxito");
    expect(resultado.controlClosedAt).toBe(cierre.toISOString());

    // El corte: mismas fechas para las tres consultas, y el control más nuevo.
    expect(mockControlFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: 7, status: "CLOSED", closedAt: { not: null } },
        orderBy: { closedAt: "desc" },
      })
    );
    expect(mockPurchaseItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          purchase: expect.objectContaining({ date: { gte: cierre }, branchId: 7 }),
        }),
      })
    );
    expect(mockBranchMovementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: cierre }, branchId: 7 }),
      })
    );

    expect(resultado.data).toEqual({
      P1: [
        {
          id: "purchase-1",
          type: "PURCHASE",
          date: "2026-01-12T10:00:00.000Z",
          quantity: 5,
        },
      ],
      P2: [
        {
          id: "movement-2",
          type: "ADJUSTMENT",
          date: "2026-01-12T12:00:00.000Z",
          quantity: 2,
        },
      ],
    });
  });

  it("el payload público no lleva quién lo hizo ni la referencia del documento", async () => {
    mockBranchMovementFindMany.mockResolvedValue([
      {
        id: 2,
        productId: 11,
        quantity: 2,
        movementType: "TRANSFER_OUT",
        reference: "MOVE-1699",
        performedBy: "admin@feria.test",
        createdAt: new Date("2026-01-12T12:00:00.000Z"),
        product: { code: "P2" },
        branch: { name: "Centro" },
      },
    ]);

    const resultado = await getExternalBranchMovementsSinceControl({ branchId: 7 });
    if (!resultado.success) throw new Error("esperaba éxito");
    const fila = resultado.data?.P2?.[0] ?? {};

    expect(Object.keys(fila).sort()).toEqual(["date", "id", "quantity", "type"]);
    expect(JSON.stringify(resultado.data)).not.toContain("MOVE-1699");
    expect(JSON.stringify(resultado.data)).not.toContain("admin@feria.test");
    expect(JSON.stringify(resultado.data)).not.toContain("Centro");
  });
});
