/**
 * @jest-environment jsdom
 *
 * LabelSelector es el wizard de etiquetas de precio: paso 1 sucursal, paso 2
 * productos activos con stock > 0 en esa sucursal (buscador, «Todos», cantidad
 * por producto y resumen en vivo de etiquetas y hojas A4).
 */
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { LabelSelector } from "./LabelSelector";

jest.mock("@/app/actions/inventory", () => ({
  getBranchProductsForExport: jest.fn(),
}));

jest.mock("@/actions/label-print", () => ({
  generateProductLabels: jest.fn(),
}));

import { getBranchProductsForExport } from "@/app/actions/inventory";
import { generateProductLabels } from "@/actions/label-print";

const mockGetBranchProductsForExport =
  getBranchProductsForExport as jest.MockedFunction<typeof getBranchProductsForExport>;
const mockGenerateProductLabels = generateProductLabels as jest.MockedFunction<
  typeof generateProductLabels
>;

const branches = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

const rows = [
  { id: 11, code: "AAA001", name: "Jabón de Avena", stock: 5, price: 1250 },
  { id: 12, code: "BBB888", name: "Shampoo Solido", stock: 2, price: 99.5 },
];

let descarga: string | null = null;

beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: jest.fn(() => "blob:etiquetas"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    value: jest.fn(),
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  descarga = null;
  mockGetBranchProductsForExport.mockResolvedValue({
    success: true,
    data: rows,
  } as never);
  mockGenerateProductLabels.mockResolvedValue({
    success: true,
    data: { pdfBase64: "JVBERi0xLjQ=", filename: "etiquetas-PR001-20260101.pdf" },
  } as never);
  jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      descarga = this.download;
    });
});

const renderWizard = () => render(<LabelSelector isOpen branches={branches} onClose={jest.fn()} />);

/** Paso 1 → 2 eligiendo la sucursal y esperando los productos. */
async function irAlPaso2() {
  renderWizard();
  fireEvent.click(screen.getByRole("button", { name: "Principal" }));
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() => {
    expect(mockGetBranchProductsForExport).toHaveBeenCalledWith({ branchId: 1 });
  });
  await screen.findByText("Jabón de Avena");
}

const checkboxesDeProductos = () =>
  within(screen.getByRole("group", { name: /productos con stock/i })).getAllByRole("checkbox");

describe("LabelSelector — paso 1: sucursal", () => {
  it("no deja avanzar sin sucursal", () => {
    renderWizard();

    expect(screen.getByText(/paso 1 de 2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(mockGetBranchProductsForExport).not.toHaveBeenCalled();
  });

  it("al elegir sucursal carga los productos de esa sucursal y avanza al paso 2", async () => {
    await irAlPaso2();

    expect(screen.getByText(/paso 2 de 2/i)).toBeInTheDocument();
    expect(screen.getByText("Jabón de Avena")).toBeInTheDocument();
    expect(screen.getByText("Shampoo Solido")).toBeInTheDocument();
  });
});

describe("LabelSelector — paso 2: productos y cantidades", () => {
  it("«Todos» marca una etiqueta por producto y actualiza el resumen", async () => {
    await irAlPaso2();

    expect(screen.getByText(/0 etiquetas en 0 hojas A4/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Todos" }));

    for (const checkbox of checkboxesDeProductos()) {
      expect(checkbox).toBeChecked();
    }
    expect(screen.getByRole("checkbox", { name: "Todos" })).toBeChecked();
    expect(screen.getByText(/2 etiquetas en 1 hoja A4/i)).toBeInTheDocument();
  });

  it("suma la cantidad por producto y recalcula las hojas", async () => {
    await irAlPaso2();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Jabón de Avena" }));
    fireEvent.change(screen.getByLabelText("Cantidad Jabón de Avena"), {
      target: { value: "5" },
    });

    expect(screen.getByText(/5 etiquetas en 1 hoja A4/i)).toBeInTheDocument();

    // 73 etiquetas ya piden dos hojas.
    fireEvent.change(screen.getByLabelText("Cantidad Jabón de Avena"), {
      target: { value: "73" },
    });
    expect(screen.getByText(/73 etiquetas en 2 hojas A4/i)).toBeInTheDocument();
  });

  it("el buscador filtra por nombre o código", async () => {
    await irAlPaso2();

    fireEvent.change(screen.getByLabelText("Buscar producto"), {
      target: { value: "bbb8" },
    });

    expect(screen.getByText("Shampoo Solido")).toBeInTheDocument();
    expect(screen.queryByText("Jabón de Avena")).not.toBeInTheDocument();
  });

  it("sin etiquetas el botón de descargar queda deshabilitado", async () => {
    await irAlPaso2();

    expect(screen.getByRole("button", { name: /descargar pdf/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Todos" }));
    expect(screen.getByRole("button", { name: /descargar pdf/i })).toBeEnabled();
  });

  it("genera el PDF con las selecciones y descarga el archivo", async () => {
    await irAlPaso2();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Jabón de Avena" }));
    fireEvent.change(screen.getByLabelText("Cantidad Jabón de Avena"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Shampoo Solido" }));

    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => {
      expect(mockGenerateProductLabels).toHaveBeenCalledWith({
        branchId: 1,
        selections: [
          { productId: 11, quantity: 3 },
          { productId: 12, quantity: 1 },
        ],
      });
    });
    await waitFor(() => {
      expect(descarga).toBe("etiquetas-PR001-20260101.pdf");
    });
  });

  it("muestra el error de la acción sin perder la selección", async () => {
    mockGenerateProductLabels.mockResolvedValueOnce({
      success: false,
      error: "Hay productos inactivos o sin stock en la sucursal seleccionada",
    } as never);

    await irAlPaso2();
    fireEvent.click(screen.getByRole("checkbox", { name: "Todos" }));
    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    expect(
      await screen.findByText(/hay productos inactivos o sin stock/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Todos" })).toBeChecked();
    expect(descarga).toBeNull();
  });
});
