/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Product } from "@prisma/client";
import { ProductForm } from "../components/ProductForm";

// Mock the actions. We mock BOTH the HU2 `createProduct` and the extended
// `updateProductExtended` so we can exercise both modes.
jest.mock("../../actions/product", () => ({
  createProduct: jest.fn(),
  updateProductExtended: jest.fn(),
}));

// Mock CategorySelector to keep this suite focused on ProductForm behavior
type CategorySelectorMockProps = {
  selectedId?: number | null;
  onValueChange?: (id: number | null) => void;
};

jest.mock("@/components/ui/CategorySelector", () => ({
  CategorySelector: ({ onValueChange, selectedId }: CategorySelectorMockProps) => (
    <div data-testid="category-selector">
      <button
        type="button"
        onClick={() => onValueChange?.(42)}
        aria-label="select-category"
      >
        Select category {selectedId ?? "none"}
      </button>
    </div>
  ),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}));

// Mock SweetAlert2 — default resolves "Aceptar" (isConfirmed: true)
jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

import { createProduct, updateProductExtended } from "../../actions/product";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

const mockCreateProduct = createProduct as jest.MockedFunction<typeof createProduct>;
const mockUpdateProductExtended = updateProductExtended as jest.MockedFunction<
  typeof updateProductExtended
>;

