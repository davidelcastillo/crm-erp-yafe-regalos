/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Product } from "@prisma/client";
import { AddPurchaseButton } from "./AddPurchaseButton";

// Mock the actions - CORRECTED: getProducts is from product actions, not purchase
jest.mock("../../actions/purchase", () => ({
  registerPurchase: jest.fn(),
  createPurchaseWithBranchSplit: jest.fn(),
}));
jest.mock("../../actions/product", () => ({
  getProducts: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
}));

// Mock auth action (getUser) — used to send performedBy with the purchase
jest.mock("@/actions/auth", () => ({
  getUser: jest.fn(),
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

// Mock BranchContext - AddPurchaseButton now requires a selected branch
jest.mock("@/lib/context/BranchContext", () => ({
  useBranch: jest.fn(() => ({
    branchId: 1,
    branch: { id: 1, name: "Principal" },
    branches: [{ id: 1, name: "Principal" }],
    ready: true,
    setBranchId: jest.fn(),
    refreshBranches: jest.fn(),
  })),
}));

import { registerPurchase, createPurchaseWithBranchSplit } from "../../actions/purchase";
import { getProducts, createProduct, updateProduct } from "../../actions/product";
import { getUser } from "@/actions/auth";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

const mockRegisterPurchase = registerPurchase as jest.MockedFunction<typeof registerPurchase>;
const mockCreatePurchaseWithBranchSplit = createPurchaseWithBranchSplit as jest.MockedFunction<typeof createPurchaseWithBranchSplit>;
const mockGetProducts = getProducts as jest.MockedFunction<typeof getProducts>;
const mockCreateProduct = createProduct as jest.MockedFunction<typeof createProduct>;
const mockUpdateProduct = updateProduct as jest.MockedFunction<typeof updateProduct>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;

describe("AddPurchaseButton Component", () => {
  const mockProducts = [
    { id: 1, name: "Producto 1", description: null, stock: 10, price: 100, code: "PR001", codePrefix: "PR", createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "Producto 2", description: null, stock: 5, price: 200, code: "PR002", codePrefix: "PR", createdAt: new Date(), updatedAt: new Date() },
  ] as unknown as Product[];

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
    } as never);
    mockCreatePurchaseWithBranchSplit.mockResolvedValue({ success: true } as never);
    mockGetProducts.mockResolvedValue({ 
      success: true, 
      data: [...mockProducts] 
    } as never);
    // Mock product creation actions to succeed by default
    mockCreateProduct.mockResolvedValue({ success: true } as never);
    mockUpdateProduct.mockResolvedValue({ success: true } as never);
    mockGetUser.mockResolvedValue(null);
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      refresh: jest.fn(),
    } as never);
  });

  it("renders purchase form with initial empty item", () => {
    render(<AddPurchaseButton products={[]} />);

    // Should show the "Registrar compra" button
    expect(screen.getByRole("button", { name: /registrar compra/i })).toBeInTheDocument();
  });

  it("shows the 'sección Inventario' copy when there are 0 registered products", () => {
    render(<AddPurchaseButton products={[]} />);

    fireEvent.click(screen.getByLabelText(/registrar compra/i));

    expect(screen.getByText(/no hay productos registrados/i)).toBeInTheDocument();
    expect(screen.getByText(/sección Inventario/i)).toBeInTheDocument();
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
    const backdrop = document.body.querySelector('.fixed.inset-0.bg-scrim.backdrop-blur-md');
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
        confirmButtonColor: "#6d28d9",
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
    mockSwalFire.mockResolvedValueOnce({ isConfirmed: false } as never);

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
        confirmButtonColor: "#6d28d9",
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
    
    // Submit the form directly (bypasses jsdom native constraint validation
    // on the required branch/price/quantity fields so the handler runs)
    const form = document.querySelector('form');
    fireEvent.submit(form!);
    
    // Expect Swal.fire to have been called with the error message
    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          text: 'Por favor agregá al menos un producto',
          icon: 'error',
          confirmButtonColor: '#dc2626',
        })
      );
    });
    
    // Should not have called registerPurchase nor createPurchaseWithBranchSplit
    expect(mockRegisterPurchase).not.toHaveBeenCalled();
    expect(mockCreatePurchaseWithBranchSplit).not.toHaveBeenCalled();
  });

  it("successfully registers purchase and resets form", async () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // Select first product via autocomplete
    const autocompleteInput = screen.getAllByPlaceholderText(/buscar producto/i)[0];
    fireEvent.change(autocompleteInput, { target: { value: "Producto 1" } });
    // Wait for option and click it (the option is a button with name + code)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /producto 1/i })).toBeInTheDocument();
    });
    const producto1Option = screen.getByRole("button", { name: /producto 1/i });
    fireEvent.click(producto1Option);
    
    // Select the branch (required since Phase 3 added per-branch inventory)
    const branchSelect = screen.getAllByLabelText(/sucursal/i)[0];
    fireEvent.change(branchSelect, { target: { value: "1" } });
    
    // Set quantity and price
    const priceInputs = screen.getAllByLabelText(/precio/i);
    const qtyInputs = screen.getAllByLabelText(/cantidad/i);
    fireEvent.change(priceInputs[0], { target: { value: "100" } });
    fireEvent.change(qtyInputs[0], { target: { value: "2" } });
    
    // Submit
    const totals = screen.getAllByText(/\$200\.00/i); // 2 * 100 = 200 (subtotal + total)
    expect(totals.length).toBeGreaterThan(0);
    
    // Submit the form directly (bypasses jsdom native constraint validation)
    const form = document.querySelector('form');
    fireEvent.submit(form!);
    
    // Expect Swal.fire to have been called with the success message
    // (async: wait for the mocked createPurchaseWithBranchSplit to resolve)
    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Compra registrada',
          text: expect.stringMatching(/2 unidades agregadas al inventario/),
          icon: 'success',
          confirmButtonColor: "#6d28d9",
          confirmButtonText: 'Aceptar',
          background: '#ffffff',
          color: '#222222',
        })
      );
    });
    
    // Wait for the form to reset
    await waitFor(() => {
      // Should have called createPurchaseWithBranchSplit
      expect(mockCreatePurchaseWithBranchSplit).toHaveBeenCalledWith({
        items: [
          {
            productId: 1,
            branchId: 1,
            quantity: 2,
            price: 100,
          }
        ],
      });
      // The purchase modal closes after a successful registration
      expect(screen.queryByText(/nueva compra/i)).not.toBeInTheDocument();
    });
  });
});

