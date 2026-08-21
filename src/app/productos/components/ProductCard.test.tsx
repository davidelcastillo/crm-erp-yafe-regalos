/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { ProductCard } from "./ProductCard";
import type { Product } from "@prisma/client";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), refresh: jest.fn() })),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
}));

jest.mock("../../actions/product", () => ({
  toggleProductActive: jest.fn(),
}));

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Producto Test",
    description: "-",
    categoryId: null,
    active: true,
    price: 100,
    code: "TS001",
    codePrefix: "TS",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Product;
}

describe("ProductCard stock total", () => {
  it("shows the SUM of stock across all branches", () => {
    render(
      <ProductCard
        product={makeProduct({ inventory: [{ stock: 10 }, { stock: 5 }] })}
      />
    );
    expect(screen.getByText("15 uds")).toBeInTheDocument();
  });

  it('shows "0 uds" when the product has no inventory', () => {
    render(<ProductCard product={makeProduct()} />);
    expect(screen.getByText("0 uds")).toBeInTheDocument();
  });

  it("shows the scoped stock when a single branch is selected", () => {
    render(
      <ProductCard product={makeProduct({ inventory: [{ stock: 7 }] })} />
    );
    expect(screen.getByText("7 uds")).toBeInTheDocument();
  });
});
