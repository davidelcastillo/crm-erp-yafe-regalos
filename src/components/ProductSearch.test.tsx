import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ProductSearch } from "./ProductSearch";
import { searchProducts } from '@/app/actions/product';

// Mock searchProducts
jest.mock("@/actions/product", () => ({
  searchProducts: jest.fn(),
}));

const mockSearchProducts = searchProducts as jest.MockedFunction<typeof searchProducts>;

describe("ProductSearch Component", () => {
  const mockResults = [
    { id: 1, code: "AA001", name: "Jabón de Avena", price: 1500, stock: 10 },
    { id: 2, code: "AA002", name: "Jabón de Glicerina", price: 1200, stock: 5 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Inline Mode", () => {
    it("renders search input", () => {
      const onSelect = jest.fn();
      render(<ProductSearch mode="inline" onSelect={onSelect} />);
      
      expect(screen.getByPlaceholderText("Buscar producto por código o nombre...")).toBeInTheDocument();
    });

    it("calls searchProducts after debounce", async () => {
      mockSearchProducts.mockResolvedValue({ success: true, data: mockResults });
      const onSelect = jest.fn();
      render(<ProductSearch mode="inline" onSelect={onSelect} />);

      const input = screen.getByPlaceholderText("Buscar producto por código o nombre...");
      fireEvent.change(input, { target: { value: "AA" } });
      
      // Fast-forward debounce
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(mockSearchProducts).toHaveBeenCalledWith({ query: "AA" });
    });

    it("does not call searchProducts for empty query", async () => {
      mockSearchProducts.mockResolvedValue({ success: true, data: mockResults });
      const onSelect = jest.fn();
      render(<ProductSearch mode="inline" onSelect={onSelect} />);

      const input = screen.getByPlaceholderText("Buscar producto por código o nombre...");
      fireEvent.change(input, { target: { value: "   " } });
      
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(mockSearchProducts).not.toHaveBeenCalled();
    });

    it("shows loading state", async () => {
      let resolveSearch: (value: any) => void;
      mockSearchProducts.mockImplementation(() => new Promise((resolve) => {
        resolveSearch = resolve;
      }));
      
      const onSelect = jest.fn();
      render(<ProductSearch mode="inline" onSelect={onSelect} />);

      const input = screen.getByPlaceholderText("Buscar producto por código o nombre...");
      fireEvent.change(input, { target: { value: "AA" } });
      
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(screen.getByText("Buscando...")).toBeInTheDocument();
      
      resolveSearch!({ success: true, data: mockResults });
      await act(async () => {
        await Promise.resolve();
      });
    });

    it("displays max 10 results", async () => {
      const manyResults = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        code: `PR${String(i).padStart(3, "0")}`,
        name: `Product ${i}`,
        price: 100,
        stock: 10,
      }));
      
      mockSearchProducts.mockResolvedValue({ success: true, data: manyResults });
      const onSelect = jest.fn();
      render(<ProductSearch mode="inline" onSelect={onSelect} />);

      const input = screen.getByPlaceholderText("Buscar producto por código o nombre...");
      fireEvent.change(input, { target: { value: "P" } });
      
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      // Should only render 10 items
      const items = screen.getAllByRole("option");
      expect(items).toHaveLength(10);
    });

    it("shows error state", async () => {
      mockSearchProducts.mockResolvedValue({ success: false, error: "DB Error" });
      const onSelect = jest.fn();
      render(<ProductSearch mode="inline" onSelect={onSelect} />);

      const input = screen.getByPlaceholderText("Buscar producto por código o nombre...");
      fireEvent.change(input, { target: { value: "AA" } });
      
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(screen.getByText("DB Error")).toBeInTheDocument();
    });

    it("calls onSelect when item clicked", async () => {
      mockSearchProducts.mockResolvedValue({ success: true, data: mockResults });
      const onSelect = jest.fn();
      render(<ProductSearch mode="inline" onSelect={onSelect} />);

      const input = screen.getByPlaceholderText("Buscar producto por código o nombre...");
      fireEvent.change(input, { target: { value: "AA" } });
      
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      fireEvent.click(screen.getByText("Jabón de Avena"));
      
      expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
    });
  });

  describe("Modal Mode", () => {
    it("renders nothing when not open", () => {
      const onSelect = jest.fn();
      const onClose = jest.fn();
      render(<ProductSearch mode="modal" isOpen={false} onClose={onClose} onSelect={onSelect} />);
      
      expect(screen.queryByText("Buscar Producto")).not.toBeInTheDocument();
    });

    it("renders modal when open", () => {
      const onSelect = jest.fn();
      const onClose = jest.fn();
      render(<ProductSearch mode="modal" isOpen={true} onClose={onClose} onSelect={onSelect} />);
      
      expect(screen.getByText("Buscar Producto")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Buscar producto por código o nombre...")).toBeInTheDocument();
    });

    it("closes on backdrop click", () => {
      const onSelect = jest.fn();
      const onClose = jest.fn();
      render(<ProductSearch mode="modal" isOpen={true} onClose={onClose} onSelect={onSelect} />);
      
      fireEvent.click(screen.getByTestId("modal-backdrop") || screen.getByText("Buscar Producto").parentElement!);
      expect(onClose).toHaveBeenCalled();
    });

    it("closes on Escape key", async () => {
      mockSearchProducts.mockResolvedValue({ success: true, data: mockResults });
      const onSelect = jest.fn();
      const onClose = jest.fn();
      render(<ProductSearch mode="modal" isOpen={true} onClose={onClose} onSelect={onSelect} />);
      
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalled();
    });

    it("focuses input on open", async () => {
      mockSearchProducts.mockResolvedValue({ success: true, data: mockResults });
      const onSelect = jest.fn();
      const onClose = jest.fn();
      render(<ProductSearch mode="modal" isOpen={true} onClose={onClose} onSelect={onSelect} />);
      
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      
      const input = screen.getByPlaceholderText("Buscar producto por código o nombre...");
      expect(input).toHaveFocus();
    });

    it("calls onSelect and onClose when item selected", async () => {
      mockSearchProducts.mockResolvedValue({ success: true, data: mockResults });
      const onSelect = jest.fn();
      const onClose = jest.fn();
      render(<ProductSearch mode="modal" isOpen={true} onClose={onClose} onSelect={onSelect} />);

      const input = screen.getByPlaceholderText("Buscar producto por código o nombre...");
      fireEvent.change(input, { target: { value: "AA" } });
      
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      fireEvent.click(screen.getByText("Jabón de Avena"));
      
      expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
      expect(onClose).toHaveBeenCalled();
    });
  });
});