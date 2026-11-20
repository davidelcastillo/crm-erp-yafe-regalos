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

// Una prenda se edita con su propia ficha (U3): `PrendaForm` vive en la card.
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

import { updateProductExtended } from "@/app/actions/product";
import { adjustProductStock } from "@/app/actions/inventory";
import { getPrenda } from "@/app/actions/prenda";
import {
  getCategoriaPrendaOptions,
  getCondicionPrendaOptions,
  getEstiloPrendaOptions,
  getMedidaTipoOptions,
} from "@/app/actions/prendaTaxonomy";

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
  (getPrenda as jest.Mock).mockResolvedValue({
    success: true,
    data: {
      id: 7,
      code: "PK000",
      nombre: "Campera de jean",
      descripcion: "",
      precio: 12000,
      categoriaPrendaId: 1,
      condicionId: 2,
      talle: "M",
      detalleCondicion: "",
      detalleIntervencion: "",
      costo: 4000,
      esUnica: true,
      estilos: [],
      medidas: [],
      publicadaEn: [],
    },
  });
  (getCategoriaPrendaOptions as jest.Mock).mockResolvedValue({ success: true, data: [] });
  (getCondicionPrendaOptions as jest.Mock).mockResolvedValue({ success: true, data: [] });
  (getEstiloPrendaOptions as jest.Mock).mockResolvedValue({ success: true, data: [] });
  (getMedidaTipoOptions as jest.Mock).mockResolvedValue({ success: true, data: [] });
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

describe("InventarioCard — el nombre largo no rompe la card", () => {
  it("el título puede encoger dentro de su fila flex junto al chip del código", () => {
    renderCard();

    // El título comparte una fila flex con el chip `shrink-0` del código: sin
    // `min-w-0` el `break-words` nunca actúa y un nombre largo empuja el chip
    // y desborda la card (reporte del dueño con nombres grandes).
    const titulo = screen.getByRole("heading", { name: "Jabón de Avena" });
    expect(titulo.className).toContain("min-w-0");
    expect(titulo.className).toContain("break-words");
  });
});

describe("InventarioCard — la prenda se edita con su ficha (U3)", () => {
  const prenda = { ...producto, kind: "PRENDA", name: "Campera de jean", code: "PK000" } as Product;

  it("«Editar» abre PrendaForm en modo edición, no el formulario de producto", async () => {
    render(<InventarioCard product={prenda} categories={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    const dialogo = await screen.findByRole("dialog", { name: "Editar prenda" });
    expect(dialogo).toBeInTheDocument();
    expect(getPrenda).toHaveBeenCalledWith(7);
    // El modo edición propio de la card (producto normal) no se abrió.
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });

  it("un producto normal sigue abriendo el modo edición de la card", () => {
    renderCard();

    entrarAEditar();

    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Editar prenda" })).not.toBeInTheDocument();
  });
});
