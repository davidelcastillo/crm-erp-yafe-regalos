/**
 * @jest-environment jsdom
 */

/**
 * Entrada/salida de stock por lote (S13 del usuario): wizard de 3 pasos, hermano
 * del de traslado entre sucursales. Cubre las reglas: la sucursal es
 * obligatoria, la entrada lista todos los activos (aunque no tengan fila en la
 * sucursal) y la salida solo los que tienen stock, una salida no puede superar
 * el stock disponible y el lote se manda con el motivo y el actor.
 */
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { StockAdjustmentModal } from "./StockAdjustmentModal";

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

jest.mock("@/app/actions/inventory", () => ({
  adjustBranchStockBatch: jest.fn(),
  getProductsWithBranchStock: jest.fn(),
}));

jest.mock("@/actions/auth", () => ({ getUser: jest.fn() }));

import { adjustBranchStockBatch, getProductsWithBranchStock } from "@/app/actions/inventory";
import { getUser } from "@/actions/auth";

const mockAjustar = adjustBranchStockBatch as jest.MockedFunction<
  typeof adjustBranchStockBatch
>;
const mockProductos = getProductsWithBranchStock as jest.MockedFunction<
  typeof getProductsWithBranchStock
>;
const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;

const branches = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

// Producto B sin stock en la sucursal y Producto C sin fila: los dos tienen que
// poder entrar, pero no salir.
const productos = [
  { id: 1, name: "Producto A", code: "PR001", inventory: [{ branchId: 1, stock: 10 }] },
  { id: 2, name: "Producto B", code: "PR002", inventory: [{ branchId: 1, stock: 0 }] },
  { id: 3, name: "Producto C", code: "PR003", inventory: [] },
];

const renderModal = () =>
  render(
    <StockAdjustmentModal open branches={branches} onClose={jest.fn()} onConfirm={jest.fn()} />
  );

const checkboxes = () =>
  within(screen.getByRole("group", { name: "Productos" })).getAllByRole("checkbox");

async function irAlPaso2(tipo: "Entrada" | "Salida" = "Entrada") {
  fireEvent.click(screen.getByRole("button", { name: "Principal" }));
  fireEvent.click(screen.getByRole("button", { name: tipo }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await waitFor(() =>
    expect(screen.queryByText("Cargando productos...")).not.toBeInTheDocument()
  );
}

const seleccionar = (nombre: string, cantidad: number) => {
  fireEvent.click(screen.getByRole("checkbox", { name: `Seleccionar ${nombre}` }));
  fireEvent.change(screen.getByLabelText(`Cantidad ${nombre}`), {
    target: { value: String(cantidad) },
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockProductos.mockResolvedValue({ success: true, data: productos } as never);
  mockAjustar.mockResolvedValue({ success: true } as never);
  mockGetUser.mockResolvedValue({ email: "admin@feriaconexx.com" });
});

describe("StockAdjustmentModal", () => {
  it("no deja continuar sin sucursal", () => {
    renderModal();

    const continuar = screen.getByRole("button", { name: "Continuar" });
    expect(continuar).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Principal" }));
    expect(continuar).toBeEnabled();
  });

  it("en entrada lista todos los activos, incluso los que no tienen fila en la sucursal", async () => {
    renderModal();
    await irAlPaso2("Entrada");

    expect(mockProductos).toHaveBeenCalledWith({});
    expect(checkboxes()).toHaveLength(3);
    expect(screen.getByText(/PR003 · Stock: 0/)).toBeInTheDocument();
  });

  it("en salida pide solo los que tienen stock en la sucursal", async () => {
    renderModal();
    await irAlPaso2("Salida");

    expect(mockProductos).toHaveBeenCalledWith({ branchId: 1, onlyWithStock: true });
  });

  it("no deja avanzar una salida mayor al stock disponible", async () => {
    renderModal();
    await irAlPaso2("Salida");

    seleccionar("Producto A", 11);

    expect(
      screen.getByText("La cantidad supera el stock disponible (10)")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Cantidad Producto A"), {
      target: { value: "3" },
    });
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  });

  it("manda el lote con la sucursal, el sentido, el motivo y el actor", async () => {
    renderModal();
    await irAlPaso2("Entrada");

    seleccionar("Producto A", 4);
    seleccionar("Producto B", 2);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    fireEvent.change(screen.getByLabelText("Motivo (opcional)"), {
      target: { value: "Conteo físico" },
    });
    // El resumen se muestra antes de confirmar.
    expect(screen.getByText("6")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Registrar entrada" }));

    await waitFor(() => {
      expect(mockAjustar).toHaveBeenCalledWith({
        branchId: 1,
        movementType: "ENTRY",
        items: [
          { productId: 1, quantity: 4 },
          { productId: 2, quantity: 2 },
        ],
        reference: "Conteo físico",
        performedBy: "admin@feriaconexx.com",
      });
    });
  });
});
