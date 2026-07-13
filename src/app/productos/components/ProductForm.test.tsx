/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProductForm } from "../components/ProductForm";

// Mock the createProduct and updateProduct actions
jest.mock("../../actions/product", () => ({
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}));

// Mock SweetAlert2
jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

import { createProduct, updateProduct } from "../../actions/product";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

const mockCreateProduct = createProduct as jest.MockedFunction<typeof createProduct>;
const mockUpdateProduct = updateProduct as jest.MockedFunction<typeof updateProduct>;

describe("ProductForm Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateProduct.mockResolvedValue({ 
      success: true, 
      data: { 
        id: 1, 
        name: "Test", 
        description: null, 
        stock: 0, 
        price: 0,
        code: "TS000",
        codePrefix: "TS",
        createdAt: new Date(), 
        updatedAt: new Date() 
      } 
    });
    mockUpdateProduct.mockResolvedValue({ 
      success: true, 
      data: { 
        id: 1, 
        name: "Test", 
        description: null, 
        stock: 0,
        price: 0,
        code: "TS000",
        codePrefix: "TS",
        createdAt: new Date(), 
        updatedAt: new Date() 
      } 
    });
  });

  it("renders form fields correctly (create mode)", () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cantidad inicial/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/prefijo.*2-4 letras/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/precio de venta/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear producto/i })).toBeInTheDocument();
  });

  it("shows validation error when required fields are empty", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateProduct).not.toHaveBeenCalled();
    });
  });

  it("calls createProduct with correct data when form is submitted", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    const nameInput = screen.getByLabelText(/nombre/i);
    const descInput = screen.getByLabelText(/descripción/i);
    const stockInput = screen.getByLabelText(/cantidad inicial/i);
    const prefixInput = screen.getByLabelText(/prefijo.*2-4 letras/i);
    const priceInput = screen.getByLabelText(/precio de venta/i);

    fireEvent.change(nameInput, { target: { value: "Jabón de Avena y Arroz" } });
    fireEvent.change(descInput, { target: { value: "Jabón artesanal exfoliante" } });
    fireEvent.change(stockInput, { target: { value: "50" } });
    fireEvent.change(prefixInput, { target: { value: "AA" } });
    fireEvent.change(priceInput, { target: { value: "1500" } });

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith({
        name: "Jabón de Avena y Arroz",
        description: "Jabón artesanal exfoliante",
        stock: 50,
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
      stock: 10,
      price: 500,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(<ProductForm product={product} onClose={() => {}} />);

    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Producto Existente");
    expect(screen.getByLabelText(/descripción/i)).toHaveValue("Descripción existente");
    expect(screen.getByLabelText(/cantidad inicial/i)).toHaveValue(10);
    expect(screen.getByLabelText(/código/i)).toHaveValue("EX001");
    expect(screen.getByLabelText(/prefijo/i)).toHaveValue("EX");
    expect(screen.getByLabelText(/precio de venta/i)).toHaveValue(500);
    expect(screen.getByRole("button", { name: /actualizar producto/i })).toBeInTheDocument();
  });

  // NEW TESTS FOR onSuccess PROP
  it("calls onSuccess with created product and does NOT call router.refresh when onSuccess is provided", async () => {
    const onSuccessMock = jest.fn();
    const onCloseMock = jest.fn();
    const mockRefresh = jest.fn();
    
    // Override the mocked useRouter to return our refresh mock
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
      // Verify onSuccess was called with the created product
      expect(onSuccessMock).toHaveBeenCalledWith({
        id: 1,
        name: "Test",
        description: null,
        stock: 0,
        price: 0,
        code: "TS000",
        codePrefix: "TS",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      
      // Verify onClose was called
      expect(onCloseMock).toHaveBeenCalled();
      
      // Verify router.refresh was NOT called
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  it("calls router.refresh when onSuccess is NOT provided (backward compatibility)", async () => {
    const onCloseMock = jest.fn();
    const mockRefresh = jest.fn();
    
    // Override the mocked useRouter to return our refresh mock
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      refresh: mockRefresh,
    });

    render(
      <ProductForm 
        product={null} 
        onClose={onCloseMock} 
        // No onSuccess prop - should use default behavior
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
      // Verify onClose was called
      expect(onCloseMock).toHaveBeenCalled();
      
      // Verify router.refresh WAS called (backward compatibility)
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
      stock: 10,
      price: 500,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUpdateProduct.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        name: "Producto Actualizado",
        description: "Descripción existente",
        stock: 10,
        price: 500,
        code: "EX001",
        codePrefix: "EX",
        createdAt: existingProduct.createdAt,
        updatedAt: existingProduct.updatedAt,
      },
    });

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
      // Verify onSuccess was called with the updated product
      expect(onSuccessMock).toHaveBeenCalledWith({
        id: 1,
        name: "Producto Actualizado",
        description: "Descripción existente",
        stock: 10,
        price: 500,
        code: "EX001",
        codePrefix: "EX",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      
      // Verify onClose was called
      expect(onCloseMock).toHaveBeenCalled();
      
      // Verify router.refresh was NOT called
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });
});