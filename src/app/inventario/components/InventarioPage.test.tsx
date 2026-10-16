/**
 * @jest-environment jsdom
 *
 * InventarioPage.test.tsx — FAB "Agregar producto" + "Nueva categoría" en
 * /inventario (change unificar-productos-inventario, Fase 1 / PR 1).
 *
 * Cubre los escenarios de openspec/specs/inventory-ui/spec.md:
 *  1. FAB visible con aria-label "Agregar producto" sobre la lista cargada.
 *  2. Click en el FAB abre el ProductForm ("Nuevo Producto").
 *  3. Crear producto re-ejecuta getProductsWithBranchStock con los filtros
 *     activos (branch + categoría + búsqueda) sin resetearlos.
 *  4. Crear categoría desde el header → createCategory(name.trim()) y refresh
 *     de getCategoryOptions con Swal de éxito.
 *  5. Categoría duplicada (P2002) → Swal error y lista local sin duplicar.
 *
 * Además verifica la parametrización de AddProductButton (tarea 1.1):
 *  - Modo legacy (sin props): estado interno, abre ProductForm al hacer click.
 *  - Modo controlado (open/onOpenChange): delega la apertura y NUNCA renderiza
 *    el ProductForm interno (D4 del design).
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Product } from "@prisma/client";
import InventarioPage from "../page";
import { AddProductButton } from "@/app/productos/components/AddProductButton";

// Mock de actions de inventario (la página + MoveStockModal + ExportWizard).
jest.mock("@/app/actions/inventory", () => ({
  getProductsWithBranchStock: jest.fn(),
  getBranchInventory: jest.fn(),
  moveStockBatchBetweenBranches: jest.fn(),
  getBranchProductsForExport: jest.fn(),
  exportBranchProductsPdf: jest.fn(),
}));

// BranchFilterDropdown carga sucursales por su cuenta en el mount.
jest.mock("@/app/actions/branch", () => ({
  getBranchOptions: jest.fn(),
}));

// La página y CategorySelector (dentro de ProductForm) usan estas actions.
jest.mock("@/app/actions/category", () => ({
  getCategoryOptions: jest.fn(),
  createCategory: jest.fn(),
}));

// ProductForm importa createProduct/updateProductExtended; LabelSelector y
// MovementsModal consumen searchProducts/getProducts/getProductMovements.
jest.mock("@/app/actions/product", () => ({
  createProduct: jest.fn(),
  updateProductExtended: jest.fn(),
  searchProducts: jest.fn(),
  getProducts: jest.fn(),
  getProductMovements: jest.fn(),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
  usePathname: jest.fn(() => "/inventario"),
}));

// Mock defensivo de BranchContext (la página ni sus hijos directos lo usan,
// mismo patrón que AddPurchaseButton.test.tsx).
jest.mock("@/lib/context/BranchContext", () => ({
  useBranch: jest.fn(() => ({
    branchId: null,
    branch: null,
    branches: [],
    ready: true,
    setBranchId: jest.fn(),
    refreshBranches: jest.fn(),
  })),
}));

import { getProductsWithBranchStock } from "@/app/actions/inventory";
import { getBranchOptions } from "@/app/actions/branch";
import {
  getCategoryOptions,
  createCategory,
} from "@/app/actions/category";
import {
  createProduct,
  updateProductExtended,
} from "@/app/actions/product";
import Swal from "sweetalert2";

const mockGetProductsWithBranchStock =
  getProductsWithBranchStock as jest.MockedFunction<
    typeof getProductsWithBranchStock
  >;
const mockGetBranchOptions = getBranchOptions as jest.MockedFunction<
  typeof getBranchOptions
>;
const mockGetCategoryOptions = getCategoryOptions as jest.MockedFunction<
  typeof getCategoryOptions
>;
const mockCreateCategory = createCategory as jest.MockedFunction<
  typeof createCategory
>;
const mockCreateProduct = createProduct as jest.MockedFunction<
  typeof createProduct
>;
const mockUpdateProductExtended = updateProductExtended as jest.MockedFunction<
  typeof updateProductExtended
>;
const mockSwalFire = Swal.fire as unknown as jest.Mock;

const branches = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

const categories = [
  { id: 1, name: "Limpieza" },
  { id: 2, name: "Alimentos" },
];

const createdProduct = {
  id: 1,
  name: "Jabón de Avena",
  description: "-",
  categoryId: null,
  active: true,
  price: 1500,
  code: "JA000",
  codePrefix: "JA",
  createdAt: new Date(),
  updatedAt: new Date(),
  inventory: [],
} as unknown as Product;

const products = [createdProduct];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProductsWithBranchStock.mockResolvedValue({
    success: true,
    data: products,
  } as never);
  mockGetBranchOptions.mockResolvedValue({
    success: true,
    data: branches,
  } as never);
  mockGetCategoryOptions.mockResolvedValue({
    success: true,
    data: categories,
  } as never);
  mockCreateCategory.mockResolvedValue({
    success: true,
    data: { id: 3, name: "Alimentos" },
  } as never);
  mockCreateProduct.mockResolvedValue({ success: true, data: createdProduct } as never);
  mockUpdateProductExtended.mockResolvedValue({ success: true } as never);
  mockSwalFire.mockResolvedValue({ isConfirmed: true });
});

/** Renderiza la página y espera a que termine el loading inicial (FAB visible). */
async function renderPage() {
  render(<InventarioPage />);
  await screen.findByLabelText("Agregar producto");
}

