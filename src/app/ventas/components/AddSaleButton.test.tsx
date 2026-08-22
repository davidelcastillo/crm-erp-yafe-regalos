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

jest.mock("@/lib/context/BranchContext", () => ({
  useBranch: () => ({
    branchId: 1,
    branch: { id: 1, name: "Principal" },
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

  it("shows the 'sección Inventario' copy when there are 0 registered products", () => {
    render(<AddSaleButton products={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Registrar venta" }));

    expect(screen.getByText(/no hay productos registrados/i)).toBeInTheDocument();
    expect(screen.getByText(/sección Inventario/i)).toBeInTheDocument();
  });
});
