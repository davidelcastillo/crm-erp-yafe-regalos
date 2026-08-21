/**
 * Unit tests for SaleForm MIXTO split cash/transfer inputs (mejoras-f3-f4 item 4)
 *
 * Covers:
 *   - MIXTO renders cashAmount/transferAmount inputs
 *   - MIXTO with zero split is rejected client-side without calling registerSale
 *   - MIXTO payload sends cashAmount/transferAmount and never amountPaid
 *
 * Acceptance criteria sourced from:
 *   - openspec/changes/mejoras-f3-f4/specs/sale-with-branch/spec.md (item 4)
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SaleForm } from "./SaleForm";
import { registerSale } from "@/app/actions/sale";

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

jest.mock("react-dom", () => ({
  ...jest.requireActual("react-dom"),
  useFormStatus: () => ({ pending: false }),
}));

jest.mock("@/app/actions/sale", () => ({
  registerSale: jest.fn(),
}));

const BRANCHES = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

function setup() {
  return render(
    <SaleForm
      productId={1}
      branches={BRANCHES}
      onClose={jest.fn()}
      onSuccess={jest.fn()}
    />
  );
}

// Existing SaleForm controls have unassociated <label> siblings; navigate to
// the control via nextElementSibling.
function field(labelText: string) {
  const label = screen.getByText(labelText);
  const el = label.nextElementSibling;
  if (!el) throw new Error(`No control found after label "${labelText}"`);
  return el;
}

async function fillRequiredFields(paymentMethod: string) {
  fireEvent.change(field("Sucursal"), { target: { value: "1" } });
  fireEvent.change(field("Cantidad"), { target: { value: "1" } });
  fireEvent.change(field("Precio unitario"), { target: { value: "100" } });
  fireEvent.change(field("Método de pago"), {
    target: { value: paymentMethod },
  });
}

describe("SaleForm MIXTO (mejoras-f3-f4 item 4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (registerSale as jest.Mock).mockResolvedValue({ success: true });
  });

  it("does not render cash/transfer inputs for EFECTIVO", () => {
    setup();

    expect(screen.queryByLabelText("Efectivo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Transferencia")).not.toBeInTheDocument();
  });

  it("renders cashAmount and transferAmount inputs when payment method is MIXTO", async () => {
    setup();
    fireEvent.change(field("Método de pago"), {
      target: { value: "MIXTO" },
    });

    const cash = screen.getByLabelText("Efectivo");
    const transfer = screen.getByLabelText("Transferencia");
    fireEvent.change(cash, { target: { value: "300" } });
    fireEvent.change(transfer, { target: { value: "200" } });

    expect((cash as HTMLInputElement).value).toBe("300");
    expect((transfer as HTMLInputElement).value).toBe("200");
  });

  it("rejects a MIXTO zero split without calling registerSale", async () => {
    setup();
    await fillRequiredFields("MIXTO");
    // cash/transfer left at 0
    fireEvent.click(screen.getByRole("button", { name: "Registrar Venta" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "se requiere una cantidad en efectivo o transferencia mayor a 0"
        )
      ).toBeInTheDocument();
    });
    expect(registerSale).not.toHaveBeenCalled();
  });

  it("sends cashAmount/transferAmount (no amountPaid) for MIXTO", async () => {
    setup();
    await fillRequiredFields("MIXTO");
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
          productId: 1,
          branchId: 1,
          quantity: 1,
          price: 100,
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
});