describe("InventarioPage — FAB crear producto (spec inventory-ui)", () => {
  it("muestra el FAB 'Agregar producto' sobre la lista cargada", async () => {
    await renderPage();

    const fab = screen.getByRole("button", { name: "Agregar producto" });
    expect(fab).toBeInTheDocument();
    // El FAB es el disparador único: aún no hay ProductForm abierto.
    expect(screen.queryByText("Nuevo Producto")).not.toBeInTheDocument();
  });

  it("al tocar el FAB abre el ProductForm 'Nuevo Producto'", async () => {
    await renderPage();

    fireEvent.click(screen.getByLabelText("Agregar producto"));

    expect(await screen.findByText("Nuevo Producto")).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });

  it("crear un producto re-ejecuta getProductsWithBranchStock con los filtros activos", async () => {
    await renderPage();

    // Filtro de sucursal: B1 "Principal".
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /todas las sucursales/i })
      ).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /todas las sucursales/i }));
    fireEvent.click(await screen.findByRole("option", { name: "Principal" }));

    // Filtro de categoría: "Limpieza" (id 1).
    fireEvent.change(screen.getByDisplayValue("Todas las categorías"), {
      target: { value: "1" },
    });

    // Búsqueda "jabón" (debounce 300 ms real → waitFor lo espera).
    fireEvent.change(screen.getByLabelText(/buscar producto/i), {
      target: { value: "jabón" },
    });
    await waitFor(() => {
      expect(mockGetProductsWithBranchStock).toHaveBeenLastCalledWith({
        branchId: 1,
        categoryId: 1,
        search: "jabón",
        activeOnly: true,
      });
    });

    // Abrir el FAB y crear el producto "Jabón de Avena".
    fireEvent.click(screen.getByLabelText("Agregar producto"));
    fireEvent.change(await screen.findByLabelText(/nombre/i), {
      target: { value: "Jabón de Avena" },
    });
    fireEvent.change(screen.getByLabelText(/prefijo.*2-4 letras/i), {
      target: { value: "JA" },
    });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    // El refetch post-creación respeta los filtros AND activos (sin resetearlos).
    await waitFor(() => {
      expect(mockGetProductsWithBranchStock).toHaveBeenLastCalledWith({
        branchId: 1,
        categoryId: 1,
        search: "jabón",
        activeOnly: true,
      });
    });
    // El modal se cierra tras el alta exitosa.
    await waitFor(() => {
      expect(screen.queryByText("Nuevo Producto")).not.toBeInTheDocument();
    });
  });

  it("crea una categoría desde el header, refresca opciones y muestra Swal de éxito", async () => {
    await renderPage();

    // El Swal de input confirma con un nombre con espacios (debe trimearse).
    mockSwalFire.mockResolvedValueOnce({ isConfirmed: true, value: "  Alimentos  " });
    mockCreateCategory.mockResolvedValueOnce({
      success: true,
      data: { id: 3, name: "Alimentos" },
    } as never);
    // El refresh post-creación devuelve la lista ampliada.
    mockGetCategoryOptions.mockResolvedValueOnce({
      success: true,
      data: [
        { id: 1, name: "Limpieza" },
        { id: 3, name: "Alimentos" },
      ],
    } as never);

    // «Nueva categoría» vive en el menú ☰ del encabezado (L27).
    fireEvent.click(screen.getByLabelText("Abrir menú"));
    fireEvent.click(screen.getByRole("button", { name: "Nueva categoría" }));

    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith({ name: "Alimentos" });
    });
    // La nueva categoría queda disponible en el selector (refresh real).
    expect(
      await screen.findByRole("option", { name: "Alimentos" })
    ).toBeInTheDocument();
    // Swal de éxito.
    await waitFor(() => {
      expect(mockSwalFire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Categoría creada",
          text: 'Se creó "Alimentos"',
          icon: "success",
          confirmButtonColor: "#be185d",
        })
      );
    });
  });

  it("ante una categoría duplicada muestra Swal error y NO duplica la lista local", async () => {
    await renderPage();

    mockSwalFire.mockResolvedValueOnce({ isConfirmed: true, value: "Alimentos" });
    mockCreateCategory.mockResolvedValueOnce({
      success: false,
      error: "Ya existe una categoría con ese nombre",
    } as never);

    // «Nueva categoría» vive en el menú ☰ del encabezado (L27).
    fireEvent.click(screen.getByLabelText("Abrir menú"));
    fireEvent.click(screen.getByRole("button", { name: "Nueva categoría" }));

    await waitFor(() => {
      expect(mockSwalFire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          text: "Ya existe una categoría con ese nombre",
          icon: "error",
        })
      );
    });
    // "Alimentos" aparece UNA sola vez en el selector (no hubo duplicado local).
    expect(screen.getAllByRole("option", { name: "Alimentos" })).toHaveLength(1);
  });
});

describe("AddProductButton parametrizado (tarea 1.1)", () => {
  it("modo legacy (sin props): abre el ProductForm con estado interno", async () => {
    render(<AddProductButton />);

    expect(screen.queryByText("Nuevo Producto")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Agregar producto"));

    expect(await screen.findByText("Nuevo Producto")).toBeInTheDocument();
  });

  it("modo controlado: delega la apertura en onOpenChange y NO renderiza el form interno", () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <AddProductButton open={false} onOpenChange={onOpenChange} />
    );

    expect(screen.queryByText("Nuevo Producto")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Agregar producto"));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    // Aunque la página ponga open=true, el modo controlado NUNCA renderiza
    // el ProductForm interno (D4 — la página renderiza el suyo propio).
    rerender(<AddProductButton open={true} onOpenChange={onOpenChange} />);
    expect(screen.queryByText("Nuevo Producto")).not.toBeInTheDocument();
  });
});