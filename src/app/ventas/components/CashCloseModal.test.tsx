/**
 * @jest-environment jsdom
 */

/**
 * Cierre de caja en `/ventas` (S9 del usuario): pide la sucursal, muestra el
 * resumen de la caja abierta —efectivo a retirar, transferencia a verificar y el
 * mixto con su aclaración— y confirma el corte con el actor de la sesión.
 * Los métodos con total 0 no se muestran (S9).
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CashCloseModal } from "./CashCloseModal";

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

jest.mock("@/app/actions/cash", () => ({
  getCashClosePreview: jest.fn(),
  closeCash: jest.fn(),
}));

jest.mock("@/actions/auth", () => ({ getUser: jest.fn() }));

import { getCashClosePreview, closeCash } from "@/app/actions/cash";
import { getUser } from "@/actions/auth";

const mockPreview = getCashClosePreview as jest.MockedFunction<
  typeof getCashClosePreview
>;
const mockCerrar = closeCash as jest.MockedFunction<typeof closeCash>;
const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;

const branches = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

const resumen = {
  branchName: "Principal",
  since: null,
  cashTotal: 1200,
  transferTotal: 350,
  mixedTotal: 0,
  total: 1550,
  salesCount: 7,
};

const onConfirm = jest.fn();
const onClose = jest.fn();

const renderModal = () =>
  render(
    <CashCloseModal
      open
      branches={branches}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockPreview.mockResolvedValue({ success: true, data: resumen } as never);
  mockCerrar.mockResolvedValue({ success: true, data: { id: 1 } } as never);
  mockGetUser.mockResolvedValue({ email: "admin@feriaconexx.com" });
});

describe("CashCloseModal", () => {
  it("no pide el resumen ni deja cerrar sin elegir la sucursal", () => {
    renderModal();

    expect(screen.queryByRole("button", { name: "Cerrar caja" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it("muestra el efectivo a retirar, la transferencia a verificar y el total, sin el método en 0", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Principal" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(mockPreview).toHaveBeenCalledWith({ branchId: 1 }));

    expect(await screen.findByText("$1200.00")).toBeInTheDocument();
    expect(screen.getByText("$350.00")).toBeInTheDocument();
    expect(screen.getByText("$1550.00")).toBeInTheDocument();
    expect(screen.queryByText(/Mixto/)).not.toBeInTheDocument();
  });

  it("cierra la caja con la sucursal y el email del usuario, y avisa al listado", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Principal" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.click(await screen.findByRole("button", { name: "Cerrar caja" }));

    await waitFor(() =>
      expect(mockCerrar).toHaveBeenCalledWith({
        branchId: 1,
        performedBy: "admin@feriaconexx.com",
      })
    );
    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
