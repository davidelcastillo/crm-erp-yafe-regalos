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

import { createProduct, updateProduct } from "../../actions/product";

const mockCreateProduct = createProduct as jest.MockedFunction<typeof createProduct>;
const mockUpdateProduct = updateProduct as jest.MockedFunction<typeof updateProduct>;

describe("ProductForm Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateProduct.mockResolvedValue({ success: true, data: { id: 1, name: "Test", description: null, stock: 0, createdAt: new Date(), updatedAt: new Date() } });
  });

  it("renders form fields correctly", () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cantidad inicial/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear producto/i })).toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
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

    fireEvent.change(nameInput, { target: { value: "Jabón de Avena y Arroz" } });
    fireEvent.change(descInput, { target: { value: "Jabón artesanal exfoliante" } });
    fireEvent.change(stockInput, { target: { value: "50" } });

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith({
        name: "Jabón de Avena y Arroz",
        description: "Jabón artesanal exfoliante",
        stock: 50,
      });
    });
  });

  it("displays error message when createProduct fails", async () => {
    mockCreateProduct.mockResolvedValue({ success: false, error: "El nombre es requerido" });

    render(<ProductForm product={null} onClose={() => {}} />);

    const nameInput = screen.getByLabelText(/nombre/i);
    fireEvent.change(nameInput, { target: { value: "Test" } });

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/el nombre es requerido/i)).toBeInTheDocument();
    });
  });

  it("prefills form when editing an existing product", () => {
    const product = {
      id: 1,
      name: "Producto Existente",
      description: "Descripción existente",
      stock: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(<ProductForm product={product} onClose={() => {}} />);

    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Producto Existente");
    expect(screen.getByLabelText(/descripción/i)).toHaveValue("Descripción existente");
    expect(screen.getByLabelText(/cantidad inicial/i)).toHaveValue(10);
    expect(screen.getByRole("button", { name: /actualizar producto/i })).toBeInTheDocument();
  });
});