// Additional test for the new inline product creation functionality
describe("AddPurchaseButton - Inline Product Creation", () => {
  const mockProducts = [
    { id: 1, name: "Producto 1", description: null, stock: 10, price: 100, code: "PR001", codePrefix: "PR", createdAt: new Date(), updatedAt: new Date() },
  ] as unknown as Product[];

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterPurchase.mockResolvedValue({ success: true } as never);
    mockGetProducts.mockResolvedValue({ 
      success: true, 
      data: [...mockProducts] 
    } as never);
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
    const backdrop = document.body.querySelector('.fixed.inset-0.bg-scrim-strong.backdrop-blur-sm');
    if (backdrop) {
      fireEvent.click(backdrop);
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
        screen.getByRole("button", { name: /producto 1/i })
      ).toBeInTheDocument();
    });
    const producto1Option = screen.getByRole("button", {
      name: /producto 1/i,
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
    } as never);
    // Mock createProduct to return the created product
    mockCreateProduct.mockResolvedValueOnce({ 
      success: true,
      data: { 
        id: 3, 
        name: "Nuevo Producto", 
        description: null, 
        stock: 5, 
        price: 75, 
        code: "NP001", 
        codePrefix: "NP", 
        createdAt: new Date(), 
        updatedAt: new Date() 
      }
    } as never);
    
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
        screen.getByRole("button", { name: (content) => 
          /producto 1/i.test(content)
        })
      ).toBeInTheDocument();
    });
    const producto1Option = screen.getByRole("button", { 
      name: (content) => 
        /producto 1/i.test(content)
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
    // Clear the search to show all options (the dropdown opens on input change)
    fireEvent.change(autocompleteInput, { target: { value: "" } });
    
    // Should see the new product option in the dropdown (name + code)
    const nuevoProductoOption = screen.getByRole("button", { name: /nuevo producto.*np001/i });
    expect(nuevoProductoOption).toBeInTheDocument();
    
    // Select the new product
    fireEvent.click(nuevoProductoOption);
    
    // The autocomplete should now show the new product
    expect(autocompleteInput).toHaveValue("Nuevo Producto");
  });

  it("closes product creation modal after creation even if product refresh fails", async () => {
    // Mock getProducts to fail after successful product creation
    mockGetProducts.mockResolvedValueOnce({ 
      success: false, 
      error: "Error al obtener productos" 
    });
    // Mock createProduct to return the product (so the form submits successfully)
    mockCreateProduct.mockResolvedValueOnce({ 
      success: true,
      data: { 
        id: 3, 
        name: "Nuevo Producto", 
        description: null, 
        stock: 5, 
        price: 75, 
        code: "NP001", 
        codePrefix: "NP", 
        createdAt: new Date(), 
        updatedAt: new Date() 
      }
    } as never);
    
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
    
    // The product creation modal closes (the product was created), and the
    // purchase modal stays open underneath.
    await waitFor(() => {
      expect(screen.queryByText(/crear producto para edición/i)).not.toBeInTheDocument();
      expect(screen.getByText(/nueva compra/i)).toBeInTheDocument();
    });
  });

  it("mantiene objetivos táctiles adecuados en celular", () => {
    render(<AddPurchaseButton products={mockProducts} />);
    
    // Open purchase modal
    const openButton = screen.getByLabelText(/registrar compra/i);
    fireEvent.click(openButton);
    
    // El FAB mide 56px por `.btn-fab`, que es el que define su tamaño: el
    // componente ya no repite `w-14 h-14`.
    const fab = screen.getByLabelText(/registrar compra/i);
    expect(fab).toHaveClass("btn-fab");
    
    // Open product modal to check its controls
    const createButton = screen.getByRole("button", { name: /crear nuevo producto/i });
    fireEvent.click(createButton);
    
    // El ✕ del modal de producto es el ícono redondo del sistema: los 44 px de
    // alto y de ancho los pone el base, no el componente.
    const closeButtons = screen.getAllByRole("button", { name: /cerrar/i });
    if (closeButtons.length >= 2) {
      const productCloseButton = closeButtons[1]; // Segundo ✕ (el del modal de producto)
      expect(productCloseButton).toHaveClass("btn", "btn-icon", "btn-round");
      expect(productCloseButton).not.toHaveClass("min-h-[44px]");
      expect(productCloseButton).not.toHaveClass("min-w-[44px]");
    }

    // Check input fields have adequate touch targets
    const priceInput = screen.getAllByLabelText(/precio/i)[0];
    expect(priceInput).toHaveClass("min-h-[48px]");
    
    const qtyInput = screen.getAllByLabelText(/cantidad/i)[0];
    expect(qtyInput).toHaveClass("min-h-[48px]");
  });

  // Sistema de botones (`globals.css`): el modal de compra tiene una sola acción
  // principal, el ✕ es el ícono cuadrado, la fila elimina con la destructiva y
  // «Agregar otro producto» es la alternativa neutra.
  it("usa las variantes del sistema en el modal de compra", () => {
    render(<AddPurchaseButton products={mockProducts} />);
    fireEvent.click(screen.getByLabelText(/registrar compra/i));

    const registrar = screen.getByText("Registrar Compra").closest("button");
    expect(registrar).toHaveClass("btn", "btn-primary");

    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveClass(
      "btn",
      "btn-icon",
      "btn-round"
    );

    expect(screen.getByRole("button", { name: /agregar otro producto/i })).toHaveClass(
      "btn",
      "btn-secondary"
    );

    // «Eliminar» aparece en la fila recién cuando hay más de una.
    fireEvent.click(screen.getByRole("button", { name: /agregar otro producto/i }));
    expect(screen.getAllByRole("button", { name: /eliminar/i })[0]).toHaveClass(
      "btn",
      "btn-danger"
    );
  });
});

