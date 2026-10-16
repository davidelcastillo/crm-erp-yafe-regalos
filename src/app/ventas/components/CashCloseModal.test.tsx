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

    // El efectivo y la transferencia aparecen dos veces a propósito: en el detalle
    // del corte y otra vez en el panel de «A retirar», que es lo que se lleva.
    expect(await screen.findAllByText("$1200.00")).toHaveLength(2);
    expect(screen.getAllByText("$350.00")).toHaveLength(2);
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

// Sistema de botones (`globals.css`): cada paso del modal tiene una sola acción
// principal y el ✕ es el cuadrado de ícono del sistema.
describe("CashCloseModal — variantes del sistema de botones", () => {
  it("«Continuar» es el primario del primer paso y el ✕ el ícono redondo", () => {
    renderModal();

    expect(screen.getByRole("button", { name: "Continuar" })).toHaveClass(
      "btn",
      "btn-primary"
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveClass(
      "btn",
      "btn-icon",
      "btn-round"
    );
  });

  it("«Cerrar caja» es el primario del paso de confirmación", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Principal" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      await screen.findByRole("button", { name: "Cerrar caja" })
    ).toHaveClass("btn", "btn-primary");
  });
});

// Layout: en celular el modal queda apilado en una columna y táctil (sin
// utilidades de grid); recién desde `md` el panel crece y el resumen abre en dos
// columnas. Es la unidad de referencia que se copia a los otros modales.
describe("CashCloseModal — layout de escritorio", () => {
  const abrirResumen = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Principal" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    return await screen.findByText("$1550.00");
  };

  it("deja una sola columna en celular y abre dos columnas desde `md`", async () => {
    const { container } = renderModal();

    const panel = container.querySelector('[class*="md:max-w-3xl"]');
    expect(panel).not.toBeNull();
    expect(panel).toHaveClass("max-w-xl");

    const total = await abrirResumen();
    const resumen = total.closest('[class*="md:grid-cols-2"]');
    expect(resumen).not.toBeNull();
    // Celular: sigue apilado, sin grid.
    expect(resumen?.className).not.toMatch(/(^|\s)grid(\s|$)/);
    expect(resumen?.className).toContain("md:grid");
  });

  it("la tarjeta de la derecha lleva sucursal, período y el cierre", async () => {
    renderModal();
    await abrirResumen();

    const cerrar = screen.getByRole("button", { name: "Cerrar caja" });
    const tarjeta = cerrar.closest('[class*="rounded-2xl"]');
    expect(tarjeta).not.toBeNull();
    expect(tarjeta).toHaveClass("rounded-2xl", "border-black/10", "bg-[#f7f7f7]", "p-4");
    // El número que importa va en su propio panel, con la acción.
    expect(tarjeta).toHaveTextContent("A retirar");
    expect(tarjeta).toHaveTextContent("Efectivo del período");
    // La sucursal y el período van arriba, para que las dos columnas arranquen alineadas.
    const periodo = screen.getByText(/Es el primer cierre de esta sucursal/);
    expect(periodo.parentElement).toHaveTextContent("Principal");
  });

  it("no estira «Continuar» a lo ancho del panel desde `md`", () => {
    renderModal();

    expect(screen.getByRole("button", { name: "Continuar" })).toHaveClass(
      "w-full",
      "md:w-auto"
    );
  });
});
