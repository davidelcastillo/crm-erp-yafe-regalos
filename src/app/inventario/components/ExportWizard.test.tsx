/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ExportWizard } from "./ExportWizard";

jest.mock("@/app/actions/inventory", () => ({
  getBranchProductsForExport: jest.fn(),
  getProductsWithBranchStock: jest.fn(),
  exportBranchProductsPdf: jest.fn(),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

import {
  getBranchProductsForExport,
  getProductsWithBranchStock,
  exportBranchProductsPdf,
} from "@/app/actions/inventory";
import Swal from "sweetalert2";

const mockGetBranchProductsForExport = getBranchProductsForExport as jest.MockedFunction<
  typeof getBranchProductsForExport
>;
const mockGetProductsWithBranchStock = getProductsWithBranchStock as jest.MockedFunction<
  typeof getProductsWithBranchStock
>;
const mockExportBranchProductsPdf = exportBranchProductsPdf as jest.MockedFunction<
  typeof exportBranchProductsPdf
>;

const branches = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

// 3 productos, uno con stock 0: sólo 2 checkboxes deben renderizarse.
const stockRows = [
  { id: 1, code: "PR001", name: "Producto A", stock: 10, price: 100 },
  { id: 2, code: "PR002", name: "Producto B", stock: 5, price: 200 },
  { id: 3, code: "PR003", name: "Producto Sin Stock", stock: 0, price: 300 },
];

// Fuente de ids numéricos (getProductsWithBranchStock) usada para resolver
// selectedProductIds por código.
const productsWithIds = [
  { id: 1, code: "PR001", name: "Producto A" },
  { id: 2, code: "PR002", name: "Producto B" },
  { id: 3, code: "PR003", name: "Producto Sin Stock" },
];

function renderWizard() {
  return render(<ExportWizard open branches={branches} onClose={jest.fn()} />);
}

async function goToStep2() {
  renderWizard();
  fireEvent.click(screen.getByRole("button", { name: "Principal" }));
  fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
  await waitFor(() => {
    expect(screen.getByText(/seleccionar productos/i)).toBeInTheDocument();
  });
  // Esperar a que la carga de productos termine antes de inspeccionar la lista.
  await waitFor(() => {
    expect(screen.queryByText(/cargando productos/i)).not.toBeInTheDocument();
  });
}

/** Checkboxes de la lista de productos (sin contar el selector Todos). */
const checkboxesDeProductos = () =>
  within(screen.getByRole("group", { name: /productos con stock/i })).getAllByRole(
    "checkbox"
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBranchProductsForExport.mockResolvedValue({
    success: true,
    data: stockRows,
  });
  mockGetProductsWithBranchStock.mockResolvedValue({
    success: true,
    data: productsWithIds,
  } as never);
  mockExportBranchProductsPdf.mockResolvedValue({
    success: true,
    data: {
      pdfBase64: "JVBERi0xLg==",
      filename: "inventario-DEP-20260806.pdf",
    },
  });
});

describe("ExportWizard", () => {
  it("muestra el paso 1 y deja Continuar deshabilitado hasta elegir sucursal", () => {
    renderWizard();

    expect(screen.getByText(/paso 1 de 3/i)).toBeInTheDocument();
    const continuar = screen.getByRole("button", { name: /continuar/i });
    expect(continuar).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Centro" }));
    expect(continuar).toBeEnabled();
  });

  it("muestra checkboxes solo para productos con stock > 0 y actualiza el contador", async () => {
    await goToStep2();

    // 3 productos en el mock, uno con stock 0 → sólo 2 checkboxes.
    const checkboxes = checkboxesDeProductos();
    expect(checkboxes).toHaveLength(2);
    expect(mockGetBranchProductsForExport).toHaveBeenCalledWith({
      branchId: 1,
    });
    expect(screen.getByText(/0 seleccionados/i)).toBeInTheDocument();

    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/1 seleccionados/i)).toBeInTheDocument();

    fireEvent.click(checkboxes[1]);
    expect(screen.getByText(/2 seleccionados/i)).toBeInTheDocument();
  });

  it("el selector Todos marca todos los productos con stock", async () => {
    await goToStep2();

    const todos = screen.getByRole("checkbox", { name: /todos/i });
    expect(todos).not.toBeChecked();

    fireEvent.click(todos);

    // Los 2 productos con stock, y ninguno de los que tienen stock 0.
    expect(screen.getByText(/2 seleccionados/i)).toBeInTheDocument();
    checkboxesDeProductos().forEach((checkbox) => expect(checkbox).toBeChecked());

    fireEvent.click(todos);

    expect(screen.getByText(/0 seleccionados/i)).toBeInTheDocument();
    checkboxesDeProductos().forEach((checkbox) => expect(checkbox).not.toBeChecked());
  });

  it("marca el selector Todos cuando se eligen todos a mano", async () => {
    await goToStep2();

    checkboxesDeProductos().forEach((checkbox) => fireEvent.click(checkbox));

    expect(screen.getByRole("checkbox", { name: /todos/i })).toBeChecked();
  });

  it("deshabilita Generar PDF en el paso 3 sin selección y lo habilita después de elegir", async () => {
    await goToStep2();

    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(screen.getByText(/paso 3 de 3/i)).toBeInTheDocument();

    const generar = screen.getByRole("button", { name: /generar pdf/i });
    expect(generar).toBeDisabled();

    // Volver, seleccionar un producto y avanzar de nuevo.
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    await waitFor(() => {
      expect(screen.queryByText(/cargando productos/i)).not.toBeInTheDocument();
    });
    const checkboxes = checkboxesDeProductos();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    expect(screen.getByRole("button", { name: /generar pdf/i })).toBeEnabled();
  });

  it("se queda en el paso 3 y conserva la selección si falla la generación del PDF", async () => {
    mockExportBranchProductsPdf.mockResolvedValue({
      success: false,
      error: "Error al exportar el inventario",
    });

    await goToStep2();
    fireEvent.click(checkboxesDeProductos()[0]);
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    fireEvent.click(screen.getByRole("button", { name: /generar pdf/i }));

    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          icon: "error",
          text: "Error al exportar el inventario",
        })
      );
    });

    // El wizard sigue en el paso 3 y la selección se preserva.
    expect(screen.getByText(/paso 3 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generar pdf/i })).toBeInTheDocument();
    expect(screen.getByText(/1 seleccionados/i)).toBeInTheDocument();
  });

  it("descarga el PDF cuando la generación sale bien", async () => {
    URL.createObjectURL = jest.fn(() => "blob:test");
    URL.revokeObjectURL = jest.fn();
    // jsdom no implementa navegación para anchors; stubeamos el click.
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = jest.fn();

    try {
      await goToStep2();
      fireEvent.click(checkboxesDeProductos()[0]);
      fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
      fireEvent.click(screen.getByRole("button", { name: /generar pdf/i }));

      await waitFor(() => {
        expect(mockExportBranchProductsPdf).toHaveBeenCalledWith({
          branchId: 1,
          selectedProductIds: [1],
        });
      });

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "PDF generado",
          icon: "success",
        })
      );
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });
});