// ---------------------------------------------------------------------------
// Hardening (FIX-FASE4 issue 3): functional setItems, stable ids, performedBy,
// single-flight submit
// ---------------------------------------------------------------------------
describe("AddPurchaseButton hardening (FIX-FASE4 issue 3)", () => {
  const mockProducts = [
    { id: 1, name: "Producto 1", description: null, stock: 10, price: 100, code: "PR001", codePrefix: "PR", createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "Producto 2", description: null, stock: 5, price: 200, code: "PR002", codePrefix: "PR", createdAt: new Date(), updatedAt: new Date() },
  ] as unknown as Product[];

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePurchaseWithBranchSplit.mockResolvedValue({ success: true } as never);
    mockGetProducts.mockResolvedValue({ success: true, data: [...mockProducts] } as never);
    mockGetUser.mockResolvedValue(null);
    mockUseRouter.mockReturnValue({ push: jest.fn(), refresh: jest.fn() } as never);
  });

  const openModal = () => {
    render(<AddPurchaseButton products={mockProducts} />);
    fireEvent.click(screen.getByLabelText(/registrar compra/i));
  };

  const fillValidItem = async () => {
    const autocompleteInput = screen.getAllByPlaceholderText(/buscar producto/i)[0];
    fireEvent.change(autocompleteInput, { target: { value: "Producto 1" } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /producto 1/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /producto 1/i }));

    const branchSelect = screen.getAllByLabelText(/sucursal/i)[0];
    fireEvent.change(branchSelect, { target: { value: "1" } });

    const priceInputs = screen.getAllByLabelText(/precio/i);
    const qtyInputs = screen.getAllByLabelText(/cantidad/i);
    fireEvent.change(priceInputs[0], { target: { value: "100" } });
    fireEvent.change(qtyInputs[0], { target: { value: "2" } });
  };

  it("updates rows with functional state updates (other rows keep their values)", () => {
    openModal();

    // Add two more rows
    const addButton = screen.getByRole("button", { name: /agregar otro producto/i });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    // Set row 0
    let priceInputs = screen.getAllByLabelText(/precio/i);
    let qtyInputs = screen.getAllByLabelText(/cantidad/i);
    fireEvent.change(priceInputs[0], { target: { value: "10" } });
    fireEvent.change(qtyInputs[0], { target: { value: "2" } });

    // Update only row 1
    priceInputs = screen.getAllByLabelText(/precio/i);
    fireEvent.change(priceInputs[1], { target: { value: "15" } });

    // Row 0 keeps its values, row 1 quantity untouched, row 2 untouched
    priceInputs = screen.getAllByLabelText(/precio/i);
    qtyInputs = screen.getAllByLabelText(/cantidad/i);
    expect(priceInputs[0]).toHaveValue(10);
    expect(qtyInputs[0]).toHaveValue(2);
    expect(priceInputs[1]).toHaveValue(15);
    expect(qtyInputs[1]).toHaveValue(null);
    expect(priceInputs[2]).toHaveValue(null);
  });

  it("assigns unique ids to rows added in the same millisecond", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);

    openModal();

    const addButton = screen.getByRole("button", { name: /agregar otro producto/i });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    // All 3 rows render (unique keys)
    expect(screen.getAllByPlaceholderText(/buscar producto/i)).toHaveLength(3);

    // No React duplicate-key warnings
    const keyWarnings = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).includes("same key")
    );
    expect(keyWarnings).toHaveLength(0);

    consoleErrorSpy.mockRestore();
    (Date.now as unknown as jest.SpyInstance).mockRestore();
  });

  it("sends performedBy (from getUser) with the purchase", async () => {
    mockGetUser.mockResolvedValue({ email: "admin@feriaconexx.com" });
    openModal();
    await fillValidItem();

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(mockCreatePurchaseWithBranchSplit).toHaveBeenCalledWith({
        items: [{ productId: 1, branchId: 1, quantity: 2, price: 100 }],
        performedBy: "admin@feriaconexx.com",
      });
    });
  });

  it("prevents double submit while a purchase is being sent", async () => {
    let resolveSubmit: (
      value: Awaited<ReturnType<typeof createPurchaseWithBranchSplit>>
    ) => void = () => {};
    mockCreatePurchaseWithBranchSplit.mockImplementationOnce(
      () =>
        new Promise<Awaited<ReturnType<typeof createPurchaseWithBranchSplit>>>(
          (resolve) => {
            resolveSubmit = resolve;
          }
        )
    );

    openModal();
    await fillValidItem();

    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    // Submit button disabled while sending
    expect(screen.getByRole("button", { name: /registrando/i })).toBeDisabled();

    // Wait for the first invocation so the single-flight window is open
    await waitFor(() => {
      expect(mockCreatePurchaseWithBranchSplit).toHaveBeenCalledTimes(1);
    });

    // Programmatic second submit is ignored (single-flight guard)
    fireEvent.submit(form);
    expect(mockCreatePurchaseWithBranchSplit).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit({ success: true, data: {} } as Awaited<
        ReturnType<typeof createPurchaseWithBranchSplit>
      >);
    });

    await waitFor(() => {
      expect(screen.queryByText(/nueva compra/i)).not.toBeInTheDocument();
    });
  });
});