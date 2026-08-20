/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  fireEvent.change(screen.getByLabelText(/sucursal/i), {
    target: { value: "1" },
  });
  fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
  await waitFor(() => {
    expect(screen.getByText(/seleccionar productos/i)).toBeInTheDocument();
  });
  // Esperar a que la carga de productos termine antes de inspeccionar la lista.
  await waitFor(() => {
    expect(screen.queryByText(/cargando productos/i)).not.toBeInTheDocument();
  });
}

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
  it("renders step 1 and disables Continuar until a branch is selected", () => {
    renderWizard();

    expect(screen.getByText(/paso 1 de 3/i)).toBeInTheDocument();
    const continuar = screen.getByRole("button", { name: /continuar/i });
    expect(continuar).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/sucursal/i), {
      target: { value: "2" },
    });
    expect(continuar).toBeEnabled();
  });

  it("shows checkboxes only for products with stock > 0 and updates the counter", async () => {
    await goToStep2();

    // 3 productos en el mock, uno con stock 0 → sólo 2 checkboxes.
    const checkboxes = screen.getAllByRole("checkbox");
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

  it("disables Generar PDF on step 3 when nothing is selected and enables it after selection", async () => {
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
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    expect(screen.getByRole("button", { name: /generar pdf/i })).toBeEnabled();
  });

  it("stays on step 3 and preserves selection when PDF generation fails", async () => {
    mockExportBranchProductsPdf.mockResolvedValue({
      success: false,
      error: "Error al exportar el inventario",
    });

    await goToStep2();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
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

  it("downloads the PDF on success", async () => {
    URL.createObjectURL = jest.fn(() => "blob:test");
    URL.revokeObjectURL = jest.fn();
    // jsdom no implementa navegación para anchors; stubeamos el click.
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = jest.fn();

    try {
      await goToStep2();
      fireEvent.click(screen.getAllByRole("checkbox")[0]);
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
