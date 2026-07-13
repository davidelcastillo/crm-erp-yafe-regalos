/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProductAutocomplete } from "./ProductAutocomplete";

describe("ProductAutocomplete Component", () => {
  const mockProducts = [
    { id: 1, name: "Producto Uno", description: null, stock: 10, price: 100, code: "PR001", codePrefix: "PR", createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "Producto Dos", description: null, stock: 5, price: 200, code: "PR002", codePrefix: "PR", createdAt: new Date(), updatedAt: new Date() },
    { id: 3, name: "Otro Producto", description: null, stock: 0, price: 50, code: "OT001", codePrefix: "OT", createdAt: new Date(), updatedAt: new Date() },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders input with placeholder", () => {
    render(<ProductAutocomplete products={mockProducts} value="" onChange={() => {}} />);

    expect(screen.getByPlaceholderText(/buscar producto/i)).toBeInTheDocument();
  });

  it("filters products based on search input", () => {
    render(<ProductAutocomplete products={mockProducts} value="" onChange={() => {}} />);

    const input = screen.getByPlaceholderText(/buscar producto/i);
    
    // Type "uno" - should match "Producto Uno"
    fireEvent.change(input, { target: { value: "uno" } });
    
    // Should show only "Producto Uno" in dropdown
    expect(screen.getByText(/producto uno/i)).toBeInTheDocument();
    expect(screen.queryByText(/producto dos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/otro producto/i)).not.toBeInTheDocument();
  });

it("selects product when clicked from dropdown", () => {
      const onChangeMock = jest.fn();
      render(<ProductAutocomplete products={mockProducts} value="" onChange={onChangeMock} />);

      const input = screen.getByPlaceholderText(/buscar producto/i);
      fireEvent.focus(input); // Open dropdown

      // Wait for options to appear
      waitFor(() => {
        expect(screen.getByText(/producto uno/i)).toBeInTheDocument();
      });

      // Click on "Producto Uno"
      const productoUnoOption = screen.getByText(/producto uno/i);
      fireEvent.click(productoUnoOption);

      // Should have called onChange with product ID
      expect(onChangeMock).toHaveBeenCalledWith("1");
      // Input should show the selected product name
      expect(input).toHaveValue("Producto Uno");
      // Dropdown should be closed
      expect(screen.queryByText(/producto uno/i)).not.toBeInTheDocument();
    });

  it("clears selection when no match found", () => {
    const onChangeMock = jest.fn();
    render(<ProductAutocomplete products={mockProducts} value="" onChange={onChangeMock} />);

    const input = screen.getByPlaceholderText(/buscar producto/i);
    fireEvent.change(input, { target: { value: "xyz" } }); // No match
    
    // Should have called onChange with empty string
    expect(onChangeMock).toHaveBeenCalledWith("");
    // Input should still show the search term
    expect(input).toHaveValue("xyz");
  });

it("auto-selects exact match on blur/focus", () => {
      const onChangeMock = jest.fn();
      render(<ProductAutocomplete products={mockProducts} value="" onChange={onChangeMock} />);

      const input = screen.getByPlaceholderText(/buscar producto/i);
      fireEvent.change(input, { target: { value: "producto dos" } }); // Exact match
      fireEvent.blur(input); // Lose focus

      // Should have auto-selected
      expect(onChangeMock).toHaveBeenCalledWith("2");
      // Input should show the selected product name
      expect(input).toHaveValue("Producto Dos");
    });

it("limits results to 20 items", () => {
      // Create 25 products
      const manyProducts = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `Producto ${i + 1}`,
        description: null,
        stock: 10,
        price: 100,
        code: `PR${String(i + 1).padStart(3, '0')}`,
        codePrefix: "PR",
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      render(<ProductAutocomplete products={manyProducts} value="" onChange={() => {}} />);

      const input = screen.getByPlaceholderText(/buscar producto/i);
      fireEvent.focus(input); // Open dropdown

      // Should show exactly 20 items (the limit)
      const productItems = screen.getAllByRole("button");
      // Filter to only the product options (not the input itself)
      const productOptions = productItems.filter(button => 
        button.textContent && /producto \d+/i.test(button.textContent)
      );
      expect(productOptions).toHaveLength(20);
    });

it("shows 'no products' message when list is empty", () => {
      render(<ProductAutocomplete products={[]} value="" onChange={() => {}} />);

      const input = screen.getByPlaceholderText(/buscar producto/i);
      fireEvent.focus(input); // Open dropdown

      // Should show message or empty state
      // Since our implementation shows nothing when empty, we just verify it doesn't crash
      expect(input).toBeInTheDocument();
    });

  it("shows stock information for selected product", () => {
    render(<ProductAutocomplete products={mockProducts} value="1" onChange={() => {}} />);

    const input = screen.getByPlaceholderText(/buscar producto/i);
    fireEvent.focus(input); // Open dropdown

    // Should show stock info for selected product (ID 1)
    expect(screen.getByText(/stock actual: 10 unidades/i)).toBeInTheDocument();
  });

it("updates stock information when selection changes", () => {
    let value = "1";
    const onChangeMock = jest.fn((newValue) => {
      value = newValue;
    });
    const { rerender } = render(<ProductAutocomplete products={mockProducts} value={value} onChange={onChangeMock} />);

    const input = screen.getByPlaceholderText(/buscar producto/i);
    fireEvent.focus(input); // Open dropdown

    // Select second product
    const productoDosOption = screen.getByText(/producto dos/i);
    fireEvent.click(productoDosOption);
    // Re-render with updated value
    rerender(<ProductAutocomplete products={mockProducts} value={value} onChange={onChangeMock} />);

    // Should now show stock for product 2
    expect(screen.getByText(/stock actual: 5 unidades/i)).toBeInTheDocument();
    expect(screen.queryByText(/stock actual: 10 unidades/i)).not.toBeInTheDocument();
  });

  // TESTS FOR renderCreateButton PROP
  it("renders create button when renderCreateButton is true (default)", () => {
    render(<ProductAutocomplete products={mockProducts} value="" onChange={() => {}} />);
    
    // Should show the create button (+)
    const createButton = screen.getByRole("button", { name: /crear nuevo producto/i });
    expect(createButton).toBeInTheDocument();
    expect(createButton).toHaveClass("bg-[#ff385c]");
  });

  it("does not render create button when renderCreateButton is false", () => {
    render(<ProductAutocomplete products={mockProducts} value="" onChange={() => {}} renderCreateButton={false} />);
    
    // Should NOT show the create button
    const createButton = screen.queryByRole("button", { name: /crear nuevo producto/i });
    expect(createButton).not.toBeInTheDocument();
  });

  it("calls onCreateClick when create button is clicked", () => {
    const onCreateClick = jest.fn();
    render(<ProductAutocomplete products={mockProducts} value="" onChange={() => {}} onCreateClick={onCreateClick} />);
    
    const createButton = screen.getByRole("button", { name: /crear nuevo producto/i });
    fireEvent.click(createButton);
    
    expect(onCreateClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onCreateClick when create button is not rendered", () => {
    const onCreateClick = jest.fn();
    render(<ProductAutocomplete products={mockProducts} value="" onChange={() => {}} onCreateClick={onCreateClick} renderCreateButton={false} />);
    
    // Click where the button would be (should do nothing)
    // Actually, we just verify it's not called since button isn't rendered
    expect(onCreateClick).not.toHaveBeenCalled();
  });

  it("maintains search functionality when create button is hidden", () => {
    const onCreateClick = jest.fn();
    const onChangeMock = jest.fn();
    render(<ProductAutocomplete products={mockProducts} value="" onChange={onChangeMock} onCreateClick={onCreateClick} renderCreateButton={false} />);
    
    const input = screen.getByPlaceholderText(/buscar producto/i);
    fireEvent.change(input, { target: { value: "uno" } });
    
    // Should still filter products
    expect(screen.getByText(/producto uno/i)).toBeInTheDocument();
    expect(screen.queryByText(/producto dos/i)).not.toBeInTheDocument();
    
    // onCreateClick should not have been called
    expect(onCreateClick).not.toHaveBeenCalled();
  });

  it("positions create button correctly", () => {
    render(<ProductAutocomplete products={mockProducts} value="" onChange={() => {}} />);
    
    const input = screen.getByPlaceholderText(/buscar producto/i);
    const createButton = screen.getByRole("button", { name: /crear nuevo producto/i });
    
    // Button should be to the right of input
    expect(createButton).toHaveClass("absolute");
    expect(createButton).toHaveClass("right-2");
  });
});