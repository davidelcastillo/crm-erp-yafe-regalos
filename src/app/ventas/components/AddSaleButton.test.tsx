/**
 * Unit tests for AddSaleButton: asistente de pasos y medios de pago (pedido L30).
 *
 * Covers:
 *   - Paso 1: las sucursales activas se eligen tocando una card; «Siguiente» avanza
 *     al paso 2 y queda deshabilitado hasta que haya una sucursal elegida.
 *   - Paso 2: la sucursal elegida se muestra como etiqueta, sin selector.
 *   - EFECTIVO/TRANSFERENCIA cobran el total y no piden efectivo/transferencia.
 *   - MIXTO no se ofrece en la UI (el código sigue vivo, solo inalcanzable).
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddSaleButton } from "./AddSaleButton";
import { registerSale } from "@/app/actions/sale";
import { getUser } from "@/actions/auth";
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

jest.mock("@/actions/auth", () => ({ getUser: jest.fn() }));

let mockBranchId: number | null = 1;

// Sucursales activas que ya vienen del hook (no se agregaron llamadas nuevas).
const mockBranches = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;

jest.mock("@/lib/context/BranchContext", () => ({
  useBranch: () => ({
    branchId: mockBranchId,
    branch: mockBranchId ? { id: mockBranchId, name: "Principal" } : null,
    branches: mockBranches,
    ready: true,
  }),
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

/**
 * Paso 1 → paso 2: la sucursal se elige tocando su card y se confirma con
 * «Siguiente».
 */
function abrirPaso2(nombreSucursal = "Principal") {
  fireEvent.click(screen.getByRole("button", { name: "Registrar venta" }));
  fireEvent.click(screen.getByRole("button", { name: nombreSucursal }));
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
}

async function openAndFillSale() {
  abrirPaso2();
  fireEvent.click(
    screen.getByRole("button", { name: "mock-select-product" })
  );
  const quantityInput = screen.getByPlaceholderText("0");
  fireEvent.change(quantityInput, { target: { value: "1" } });
}

describe("AddSaleButton: pasos y medios de pago (pedido L30)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBranchId = 1;
    (registerSale as jest.Mock).mockResolvedValue({ success: true });
  });

  // Pedido L30: el paso 1 elige la sucursal tocando una card.
  it("el paso 1 lista las sucursales activas en cards y marca la elegida", () => {
    mockBranchId = null;
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Registrar venta" }));

    const principal = screen.getByRole("button", { name: "Principal" });
    const centro = screen.getByRole("button", { name: "Centro" });
    expect(principal).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(centro);

    expect(centro).toHaveAttribute("aria-pressed", "true");
    expect(principal).toHaveAttribute("aria-pressed", "false");
  });

  it("no pide Monto Pagado ni muestra efectivo/transferencia para EFECTIVO", () => {
    setup();
    abrirPaso2();

    expect(screen.queryByLabelText("Monto Pagado")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Efectivo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Transferencia")).not.toBeInTheDocument();
  });

  // Pedido L30 (#3): el paso 2 ya no repite el selector de sucursal.
  it("el paso 2 muestra la sucursal elegida como etiqueta, sin selector", () => {
    setup();
    abrirPaso2("Centro");

    expect(screen.getByText("Sucursal: Centro")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /sucursal/i })
    ).not.toBeInTheDocument();
  });

  // Triangulación: lo que se manda al servidor es la sucursal de la card tocada.
  it("manda al servidor la sucursal elegida en la card, no la del contexto", async () => {
    setup();
    abrirPaso2("Centro");
    fireEvent.click(screen.getByRole("button", { name: "mock-select-product" }));
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar Venta" }));

    await waitFor(() => {
      expect(registerSale).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 2 })
      );
    });
  });

  // Pedido L30 (#2): MIXTO desactivado en la UI; el código sigue (payment.test.ts).
  it("no ofrece MIXTO entre los medios de pago", () => {
    setup();
    abrirPaso2();

    expect(screen.queryByRole("button", { name: "MIXTO" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EFECTIVO" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "TRANSFERENCIA" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Efectivo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Transferencia")).not.toBeInTheDocument();
  });

  // Bug 8.3 del usuario: el total es el monto pagado, y una transferencia es
  // plata cobrada (no deuda).
  it("con TRANSFERENCIA manda el total como monto pagado", async () => {
    setup();
    abrirPaso2();
    fireEvent.click(screen.getByRole("button", { name: "mock-select-product" }));
    fireEvent.change(screen.getAllByPlaceholderText("0")[0], { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "TRANSFERENCIA" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar Venta" }));

    await waitFor(() => {
      expect(registerSale).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: "TRANSFERENCIA",
          amountPaid: 200,
        })
      );
    });
  });

  // T15: el movimiento de la venta en el libro de la sucursal necesita el actor.
  it("manda performedBy (de getUser) con la venta", async () => {
    mockGetUser.mockResolvedValue({ email: "admin@feriaconexx.com" });
    setup();
    await openAndFillSale();

    fireEvent.click(screen.getByRole("button", { name: "Registrar Venta" }));

    await waitFor(() => {
      expect(registerSale).toHaveBeenCalledWith(
        expect.objectContaining({ performedBy: "admin@feriaconexx.com" })
      );
    });
  });

  it("muestra Efectivo/Transferencia solo como código: MIXTO no es alcanzable", () => {
    setup();
    abrirPaso2();

    // El bloque de desglose existe en el código pero no hay forma de llegar a él.
    expect(screen.queryByLabelText("Efectivo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Transferencia")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/se requiere una cantidad en efectivo o transferencia/i)
    ).not.toBeInTheDocument();
  });

  // S7.2 del usuario: primero la sucursal y después todo lo demás.
  it("sin sucursal elegida «Siguiente» está deshabilitado y el paso 2 carga al avanzar", () => {
    mockBranchId = null;
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Registrar venta" }));

    expect(screen.getByText(/primero elegí la sucursal/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /seleccionar producto/i })).not.toBeInTheDocument();

    const siguiente = screen.getByRole("button", { name: "Siguiente" });
    expect(siguiente).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Principal" }));
    expect(siguiente).toBeEnabled();

    fireEvent.click(siguiente);

    expect(screen.getByRole("button", { name: /seleccionar producto/i })).toBeInTheDocument();
  });

  it("shows the 'sección Inventario' copy when there are 0 registered products", () => {
    render(<AddSaleButton products={[]} />);

    abrirPaso2();

    expect(screen.getByText(/no hay productos registrados/i)).toBeInTheDocument();
    expect(screen.getByText(/sección Inventario/i)).toBeInTheDocument();
  });

  // Bug 7.1 del usuario: al cambiar el producto de una fila se agregaba una fila
  // N+1 con el mismo código en lugar de reemplazarlo en la fila clickeada.
  it("cambiar el producto de una fila no agrega una fila nueva", () => {
    setup();
    abrirPaso2();

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
    abrirPaso2();
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