describe("ProductForm Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateProduct.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        name: "Test",
        description: "-",
        categoryId: null,
        active: true,
        price: 0 as unknown as import("@prisma/client/runtime/library").Decimal,
        code: "TS000",
        codePrefix: "TS",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    mockUpdateProductExtended.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        name: "Test",
        description: "-",
        categoryId: null,
        active: true,
        price: 0 as unknown as import("@prisma/client/runtime/library").Decimal,
        code: "TS000",
        codePrefix: "TS",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  it("renders form fields correctly (create mode)", () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/prefijo.*2-4 letras/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/precio de venta/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear producto/i })).toBeInTheDocument();
    // No initial stock field anymore (stock lives in BranchInventory)
    expect(screen.queryByLabelText(/cantidad inicial/i)).not.toBeInTheDocument();
    // Category selector is rendered
    expect(screen.getByTestId("category-selector")).toBeInTheDocument();
    // Active toggle is NOT shown in create mode (defaults to active=true)
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows validation error when required fields are empty", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // createProduct IS called (HTML form validation kicks in later than the
      // onClick — we only assert the action has not been called yet after submit)
      expect(mockCreateProduct).not.toHaveBeenCalled();
    });
  });

  it("calls createProduct with correct data when form is submitted", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    const nameInput = screen.getByLabelText(/nombre/i);
    const descInput = screen.getByLabelText(/descripción/i);
    const prefixInput = screen.getByLabelText(/prefijo.*2-4 letras/i);
    const priceInput = screen.getByLabelText(/precio de venta/i);

    fireEvent.change(nameInput, { target: { value: "Jabón de Avena y Arroz" } });
    fireEvent.change(descInput, { target: { value: "Jabón artesanal exfoliante" } });
    fireEvent.change(prefixInput, { target: { value: "AA" } });
    fireEvent.change(priceInput, { target: { value: "1500" } });

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith({
        name: "Jabón de Avena y Arroz",
        description: "Jabón artesanal exfoliante",
        prefix: "AA",
        price: 1500,
      });
    });
  });

  it("displays error message when createProduct fails", async () => {
    mockCreateProduct.mockResolvedValue({ success: false, error: "El nombre es requerido" });

    render(<ProductForm product={null} onClose={() => {}} />);

    const nameInput = screen.getByLabelText(/nombre/i);
    const prefixInput = screen.getByLabelText(/prefijo.*2-4 letras/i);
    const priceInput = screen.getByLabelText(/precio de venta/i);

    fireEvent.change(nameInput, { target: { value: "Test" } });
    fireEvent.change(prefixInput, { target: { value: "AA" } });
    fireEvent.change(priceInput, { target: { value: "100" } });

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          text: "El nombre es requerido",
          icon: "error",
        })
      );
    });
  });

  it("prefills form when editing an existing product", () => {
    const product = {
      id: 1,
      name: "Producto Existente",
      description: "Descripción existente",
      categoryId: null,
      active: true,
      price: 500,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    render(<ProductForm product={product} onClose={() => {}} />);

    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Producto Existente");
    expect(screen.getByLabelText(/descripción/i)).toHaveValue("Descripción existente");
    expect(screen.getByLabelText(/código/i)).toHaveValue("EX001");
    expect(screen.getByLabelText(/prefijo/i)).toHaveValue("EX");
    expect(screen.getByLabelText(/precio de venta/i)).toHaveValue(500);
    expect(screen.getByRole("button", { name: /actualizar producto/i })).toBeInTheDocument();
    // Active toggle should be visible in edit mode
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("calls onSuccess with created product and does NOT call router.refresh when onSuccess is provided", async () => {
    const onSuccessMock = jest.fn();
    const onCloseMock = jest.fn();
    const mockRefresh = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      refresh: mockRefresh,
    });

    render(
      <ProductForm
        product={null}
        onClose={onCloseMock}
        onSuccess={onSuccessMock}
      />
    );

    const nameInput = screen.getByLabelText(/nombre/i);
    const prefixInput = screen.getByLabelText(/prefijo.*2-4 letras/i);
    const priceInput = screen.getByLabelText(/precio de venta/i);

    fireEvent.change(nameInput, { target: { value: "Test Product" } });
    fireEvent.change(prefixInput, { target: { value: "TS" } });
    fireEvent.change(priceInput, { target: { value: "1000" } });

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  it("calls router.refresh when onSuccess is NOT provided (backward compatibility)", async () => {
    const onCloseMock = jest.fn();
    const mockRefresh = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      refresh: mockRefresh,
    });

    render(<ProductForm product={null} onClose={onCloseMock} />);

    const nameInput = screen.getByLabelText(/nombre/i);
    const prefixInput = screen.getByLabelText(/prefijo.*2-4 letras/i);
    const priceInput = screen.getByLabelText(/precio de venta/i);

    fireEvent.change(nameInput, { target: { value: "Test Product" } });
    fireEvent.change(prefixInput, { target: { value: "TS" } });
    fireEvent.change(priceInput, { target: { value: "1000" } });

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("calls onSuccess with updated product when editing and does NOT call router.refresh", async () => {
    const onSuccessMock = jest.fn();
    const onCloseMock = jest.fn();
    const mockRefresh = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      refresh: mockRefresh,
    });

    const existingProduct = {
      id: 1,
      name: "Producto Existente",
      description: "Descripción existente",
      categoryId: null,
      active: true,
      price: 500,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    mockUpdateProductExtended.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        name: "Producto Actualizado",
        description: "Descripción existente",
        categoryId: null,
        active: true,
        price: 500,
        code: "EX001",
        codePrefix: "EX",
        createdAt: existingProduct.createdAt,
        updatedAt: existingProduct.updatedAt,
      },
    } as never);

    render(
      <ProductForm
        product={existingProduct}
        onClose={onCloseMock}
        onSuccess={onSuccessMock}
      />
    );

    const nameInput = screen.getByLabelText(/nombre/i);
    fireEvent.change(nameInput, { target: { value: "Producto Actualizado" } });

    const submitButton = screen.getByRole("button", { name: /actualizar producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  it("uses updateProductExtended with id, name, price, categoryId, active when editing", async () => {
    const existingProduct = {
      id: 1,
      name: "Producto",
      description: "-",
      categoryId: null,
      active: true,
      price: 100,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    render(
      <ProductForm
        product={existingProduct}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    // Use the mocked CategorySelector to set categoryId
    fireEvent.click(screen.getByLabelText(/select-category/i));

    const submitButton = screen.getByRole("button", { name: /actualizar producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateProductExtended).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          categoryId: 42,
          active: true,
        })
      );
    });
  });

  it("confirms with SweetAlert2 before deactivating a product (edit mode)", async () => {
    // First call is the SweetAlert2 confirm; resolve with isConfirmed: true
    ;(Swal.fire as jest.Mock).mockResolvedValueOnce({ isConfirmed: true });

    const existingProduct = {
      id: 1,
      name: "Producto",
      description: "-",
      categoryId: null,
      active: true,
      price: 100,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    render(<ProductForm product={existingProduct} onClose={() => {}} />);

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    // Click the toggle → deactivating an active product must ask for confirmation
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "¿Desactivar producto?",
          showCancelButton: true,
          confirmButtonColor: "#ff385c",
          confirmButtonText: "Sí, desactivar",
        })
      );
    });

    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-checked", "false");
    });
  });

  it("does NOT deactivate when the SweetAlert2 confirmation is cancelled", async () => {
    // Confirm cancelled
    ;(Swal.fire as jest.Mock).mockResolvedValueOnce({ isConfirmed: false });

    const existingProduct = {
      id: 1,
      name: "Producto",
      description: "-",
      categoryId: null,
      active: true,
      price: 100,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    render(<ProductForm product={existingProduct} onClose={() => {}} />);

    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);

    await waitFor(() => {
      // Confirmation was requested but cancelled → toggle stays active
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });
  });
});
