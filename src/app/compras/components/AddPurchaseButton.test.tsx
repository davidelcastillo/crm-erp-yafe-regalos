/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddPurchaseButton } from "./AddPurchaseButton";

// Mock the actions - CORRECTED: getProducts is from product actions, not purchase
jest.mock("../../actions/purchase", () => ({
  registerPurchase: jest.fn(),
}));
jest.mock("../../actions/product", () => ({
  getProducts: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
}));

// Mock next/navigation - FIXED: use jest.fn() so we can use .mockReturnValue()
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}));

// Mock SweetAlert2 - required since component uses it
jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

import { registerPurchase } from "../../actions/purchase";
import { getProducts, createProduct, updateProduct } from "../../actions/product";
import { useRouter } from "next/navigation";
import { ProductForm } from "@/app/productos/components/ProductForm";
import Swal from "sweetalert2";

const mockRegisterPurchase = registerPurchase as jest.MockedFunction<typeof registerPurchase>;
const mockGetProducts = getProducts as jest.MockedFunction<typeof getProducts>;
const mockCreateProduct = createProduct as jest.MockedFunction<typeof createProduct>;
const mockUpdateProduct = updateProduct as jest.MockedFunction<typeof updateProduct>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe("AddPurchaseButton Component", () => {
  const mockProducts = [
    { id: 1, name: "Producto 1", description: null, stock: 10, price: 100, code: "PR001", codePrefix: "PR", createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "Producto 2", description: null, stock: 5, price: 200, code: "PR002", codePrefix: "PR", createdAt: new Date(), updatedAt: new Date() },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterPurchase.mockResolvedValue({ 
      success: true, 
      data: { 
        id: 1, 
        date: new Date(),
        totalAmount: 500,
        items: [
          { 
            id: 1,
            purchaseId: 1,
            productId: 1,
            price: 100,
            quantity: 5,
            subtotal: 500,
            product: { id: 1, name: "Producto 1", description: null, stock: 10, price: 100 }
          }
        ]
      } 
    });
    mockGetProducts.mockResolvedValue({ 
      success: true, 
      data: [...mockProducts] 
    });
    // Mock product creation actions to succeed by default
    mockCreateProduct.mockResolvedValue({ success: true });
    mockUpdateProduct.mockResolvedValue({ success: true });
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      refresh: jest.fn(),
    });
  });

  it("renders purchase form with initial empty item", () => {
    render(<AddPurchaseButton products={[]} />);

    // Should show the "Registrar compra" button
    expect(screen.getByRole("button", { name: /registrar compra/i })).toBeInTheDocument();
  });

it("opens purchase modal when button is clicked", () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Use getByLabelText to specifically target the FAB by its aria-label
    const button = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(button);
    
    // Should show the modal title
    expect(screen.getByText(/nueva compra/i)).toBeInTheDocument();
    // Should show the autocomplete placeholder (not specific product label)
    expect(screen.getByPlaceholderText(/buscar producto/i)).toBeInTheDocument();
  });

