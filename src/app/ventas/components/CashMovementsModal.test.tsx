/**
 * @jest-environment jsdom
 */

/**
 * Plata de caja en `/ventas` (S14 del usuario): pide la sucursal primero, muestra
 * el libro de esa sucursal con sus totales y registra ingresos y egresos con
 * **fecha propia** (S18) y el actor de la sesión. Un monto no positivo no se manda.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CashMovementsModal } from "./CashMovementsModal";

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

jest.mock("@/app/actions/cash", () => ({
  getCashMovements: jest.fn(),
  registerCashMovement: jest.fn(),
}));

jest.mock("@/actions/auth", () => ({ getUser: jest.fn() }));

import { getCashMovements, registerCashMovement } from "@/app/actions/cash";
import { getUser } from "@/actions/auth";

const mockListar = getCashMovements as jest.MockedFunction<typeof getCashMovements>;
const mockRegistrar = registerCashMovement as jest.MockedFunction<
  typeof registerCashMovement
>;
const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;

const branches = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

const libro = {
  items: [
    {
      id: 9,
      type: "INGRESO" as const,
      method: "EFECTIVO",
      amount: 100,
      date: "2026-03-04T00:00:00.000Z",
      description: "Conteo de caja",
    },
  ],
  totals: { ingresos: 100, egresos: 40, balance: 60 },
};

const onConfirm = jest.fn();

const renderModal = () =>
  render(
    <CashMovementsModal
      open
      branches={branches}
      onClose={jest.fn()}
      onConfirm={onConfirm}
    />
  );

const elegirSucursal = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Principal" }));
  await waitFor(() => expect(screen.getByText("Conteo de caja")).toBeInTheDocument());
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListar.mockResolvedValue({ success: true, data: libro } as never);
  mockRegistrar.mockResolvedValue({ success: true, data: { id: 10 } } as never);
  mockGetUser.mockResolvedValue({ email: "admin@feriaconexx.com" });
});

describe("CashMovementsModal", () => {
  it("no deja registrar plata sin elegir la sucursal", () => {
    renderModal();

    expect(screen.getByText(/Elegí la sucursal/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Monto")).not.toBeInTheDocument();
    expect(mockListar).not.toHaveBeenCalled();
  });

  it("muestra el libro y los totales de la sucursal elegida", async () => {
    renderModal();
    await elegirSucursal();

    expect(mockListar).toHaveBeenCalledWith({ branchId: 1 });
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$40.00")).toBeInTheDocument();
    expect(screen.getByText("$60.00")).toBeInTheDocument();
  });

  it("registra el ingreso con la fecha propia, el detalle y el actor", async () => {
    renderModal();
    await elegirSucursal();

    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "250" } });
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-03-04" } });
    fireEvent.change(screen.getByLabelText(/Detalle/), {
      target: { value: "Reposición de cambio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ingreso" }));

    await waitFor(() =>
      expect(mockRegistrar).toHaveBeenCalledWith({
        branchId: 1,
        type: "INGRESO",
        method: "EFECTIVO",
        amount: 250,
        date: "2026-03-04",
        description: "Reposición de cambio",
        performedBy: "admin@feriaconexx.com",
      })
    );
    // El libro se vuelve a leer para mostrar el movimiento nuevo.
    await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(2));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("registra un egreso por transferencia y no manda un monto inválido", async () => {
    renderModal();
    await elegirSucursal();

    fireEvent.click(screen.getByRole("button", { name: "Egreso" }));
    fireEvent.change(screen.getByLabelText("Medio"), { target: { value: "TRANSFERENCIA" } });
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar egreso" }));

    expect(await screen.findByText("El monto debe ser mayor a 0")).toBeInTheDocument();
    expect(mockRegistrar).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar egreso" }));

    await waitFor(() =>
      expect(mockRegistrar).toHaveBeenCalledWith(
        expect.objectContaining({ type: "EGRESO", method: "TRANSFERENCIA", amount: 75 })
      )
    );
  });
});

// Sistema de botones (`globals.css`): el control segmentado marca la opción
// elegida con `btn-active` y la otra va neutra; el ✕ es el ícono cuadrado.
describe("CashMovementsModal — variantes del sistema de botones", () => {
  it("la opción elegida de «¿Entra o sale plata?» va btn-active y la otra btn-secondary", async () => {
    renderModal();
    await elegirSucursal();

    const ingreso = screen.getByRole("button", { name: "Ingreso" });
    const egreso = screen.getByRole("button", { name: "Egreso" });

    expect(ingreso).toHaveClass("btn", "btn-active");
    expect(egreso).toHaveClass("btn", "btn-secondary");

    fireEvent.click(egreso);

    expect(egreso).toHaveClass("btn", "btn-active");
    expect(ingreso).toHaveClass("btn", "btn-secondary");
  });

  it("«Registrar ingreso» es el primario y el ✕ el ícono redondo", async () => {
    renderModal();

    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveClass(
      "btn",
      "btn-icon",
      "btn-round"
    );

    await elegirSucursal();

    expect(screen.getByRole("button", { name: "Registrar ingreso" })).toHaveClass(
      "btn",
      "btn-primary"
    );
  });
});
