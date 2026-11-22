/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import type { Product } from "@prisma/client";
import { InventarioList } from "./InventarioList";

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

jest.mock("@/app/actions/product", () => ({
  createProduct: jest.fn(),
  getProductById: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
  toggleProductActive: jest.fn(),
  updateProductExtended: jest.fn(),
}));

jest.mock("@/app/actions/inventory", () => ({
  adjustProductStock: jest.fn(),
}));

jest.mock("@/app/actions/prenda", () => ({
  createPrenda: jest.fn(),
  updatePrenda: jest.fn(),
  getPrenda: jest.fn(),
}));

jest.mock("@/app/actions/prendaTaxonomy", () => ({
  getCategoriaPrendaOptions: jest.fn(),
  createCategoriaPrenda: jest.fn(),
  getCondicionPrendaOptions: jest.fn(),
  createCondicionPrenda: jest.fn(),
  getEstiloPrendaOptions: jest.fn(),
  createEstiloPrenda: jest.fn(),
  getMedidaTipoOptions: jest.fn(),
}));

jest.mock("@/app/actions/foto", () => ({
  firmarSubidaFoto: jest.fn(),
  confirmarFoto: jest.fn(),
  quitarFoto: jest.fn(),
  getFotosProducto: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock("@/components/ui/CategorySelector", () => ({
  CategorySelector: () => <div data-testid="category-selector" />,
}));

jest.mock("@/app/actions/branch", () => ({
  getBranchOptions: jest.fn(async () => ({ success: true, data: [] })),
}));

const producto = (id: number, name: string, code: string, filas: Array<[string, number]>) =>
  ({
    id,
    name,
    code,
    codePrefix: code.slice(0, 2),
    description: "-",
    categoryId: null,
    active: true,
    price: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
    inventory: filas.map(([branchName, stock], i) => ({
      id: id * 10 + i,
      branchId: id * 10 + i,
      productId: id,
      stock,
      lastUpdated: new Date(),
      branch: { id: id * 10 + i, name: branchName },
    })),
  }) as unknown as Product;

/**
 * La etiqueta de sucursal la dibuja la card con el `inventory` que trae el
 * producto: la lista solo tiene que pasar el producto completo.
 */
describe("InventarioList — etiqueta de sucursales", () => {
  it("muestra las sucursales con stock de cada producto y ninguna del que no tiene", () => {
    render(
      <InventarioList
        products={[
          producto(1, "Jabón de Avena", "JA000", [["Salta", 4], ["Centro", 2]]),
          producto(2, "Jabón de Coco", "JC000", [["Salta", 0]]),
        ]}
        sortBy="code"
      />
    );

    expect(screen.getByLabelText("Stock en Salta: 4 unidades")).toHaveTextContent("Salta · 4");
    expect(screen.getByLabelText("Stock en Centro: 2 unidades")).toHaveTextContent("Centro · 2");
    expect(screen.queryByLabelText("Stock en Salta: 0 unidades")).not.toBeInTheDocument();
  });
});