it("closes purchase modal when clicking outside", async () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Verify modal is open
    expect(screen.getByText(/nueva compra/i)).toBeInTheDocument();
    
    // Click on backdrop (outside the modal content)
    const backdrop = document.body.querySelector('.fixed.inset-0.bg-black\\/60.backdrop-blur-sm');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    
    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByText(/nueva compra/i)).not.toBeInTheDocument();
    });
  });

  it("allows adding items to purchase", () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Click "Agregar otro producto"
    const addButton = screen.getByRole("button", { name: /agregar otro producto/i });
    fireEvent.click(addButton);
    
    // Should see two product autocomplete fields
    const autocompleteInputs = screen.getAllByPlaceholderText(/buscar producto/i);
    expect(autocompleteInputs).toHaveLength(2);
    // Should see two price inputs
    const priceInputs = screen.getAllByLabelText(/precio/i);
    expect(priceInputs).toHaveLength(2);
    // Should see two quantity inputs
    const qtyInputs = screen.getAllByLabelText(/cantidad/i);
    expect(qtyInputs).toHaveLength(2);
  });

  it("removes items from purchase with confirmation", async () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Add a second item
    const addButton = screen.getByRole("button", { name: /agregar otro producto/i });
    fireEvent.click(addButton);
    
    // Should have 2 items
    const autocompleteInputs = screen.getAllByPlaceholderText(/buscar producto/i);
    expect(autocompleteInputs).toHaveLength(2);
    
    // Click remove button - should show confirmation
    const removeButtons = screen.getAllByRole("button", { name: /eliminar/i });
    fireEvent.click(removeButtons[0]);
    
    // Expect Swal.fire to have been called with the confirmation dialog
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '¿Eliminar item?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff385c',
        cancelButtonColor: '#6a6a6a',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: '#ffffff',
        color: '#222222',
      })
    );
    
    // Since our mock resolves immediately with { isConfirmed: true },
    // the removeItem should have been called after the microtask.
    // Wait for the item to be removed.
    await waitFor(() => {
      const autocompleteInputs = screen.getAllByPlaceholderText(/buscar producto/i);
      expect(autocompleteInputs).toHaveLength(1);
    });
  });

  it("cancels item removal when clicking cancel in confirmation", async () => {
    // Mock Swal.fire to resolve with isConfirmed: false for this test
    const mockSwalFire = jest.spyOn(Swal, 'fire');
    mockSwalFire.mockResolvedValueOnce({ isConfirmed: false });

    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Add a second item
    const addButton = screen.getByRole("button", { name: /agregar otro producto/i });
    fireEvent.click(addButton);
    
    // Should have 2 items
    const autocompleteInputs = screen.getAllByPlaceholderText(/buscar producto/i);
    expect(autocompleteInputs).toHaveLength(2);
    
    // Click remove button - should show confirmation
    const removeButtons = screen.getAllByRole("button", { name: /eliminar/i });
    fireEvent.click(removeButtons[0]);
    
    // Expect Swal.fire to have been called with the confirmation dialog
    expect(mockSwalFire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '¿Eliminar item?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff385c',
        cancelButtonColor: '#6a6a6a',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: '#ffffff',
        color: '#222222',
      })
    );
    
    // Since our mock resolves with { isConfirmed: false }, the removeItem should not be called.
    // Wait a bit to ensure no removal happened.
    await waitFor(() => {
      const autocompleteInputs = screen.getAllByPlaceholderText(/buscar producto/i);
      expect(autocompleteInputs).toHaveLength(2);
    });
    
    // Clean up
    mockSwalFire.mockRestore();
  });

  it("calculates subtotal and total correctly", () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Verify modal is open
    expect(screen.getByText(/nueva compra/i)).toBeInTheDocument();
    
    // Set first item: 2 units at $10 each = $20
    // Find first price and quantity inputs
    const priceInputs = screen.getAllByLabelText(/precio/i);
    const qtyInputs = screen.getAllByLabelText(/cantidad/i);
    expect(priceInputs).toHaveLength(1); // initially one item
    expect(qtyInputs).toHaveLength(1);
    fireEvent.change(priceInputs[0], { target: { value: "10" } });
    fireEvent.change(qtyInputs[0], { target: { value: "2" } });
    
    // Should show $20 subtotal for first item
    const subtotals = screen.getAllByText(/\$20\.00/i);
    expect(subtotals[0]).toBeInTheDocument();
    
    // Add second item
    const addButton = screen.getByRole("button", { name: /agregar otro producto/i });
    fireEvent.click(addButton);
    
    // Wait for second item to appear
    waitFor(() => {
      expect(screen.getAllByLabelText(/precio/i)).toHaveLength(2);
      expect(screen.getAllByLabelText(/cantidad/i)).toHaveLength(2);
    });
    
    // Now we have two sets of inputs
    const priceInputsAfter = screen.getAllByLabelText(/precio/i);
    const qtyInputsAfter = screen.getAllByLabelText(/cantidad/i);
    fireEvent.change(priceInputsAfter[1], { target: { value: "15" } });
    fireEvent.change(qtyInputsAfter[1], { target: { value: "3" } });
    
    // Should show $45 subtotal for second item
    expect(screen.getAllByText(/\$45\.00/i)[0]).toBeInTheDocument();
    
    // Should show $65 total
    expect(screen.getByText(/\$65\.00/i)).toBeInTheDocument();
  });

  it("validates and shows error when submitting empty purchase", async () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Try to submit without selecting any product
    const submitButtons = screen.getAllByRole("button", { name: /registrar compra/i });
    const submitButton = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitButton);
    
    // Expect Swal.fire to have been called with the error message
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        text: 'Por favor agregá al menos un producto',
        icon: 'error',
        confirmButtonColor: '#ff385c',
      })
    );
    
    // Should not have called registerPurchase
    expect(mockRegisterPurchase).not.toHaveBeenCalled();
  });

  it("successfully registers purchase and resets form", async () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Select first product via autocomplete
    const autocompleteInput = screen.getAllByPlaceholderText(/buscar producto/i)[0];
    fireEvent.change(autocompleteInput, { target: { value: "Producto 1" } });
    // Wait for option and click it
    await waitFor(() => {
      expect(screen.getByText(/producto 1/i)).toBeInTheDocument();
    });
    const producto1Option = screen.getByText(/producto 1/i);
    fireEvent.click(producto1Option);
    
    // Set quantity and price
    const priceInputs = screen.getAllByLabelText(/precio/i);
    const qtyInputs = screen.getAllByLabelText(/cantidad/i);
    fireEvent.change(priceInputs[0], { target: { value: "100" } });
    fireEvent.change(qtyInputs[0], { target: { value: "2" } });
    
    // Submit
    const totalBefore = screen.getByText(/\$200\.00/i); // 2 * 100 = 200
    expect(totalBefore).toBeInTheDocument();
    
    // Submit
    const submitButtons = screen.getAllByRole("button", { name: /registrar compra/i });
    const submitButton = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitButton);
    
    // Expect Swal.fire to have been called with the success message
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Compra registrada',
        text: /2 unidades agregadas al inventario/, // we can be more precise but dynamic
        icon: 'success',
        confirmButtonColor: '#ff385c',
        confirmButtonText: 'Aceptar',
        background: '#ffffff',
        color: '#222222',
      })
    );
    
    // Wait for the form to reset
    await waitFor(() => {
      // Should have called registerPackage
      expect(mockRegisterPurchase).toHaveBeenCalledWith({
        items: [
          {
            productId: 1,
            price: 100,
            quantity: 2,
          }
        ]
      });
      // Should reset form - autocomplete should be empty
      expect(autocompleteInput).toHaveValue("");
      expect(priceInputs[0]).toHaveValue("");
      expect(qtyInputs[0]).toHaveValue("");
    });
  });
});

