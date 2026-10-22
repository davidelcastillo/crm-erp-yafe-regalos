/**
 * @jest-environment jsdom
 *
 * Control de stock por sucursal (S9): cada diferencia se decide por producto y
 * por defecto queda **pendiente** —el stock del sistema no cambia—; «aceptar»
 * ajusta a lo contado al cerrar. El cierre con ajustes pide el motivo (S10).
 *
 * El selector de sucursal se reemplaza por un botón: `BranchFilterDropdown`
 * tiene su propio comportamiento y acá interesa qué hace la pantalla cuando la
 * sucursal llega.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ControlStockPage from "./page";

jest.mock("@/app/actions/stockControl", () => ({
  startStockControl: jest.fn(),
  getStockControl: jest.fn(),
  saveStockControlCounts: jest.fn(),
  closeStockControl: jest.fn(),
  getLastClosedStockControl: jest.fn(),
}));

jest.mock("@/components/ui/BranchPicker", () => ({
  BranchPicker: ({
    branches,
    onChange,
  }: {
    branches: Array<{ id: number; name: string }>;
    onChange: (id: number) => void;
  }) => (
    <div>
      {branches.map((branch) => (
        <button key={branch.id} type="button" onClick={() => onChange(branch.id)}>
          {branch.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/actions/branch", () => ({
  getBranchOptions: jest.fn(async () => ({ success: true, data: [{ id: 1, name: "Centro" }] })),
}));

jest.mock("@/lib/utils/stock-control-pdf", () => ({
  generateStockControlPdf: jest.fn(async () => new Uint8Array([1, 2])),
}));

import {
  closeStockControl,
  getLastClosedStockControl,
  getStockControl,
  saveStockControlCounts,
  startStockControl,
} from "@/app/actions/stockControl";

const mockUltimo = getLastClosedStockControl as jest.MockedFunction<typeof getLastClosedStockControl>;
const mockIniciar = startStockControl as jest.MockedFunction<typeof startStockControl>;
const mockDetalle = getStockControl as jest.MockedFunction<typeof getStockControl>;
const mockGuardar = saveStockControlCounts as jest.MockedFunction<typeof saveStockControlCounts>;
const mockCerrar = closeStockControl as jest.MockedFunction<typeof closeStockControl>;

const items = [
  { productId: 10, code: "P1", name: "Aguja", price: 100, systemStock: 5, countedStock: 5, decision: "PENDING" as const },
  { productId: 11, code: "P2", name: "Hilo", price: 50, systemStock: 8, countedStock: 8, decision: "PENDING" as const },
];

const control = {
  id: 9,
  branchId: 1,
  branchName: "Centro",
  branchCode: "CE",
  status: "DRAFT" as const,
  startedAt: "2026-01-10T12:00:00.000Z",
  closedAt: null,
  reason: null,
  items,
};

// jsdom no implementa las URLs de objeto: alcanza con que no explote la descarga.
beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", { writable: true, value: jest.fn(() => "blob:x") });
  Object.defineProperty(URL, "revokeObjectURL", { writable: true, value: jest.fn() });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUltimo.mockResolvedValue({ success: true, data: { id: 4, closedAt: "2026-01-11T12:00:00.000Z", closedBy: "qa" } } as never);
  mockIniciar.mockResolvedValue({ success: true, data: { controlId: 9, branchId: 1, status: "DRAFT", startedAt: "2026-01-10T12:00:00.000Z", reused: false } } as never);
  mockDetalle.mockResolvedValue({ success: true, data: control } as never);
  mockGuardar.mockResolvedValue({ success: true, data: { saved: 2 } } as never);
});

const abrirControl = async () => {
  render(<ControlStockPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Centro" }));
  await screen.findByText("Último control cerrado: 11/01/2026.");
  fireEvent.click(screen.getByRole("button", { name: "Iniciar control" }));
  await screen.findByText("Centro · control #9");
};

const fila = (code: string) => screen.getByText(new RegExp(`^${code} ·`)).closest("li") as HTMLElement;

describe("Control de stock por sucursal", () => {
  it("sin sucursal pide elegir una y no abre ningún control", async () => {
    render(<ControlStockPage />);

    expect(screen.getByText(/Paso 1 de 2 · Elegí la sucursal/)).toBeInTheDocument();
    // La sucursal se elige en la lista del paso 1, no en un desplegable del encabezado.
    expect(await screen.findByRole("button", { name: "Centro" })).toBeInTheDocument();
    expect(
      screen.getByText(/Elegí una sucursal para contar su mercadería/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar control" })).not.toBeInTheDocument();
    expect(mockIniciar).not.toHaveBeenCalled();
  });

  it("muestra el último control cerrado y abre el borrador de esa sucursal", async () => {
    await abrirControl();

    expect(mockIniciar).toHaveBeenCalledWith({ branchId: 1 });
    expect(mockDetalle).toHaveBeenCalledWith({ controlId: 9 });
    expect(screen.getByText("P1 · Aguja")).toBeInTheDocument();
    expect(within(fila("P1")).getByText("Sistema: 5")).toBeInTheDocument();
    expect(screen.getByText(/2 productos · 0 con diferencia/)).toBeInTheDocument();
  });

  it("marca la diferencia en vivo y la deja pendiente por defecto", async () => {
    await abrirControl();

    fireEvent.change(screen.getByLabelText("Cantidad contada de Aguja"), { target: { value: "3" } });

    expect(within(fila("P1")).getByText("Faltan 2")).toBeInTheDocument();
    expect(within(fila("P1")).getByRole("button", { name: "Pendiente" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByText(/1 con diferencia · 0 a ajustar · 1 pendientes/)).toBeInTheDocument();
  });

  it("el atajo acepta las diferencias y el cierre guarda y manda el motivo", async () => {
    mockCerrar.mockResolvedValue({
      success: true,
      data: {
        receipt: {
          controlId: 9,
          branchId: 1,
          branchName: "Centro",
          branchCode: "CE",
          closedAt: "2026-01-12T12:00:00.000Z",
          reason: "cierre quincenal",
          adjustedCount: 2,
          pendingCount: 0,
          items: [],
        },
      },
    } as never);

    await abrirControl();

    fireEvent.change(screen.getByLabelText("Cantidad contada de Aguja"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Cantidad contada de Hilo"), { target: { value: "10" } });
    expect(within(fila("P2")).getByText("Sobran 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Aceptar diferencias" }));
    expect(within(fila("P1")).getByRole("button", { name: "Aceptar ajuste" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(fila("P2")).getByRole("button", { name: "Aceptar ajuste" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.change(screen.getByLabelText(/Motivo del ajuste/), {
      target: { value: "  cierre quincenal  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar control" }));

    await waitFor(() =>
      expect(mockGuardar).toHaveBeenCalledWith({
        controlId: 9,
        // El cierre guarda el conteo con su motivo antes de cerrar.
        reason: "cierre quincenal",
        items: [
          { productId: 10, countedStock: 3, decision: "ACCEPTED" },
          { productId: 11, countedStock: 10, decision: "ACCEPTED" },
        ],
      })
    );
    expect(mockCerrar).toHaveBeenCalledWith({ controlId: 9, reason: "cierre quincenal" });
    expect(
      await screen.findByText("Control cerrado: 2 ajustados · 0 pendientes.")
    ).toBeInTheDocument();
  });

  it("si el cierre rechaza el motivo, muestra el error y no da el control por cerrado", async () => {
    mockCerrar.mockResolvedValue({
      success: false,
      error: "El motivo del ajuste es obligatorio",
    } as never);

    await abrirControl();
    fireEvent.change(screen.getByLabelText("Cantidad contada de Aguja"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Aceptar ajuste" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar control" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El motivo del ajuste es obligatorio"
    );
    expect(screen.queryByText(/Control cerrado:/)).not.toBeInTheDocument();
  });

  it("la decisión por producto gana sobre el atajo y no se aplica sola", async () => {
    await abrirControl();

    fireEvent.change(screen.getByLabelText("Cantidad contada de Aguja"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Cantidad contada de Hilo"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Aceptar diferencias" }));
    // Volver una fila a pendiente: el atajo no es irreversible.
    fireEvent.click(within(fila("P2")).getByRole("button", { name: "Pendiente" }));

    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));

    await waitFor(() =>
      expect(mockGuardar).toHaveBeenCalledWith({
        controlId: 9,
        items: [
          { productId: 10, countedStock: 4, decision: "ACCEPTED" },
          { productId: 11, countedStock: 9, decision: "PENDING" },
        ],
      })
    );
    expect(mockCerrar).not.toHaveBeenCalled();
  });

  it("el motivo del ajuste se guarda con el borrador (S10)", async () => {
    await abrirControl();

    fireEvent.change(screen.getByLabelText(/Motivo del ajuste/), {
      target: { value: "  cierre quincenal  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));

    await waitFor(() =>
      expect(mockGuardar).toHaveBeenCalledWith(
        expect.objectContaining({ controlId: 9, reason: "cierre quincenal" })
      )
    );
  });

  it("al retomar un borrador el motivo guardado vuelve al campo", async () => {
    mockDetalle.mockResolvedValue({
      success: true,
      data: { ...control, reason: "cierre quincenal" },
    } as never);

    await abrirControl();

    expect(screen.getByLabelText(/Motivo del ajuste/)).toHaveValue("cierre quincenal");
  });
});
