/**
 * @jest-environment jsdom
 */

/**
 * La card de inventario **muestra** el stock pero no deja editarlo (S20 del
 * usuario: «Eso no debe ir... Por cuestiones legales y auditables no se debe
 * poder editar el stock de un producto asi nomas»). El stock cambia solo por
 * movimientos auditables (Entrada/Salida, Mover Stock) o por compras y ventas.
 *
 * Antes había un input «Stock» en el modo edición que escribía directo en
 * `BranchInventory` con `adjustProductStock`.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Product } from "@prisma/client";
import { InventarioCard } from "./InventarioCard";

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

jest.mock("@/app/actions/product", () => ({
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
  toggleProductActive: jest.fn(),
  updateProductExtended: jest.fn(),
}));

jest.mock("@/app/actions/inventory", () => ({
  adjustProductStock: jest.fn(),
}));

import { updateProductExtended } from "@/app/actions/product";
import { adjustProductStock } from "@/app/actions/inventory";

const mockActualizar = updateProductExtended as jest.MockedFunction<
  typeof updateProductExtended
>;
const mockAjustarStock = adjustProductStock as jest.MockedFunction<
  typeof adjustProductStock
>;

const producto = {
  id: 7,
  name: "Jabón de Avena",
  description: "-",
  categoryId: null,
  active: true,
  price: 1500,
  code: "JA000",
  codePrefix: "JA",
  createdAt: new Date(),
  updatedAt: new Date(),
  inventory: [{ id: 1, branchId: 1, productId: 7, stock: 10, lastUpdated: new Date() }],
} as unknown as Product;

const renderCard = () => render(<InventarioCard product={producto} categories={[]} />);

const entrarAEditar = () => fireEvent.click(screen.getByRole("button", { name: "Editar" }));

beforeEach(() => {
  jest.clearAllMocks();
  mockActualizar.mockResolvedValue({ success: true } as never);
  mockAjustarStock.mockResolvedValue({ success: true } as never);
});

describe("InventarioCard — el stock no se edita a mano (S20)", () => {
  it("muestra el stock pero el modo edición no ofrece un campo de stock", () => {
    renderCard();

    // Se muestra: la cantidad y el estado siguen visibles en la card.
    expect(screen.getByText("10 uds")).toBeInTheDocument();
    expect(screen.getByText("En stock")).toBeInTheDocument();

    entrarAEditar();

    // No se edita: no hay ningún campo de stock en el formulario.
    expect(screen.queryByText("Stock")).not.toBeInTheDocument();
  });

  it("guardar los cambios del producto no escribe stock en la sucursal", async () => {
    renderCard();
    entrarAEditar();

    fireEvent.change(screen.getByDisplayValue("Jabón de Avena"), {
      target: { value: "Jabón de Avena x2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mockActualizar).toHaveBeenCalledWith(
        expect.objectContaining({ id: 7, name: "Jabón de Avena x2" })
      )
    );
    expect(mockAjustarStock).not.toHaveBeenCalled();
  });
});