// Additional test for the new inline product creation functionality
describe("AddPurchaseButton - Inline Product Creation", () => {
  const mockProducts = [
    { id: 1, name: "Producto 1", description: null, stock: 10, price: 100, code: "PR001", codePrefix: "PR", createdAt: new Date(), updatedAt: new Date() },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterPurchase.mockResolvedValue({ success: true });
    mockGetProducts.mockResolvedValue({ 
      success: true, 
      data: [...mockProducts] 
    });
  });

it("opens product creation modal when '+ Nuevo producto' is clicked", () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open purchase modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Verify autocomplete is rendered
    const autocompleteInput = screen.getByPlaceholderText(/buscar producto/i);
    expect(autocompleteInput).toBeInTheDocument();
    
    // Click the "+ Nuevo producto" button
    const createButton = screen.getByRole("button", { name: /crear nuevo producto/i });
    expect(createButton).toBeInTheDocument();
    fireEvent.click(createButton);
    
    // Should open product creation modal - look for the specific title
    expect(screen.getByText(/crear producto para edición/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/prefijo.*2-4 letras/i)).toBeInTheDocument();
  });

it("closes product creation modal when clicking outside", () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open purchase modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Open product creation modal
    const createButton = screen.getByRole("button", { name: /crear nuevo producto/i });
    fireEvent.click(createButton);
    
    // Verify product modal is open - look for the specific create product title
    expect(screen.getByText(/crear producto para edición/i)).toBeInTheDocument();
    
    // Click on product modal backdrop (the dark background behind the modal)
    // The backdrop is the div with onClick handler that closes the modal
    const backdrop = document.body.querySelector('.fixed.inset-0.bg-black\\/60.backdrop-blur-sm');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    
    // Product modal should be closed
    expect(screen.queryByText(/crear producto para edición/i)).not.toBeInTheDocument();
    // Purchase modal should still be open
    expect(screen.getByText(/nueva compra/i)).toBeInTheDocument();
  });
      backdrop.dispatchEvent(event);
    }
    
    // Product modal should be closed
    expect(screen.queryByText(/crear producto para edición/i)).not.toBeInTheDocument();
    // Purchase modal should still be open
    expect(screen.getByText(/nueva compra/i)).toBeInTheDocument();
  });

  it("preserves purchase form state when product modal is open", async () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open purchase modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Add some data to purchase form
    const autocompleteInput = screen.getAllByPlaceholderText(/buscar producto/i)[0];
    fireEvent.change(autocompleteInput, { target: { value: "Producto 1" } });
    await waitFor(() => {
      // Look for the button that contains the product info
      expect(
        screen.getByRole("button", { name: /producto 1.*stock: 10/i })
      ).toBeInTheDocument();
    });
    const producto1Option = screen.getByRole("button", {
      name: /producto 1.*stock: 10/i,
    });
    fireEvent.click(producto1Option);
    
    const priceInputs = screen.getAllByLabelText(/precio/i);
    const qtyInputs = screen.getAllByLabelText(/cantidad/i);
    // Set values AFTER selecting the product
    fireEvent.change(priceInputs[0], { target: { value: "150" } });
    fireEvent.change(qtyInputs[0], { target: { value: "3" } });
    
    // Verify values are set
    expect(priceInputs[0]).toHaveValue(150); // Number input values are numbers
    expect(qtyInputs[0]).toHaveValue(3);     // Number input values are numbers
    
    // Open product modal
    const createButton = screen.getByRole("button", { name: /crear nuevo producto/i });
    fireEvent.click(createButton);
    
    // Purchase form values should still be there (preserved)
    expect(priceInputs[0]).toHaveValue(150);
    expect(qtyInputs[0]).toHaveValue(3);
    
    // Close product modal (click close button)
    const closeButtons = screen.getAllByRole("button", { name: /cerrar/i });
    if (closeButtons.length >= 2) {
      fireEvent.click(closeButtons[1]); // Second close button is for product modal
    }
    
    // Values should still be preserved
    expect(priceInputs[0]).toHaveValue(150);
    expect(qtyInputs[0]).toHaveValue(3);
  });

  it("updates product selection after successful inline creation", async () => {
    // Mock getProducts to return the original products plus a new one
    mockGetProducts.mockResolvedValueOnce({ 
      success: true, 
      data: [
        ...mockProducts,
        { id: 3, name: "Nuevo Producto", description: null, stock: 5, price: 75, code: "NP001", codePrefix: "NP", createdAt: new Date(), updatedAt: new Date() }
      ]
    });
    // Mock createProduct to return the created product
    mockCreateProduct.mockResolvedValueOnce({ 
      id: 3, 
      name: "Nuevo Producto", 
      description: null, 
      stock: 5, 
      price: 75, 
      code: "NP001", 
      codePrefix: "NP", 
      createdAt: new Date(), 
      updatedAt: new Date() 
    });
    
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open purchase modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Set initial values for the item
    const autocompleteInput = screen.getAllByPlaceholderText(/buscar producto/i)[0];
    fireEvent.change(autocompleteInput, { target: { value: "Producto 1" } });
    // Wait for option and click it - FIXED: look for the button with product info using a function matcher
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: (content, element) => 
          /producto 1.*stock: 10/i.test(content)
        })
      ).toBeInTheDocument();
    });
    const producto1Option = screen.getByRole("button", { 
      name: (content, element) => 
        /producto 1.*stock: 10/i.test(content)
    });
    fireEvent.click(producto1Option);
    
    const priceInputs = screen.getAllByLabelText(/precio/i);
    const qtyInputs = screen.getAllByLabelText(/cantidad/i);
    fireEvent.change(priceInputs[0], { target: { value: "100" } });
    fireEvent.change(qtyInputs[0], { target: { value: "2" } });
    
    // Open product creation modal
    const createButton = screen.getByRole("button", { name: /crear nuevo producto/i });
    fireEvent.click(createButton);
    
    // Fill in product creation form
    const nameInput = screen.getByLabelText(/nombre/i);
    const prefixInput = screen.getByLabelText(/prefijo.*2-4 letras/i);
    const priceInputProd = screen.getByLabelText(/precio de venta/i);
    
    fireEvent.change(nameInput, { target: { value: "Nuevo Producto" } });
    fireEvent.change(prefixInput, { target: { value: "NP" } });
    fireEvent.change(priceInputProd, { target: { value: "75" } });
    
    // Submit product form
    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);
    
    // Wait for product creation to complete and modal to close
    await waitFor(() => {
      // Product creation modal should be closed
      expect(screen.queryByText(/crear producto para edición/i)).not.toBeInTheDocument();
      
      // Purchase modal should still be open
      expect(screen.getByText(/nueva compra/i)).toBeInTheDocument();
    });
    
    // The autocomplete should now allow selecting the newly created product
    // Click the autocomplete to open dropdown
    fireEvent.click(autocompleteInput);
    
    // Should see the new product in the dropdown - use function matcher for text that might be split
    expect(
      screen.getByText((content, element) => 
        /nuevo producto/i.test(content)
      )
    ).toBeInTheDocument();
    
    // Select the new product
    const nuevoProductoOption = screen.getByText((content, element) => 
      /nuevo producto/i.test(content)
    );
    fireEvent.click(nuevoProductoOption);
    
    // The autocomplete should now show the new product
    expect(autocompleteInput).toHaveValue("Nuevo Producto");
  });

  it("handles error during product creation (keeps modal open)", async () => {
    // Mock ProductForm's onSuccess to throw an error by making getProducts fail after successful product creation
    mockGetProducts.mockResolvedValueOnce({ 
      success: false, 
      error: "Error al obtener productos" 
    });
    // Mock createProduct to return the product (so the form submits successfully)
    mockCreateProduct.mockResolvedValueOnce({ 
      id: 3, 
      name: "Nuevo Producto", 
      description: null, 
      stock: 5, 
      price: 75, 
      code: "NP001", 
      codePrefix: "NP", 
      createdAt: new Date(), 
      updatedAt: new Date() 
    });
    
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open purchase modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Open product creation modal
    const createButton = screen.getByRole("button", { name: /crear nuevo producto/i });
    fireEvent.click(createButton);
    
    // Fill in product creation form with valid data
    const nameInput = screen.getByLabelText(/nombre/i);
    const prefixInput = screen.getByLabelText(/prefijo.*2-4 letras/i);
    const priceInputProd = screen.getByLabelText(/precio de venta/i);
    
    fireEvent.change(nameInput, { target: { value: "Nuevo Producto" } });
    fireEvent.change(prefixInput, { target: { value: "NP" } });
    fireEvent.change(priceInputProd, { target: { value: "75" } });
    
    // Submit product form
    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);
    
    // Should show error and keep modal open
    await waitFor(() => {
      // Error should be shown from SweetAlert2 (since getProducts failed)
      expect(
        screen.getByText((node, text) => 
          /error al obtener productos/i.test(text)
        )
      ).toBeInTheDocument();
      // Product creation modal should still be open
      expect(screen.getByText(/crear producto para edición/i)).toBeInTheDocument();
      // Purchase modal should still be open underneath
      expect(screen.getByText(/nueva compra/i)).toBeInTheDocument();
    });
  });

  it("has adequate touch targets for mobile", () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open purchase modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Check FAB (Floating Action Button) - should be at least 44x48
    const fab = screen.getByLabelText(/registrar compra/i);
    expect(fab).toHaveClass("w-14"); // 56px width
    expect(fab).toHaveClass("h-14"); // 56px height
    
    // Open product modal to check its controls
    const createButton = screen.getByRole("button", { name: /crear nuevo producto/i });
    fireEvent.click(createButton);
    
    // Check product modal close button - should be at least 44x48
    const closeButtons = screen.getAllByRole("button", { name: /cerrar/i });
    if (closeButtons.length >= 2) {
      const productCloseButton = closeButtons[1]; // Second close button
      expect(productCloseButton).toHaveClass("w-11"); // 44px width (11 * 4 = 44)
      expect(productCloseButton).toHaveClass("h-11"); // 44px height (11 * 4 = 44)
      // Also has min-w-[44px] and min-h-[44px] from our implementation
    }
    
    // Check input fields have adequate touch targets
    const priceInput = screen.getAllByLabelText(/precio/i)[0];
    expect(priceInput).toHaveClass("min-h-[48px]");
    
    const qtyInput = screen.getAllByLabelText(/cantidad/i)[0];
    expect(qtyInput).toHaveClass("min-h-[48px]");
  });
});