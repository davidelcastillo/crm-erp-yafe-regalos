/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import ExternalInventoryTable, {
  InventoryItem,
} from "./ExternalInventoryTable";

const items: InventoryItem[] = [
  {
    code: "PR001",
    name: "Producto Largo Que No Debe Truncarse",
    stock: 3,
    price: 1234.5,
  },
];

describe("ExternalInventoryTable", () => {
  it("renders the empty state when there are no products", () => {
    render(<ExternalInventoryTable inventoryData={[]} />);
    expect(screen.getByText(/no hay productos/i)).toBeInTheDocument();
  });

  it("uses a mobile 2-column card layout and mirrors the 4-column grid on sm+", () => {
    const { container } = render(
      <ExternalInventoryTable inventoryData={items} />
    );
    const gridCells =
      'grid-cols-2 sm:grid-cols-[60px_1fr_80px_100px]';
    expect(container.innerHTML).toContain(gridCells);
  });

  it("stacks code + name on mobile and shows them in the sm+ grid", () => {
    const { container } = render(
      <ExternalInventoryTable inventoryData={items} />
    );
    // The product name renders twice: once in the mobile stack, once in the
    // sm+ grid column.
    expect(screen.getAllByText(/Producto Largo/)).toHaveLength(2);
    expect(screen.getAllByText("PR001").length).toBeGreaterThanOrEqual(2);
    expect(container.innerHTML).toContain(
      'class="sm:hidden flex flex-col min-w-0"'
    );
  });

  it("does not truncate the product name (break-words instead of truncate)", () => {
    const { container } = render(
      <ExternalInventoryTable inventoryData={items} />
    );
    expect(container.innerHTML).not.toContain("max-w-[200px]");
    expect(container.innerHTML).not.toContain('class="truncate ');
    expect(container.innerHTML).toContain("break-words");
  });

  it("shows the mobile header with Producto and Stock / Precio cells", () => {
    render(<ExternalInventoryTable inventoryData={items} />);
    expect(screen.getByText("Stock / Precio")).toBeInTheDocument();
    expect(screen.getByText("Código")).toBeInTheDocument();
    expect(screen.getAllByText("Producto").length).toBeGreaterThanOrEqual(2);
  });
});
