/**
 * @jest-environment jsdom
 *
 * Pago de un cliente (S5): modal del sistema, sin campo de monto. La deuda se
 * cobra completa; el servidor conserva su regla (monto positivo y ≤ deuda).
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RegistrarPagoModal } from "./RegistrarPagoModal";
import { registerPayment } from "@/app/actions/customer";

jest.mock("@/app/actions/customer", () => ({
  registerPayment: jest.fn(),
}));

const mockRegisterPayment = registerPayment as jest.MockedFunction<typeof registerPayment>;

const cliente = { id: 7, name: "Ana", surname: "Pérez", totalBalance: 1250.5 };

const renderModal = (props: Partial<Parameters<typeof RegistrarPagoModal>[0]> = {}) =>
  render(
    <RegistrarPagoModal
      open
      customer={cliente}
      onClose={jest.fn()}
      onPaid={jest.fn()}
      {...props}
    />
  );

describe("RegistrarPagoModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterPayment.mockResolvedValue({ success: true, data: {} } as never);
  });

  it("muestra la deuda completa y no pide un monto parcial", () => {
    renderModal();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/\$1250\.50/)).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /monto/i })).not.toBeInTheDocument();
  });

  it("registra el pago por la deuda completa", async () => {
    const onPaid = jest.fn();
    renderModal({ onPaid });

    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => {
      expect(mockRegisterPayment).toHaveBeenCalledWith({ customerId: 7, amount: 1250.5 });
    });
    expect(onPaid).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/pago registrado/i);
  });

  it("muestra el error del servidor dentro del modal, sin cerrar", async () => {
    mockRegisterPayment.mockResolvedValue({ success: false, error: "No autorizado" } as never);
    const onPaid = jest.fn();
    renderModal({ onPaid });

    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No autorizado");
    expect(onPaid).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cancela sin registrar nada", () => {
    const onClose = jest.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(mockRegisterPayment).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("no se cierra al tocar el fondo (los modales con datos no cierran por click afuera)", () => {
    const onClose = jest.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole("dialog"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
