/**
 * @jest-environment jsdom
 */

/**
 * Paso de cobro (U5, S3): soltar una tarjeta en «Pagado» no cobra sola, abre
 * este modal con los números del servidor (total, señas y saldo de `getPedido`).
 * Del cliente solo sale el medio de pago.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CobrarPedidoModal } from "./CobrarPedidoModal";

jest.mock("@/app/actions/pedido", () => ({
  getPedido: jest.fn(),
  cobrarPedido: jest.fn(),
  entregarPedido: jest.fn(),
}));

import { cobrarPedido, entregarPedido, getPedido } from "@/app/actions/pedido";

const mockPedido = getPedido as jest.MockedFunction<typeof getPedido>;
const mockCobrar = cobrarPedido as jest.MockedFunction<typeof cobrarPedido>;
const mockEntregar = entregarPedido as jest.MockedFunction<typeof entregarPedido>;

const pedido = {
  id: 7,
  numero: "V-0007",
  estado: "RESERVADO",
  total: 13500,
  senas: 5000,
  saldo: 8500,
  medio: "EFECTIVO",
  customer: { id: 1, name: "Mica", surname: "R.", phone: null },
  canal: "WhatsApp",
  ciudad: "Córdoba",
};

const renderModal = (entregar = false) => {
  const onCobrado = jest.fn();
  const onClose = jest.fn();
  render(
    <CobrarPedidoModal open pedidoId={7} onClose={onClose} onCobrado={onCobrado} entregar={entregar} />
  );
  return { onCobrado, onClose };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPedido.mockResolvedValue({ success: true, data: pedido } as never);
  mockCobrar.mockResolvedValue({ success: true, data: { id: 7 } } as never);
  mockEntregar.mockResolvedValue({ success: true, data: { id: 7 } } as never);
});

describe("CobrarPedidoModal", () => {
  it("muestra los números del servidor, incluido el saldo", async () => {
    renderModal();

    expect(await screen.findByText("V-0007")).toBeInTheDocument();
    expect(screen.getByText("Mica R.")).toBeInTheDocument();
    expect(screen.getByText(/13\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/5\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/8\.500,00/)).toBeInTheDocument();
  });

  it("cobra el saldo con el medio elegido", async () => {
    const { onCobrado } = renderModal();
    await screen.findByText("V-0007");

    fireEvent.change(screen.getByLabelText("Medio de pago"), {
      target: { value: "TRANSFERENCIA" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cobrar" }));

    await waitFor(() =>
      expect(mockCobrar).toHaveBeenCalledWith({ id: 7, metodo: "TRANSFERENCIA" })
    );
    await waitFor(() => expect(onCobrado).toHaveBeenCalled());
  });

  it("muestra tal cual el error de stock del servidor", async () => {
    mockCobrar.mockResolvedValue({
      success: false,
      error:
        'Sin stock disponible para "Vestido lencero": disponible 0, el pedido pide 1. Revisá el stock de la sucursal.',
    } as never);
    renderModal();
    await screen.findByText("V-0007");

    fireEvent.click(screen.getByRole("button", { name: "Cobrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Sin stock disponible para "Vestido lencero"'
    );
  });
});

describe("CobrarPedidoModal en modo entrega (L8-2)", () => {
  it("el botón dice «Cobrar y entregar» y llama a entregarPedido", async () => {
    const { onCobrado, onClose } = renderModal(true);
    await screen.findByText("V-0007");

    // Mismos números: el saldo es el del servidor también al entregar.
    expect(screen.getByText(/8\.500,00/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entregar y cobrar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cobrar" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Medio de pago"), {
      target: { value: "TRANSFERENCIA" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cobrar y entregar" }));

    await waitFor(() =>
      expect(mockEntregar).toHaveBeenCalledWith({ id: 7, metodo: "TRANSFERENCIA" })
    );
    expect(mockCobrar).not.toHaveBeenCalled();
    await waitFor(() => expect(onCobrado).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("en modo cobro no llama a entregarPedido", async () => {
    renderModal();
    await screen.findByText("V-0007");

    fireEvent.click(screen.getByRole("button", { name: "Cobrar" }));

    await waitFor(() => expect(mockCobrar).toHaveBeenCalledWith({ id: 7, metodo: "EFECTIVO" }));
    expect(mockEntregar).not.toHaveBeenCalled();
  });
});
