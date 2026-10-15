/**
 * Unit tests for AddSaleButton MIXTO split cash/transfer inputs (mejoras-f3-f4 item 4)
 *
 * Covers:
 *   - EFECTIVO renders the single "Monto Pagado" input, not cash/transfer
 *   - MIXTO renders cashAmount/transferAmount inputs and hides "Monto Pagado"
 *   - MIXTO with zero split is rejected client-side without calling registerSale
 *   - MIXTO payload sends cashAmount/transferAmount and never amountPaid
 *
 * Acceptance criteria sourced from:
 *   - openspec/changes/mejoras-f3-f4/specs/sale-with-branch/spec.md (item 4)
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddSaleButton } from "./AddSaleButton";
import { registerSale } from "@/app/actions/sale";
import Swal from "sweetalert2";
import { Product } from "@prisma/client";

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

jest.mock("@/app/actions/sale", () => ({
  registerSale: jest.fn(),
}));

jest.mock("@/app/actions/customer", () => ({
  getCustomers: jest.fn().mockResolvedValue({ success: true, data: [] }),
}));

let mockBranchId: number | null = 1;

jest.mock("@/lib/context/BranchContext", () => ({
  useBranch: () => ({
    branchId: mockBranchId,
    branch: mockBranchId ? { id: mockBranchId, name: "Principal" } : null,
    ready: true,
  }),
}));

jest.mock("@/components/ui/BranchSelector", () => ({
  BranchSelector: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number | null;
    onChange: (id: number | null) => void;
  }) => (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value ? Number(e.target.value) : null)
      }
    >
      <option value="">Seleccionar</option>
      <option value="1">Principal</option>
    </select>
  ),
}));

jest.mock("@/components/ProductSearch", () => ({
  ProductSearch: ({
    onSelect,
  }: {
    onSelect: (p: {
      id: number;
      name: string;
      code: string;
      price: number;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onSelect({ id: 1, name: "Producto A", code: "P1", price: 100 })
      }
    >
      mock-select-product
    </button>
  ),
}));

const PRODUCTS = [
  { id: 1, name: "Producto A", code: "P1", price: 100, stock: 10 },
] as unknown as Product[];

function setup() {
  return render(<AddSaleButton products={PRODUCTS} />);
}

async function openAndFillSale() {
  fireEvent.click(screen.getByRole("button", { name: "Registrar venta" }));
  fireEvent.click(
    screen.getByRole("button", { name: "mock-select-product" })
  );
  const quantityInput = screen.getByPlaceholderText("0");
  fireEvent.change(quantityInput, { target: { value: "1" } });
}

describe("AddSaleButton MIXTO (mejoras-f3-f4 item 4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBranchId = 1;
    (registerSale as jest.Mock).mockResolvedValue({ success: true });
  });

  it("renders the single Monto Pagado input for EFECTIVO and no cash/transfer inputs", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Registrar venta" }));

    expect(screen.getByLabelText("Monto Pagado")).toBeInTheDocument();
    expect(screen.queryByLabelText("Efectivo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Transferencia")).not.toBeInTheDocument();
  });

  it("shows Efectivo/Transferencia inputs and hides Monto Pagado when MIXTO", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Registrar venta" }));

    fireEvent.click(screen.getByRole("button", { name: "MIXTO" }));

    expect(screen.getByLabelText("Efectivo")).toBeInTheDocument();
    expect(screen.getByLabelText("Transferencia")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Monto Pagado")
    ).not.toBeInTheDocument();
  });

  it("rejects a MIXTO zero split without calling registerSale", async () => {
    setup();
    await openAndFillSale();
    fireEvent.click(screen.getByRole("button", { name: "MIXTO" }));

    fireEvent.click(screen.getByRole("button", { name: "Registrar Venta" }));

    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "se requiere una cantidad en efectivo o transferencia mayor a 0",
        })
      );
    });
    expect(registerSale).not.toHaveBeenCalled();
  });

  it("sends cashAmount/transferAmount (no amountPaid) for MIXTO", async () => {
    setup();
    await openAndFillSale();
    fireEvent.click(screen.getByRole("button", { name: "MIXTO" }));

    fireEvent.change(screen.getByLabelText("Efectivo"), {
      target: { value: "300" },
    });
    fireEvent.change(screen.getByLabelText("Transferencia"), {
      target: { value: "200" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Registrar Venta" }));

    await waitFor(() => {
      expect(registerSale).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 1,
          paymentMethod: "MIXTO",
          cashAmount: 300,
          transferAmount: 200,
        })
      );
    });
    expect(registerSale).toHaveBeenCalledWith(
      expect.not.objectContaining({ amountPaid: expect.anything() })
    );
  });

  // S7.2 del usuario: primero la sucursal y después todo lo demás.
  it("sin sucursal no deja cargar productos y los habilita al elegirla", () => {
    mockBranchId = null;
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Registrar venta" }));

    expect(screen.getByText(/primero elegí la sucursal/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /seleccionar producto/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Sucursal de venta"), { target: { value: "1" } });

    expect(screen.getByRole("button", { name: /seleccionar producto/i })).toBeInTheDocument();
  });

  it("shows the 'sección Inventario' copy when there are 0 registered products", () => {
    render(<AddSaleButton products={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Registrar venta" }));

    expect(screen.getByText(/no hay productos registrados/i)).toBeInTheDocument();
    expect(screen.getByText(/sección Inventario/i)).toBeInTheDocument();
  });

  // Bug 7.1 del usuario: al cambiar el producto de una fila se agregaba una fila
  // N+1 con el mismo código en lugar de reemplazarlo en la fila clickeada.
  it("cambiar el producto de una fila no agrega una fila nueva", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Registrar venta" }));

    // Fila 1: se elige el producto.
    fireEvent.click(screen.getByRole("button", { name: "mock-select-product" }));
    expect(screen.getAllByText("Producto A (P1) - $100.00")).toHaveLength(1);

    // Se vuelve a abrir el selector de esa misma fila para cambiarlo.
    fireEvent.click(screen.getByText("Producto A (P1) - $100.00"));
    fireEvent.click(screen.getByRole("button", { name: "mock-select-product" }));

    expect(screen.getAllByText("Producto A (P1) - $100.00")).toHaveLength(1);
  });

  // Mismo bug, otra causa: las filas nuevas se identificaban con Date.now(), así
  // que dos filas agregadas en el mismo milisegundo compartían id y se editaban
  // juntas.
  it("las filas nuevas tienen ids únicos: editar una no cambia la otra", () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(999);

    setup();
    fireEvent.click(screen.getByRole("button", { name: "Registrar venta" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar otro producto" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar otro producto" }));

    const cantidades = screen.getAllByPlaceholderText("0");
    expect(cantidades).toHaveLength(3);

    fireEvent.change(cantidades[2], { target: { value: "5" } });

    const conCinco = screen
      .getAllByPlaceholderText("0")
      .filter((input) => (input as HTMLInputElement).value === "5");
    expect(conCinco).toHaveLength(1);

    nowSpy.mockRestore();
  });
});
