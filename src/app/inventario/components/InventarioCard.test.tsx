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
 *
 * «Editar» en un producto normal abre el mismo modal que el alta
 * (`ProductForm`): fotos, «Publicar en», nombre, precio, categoría y activo.
 * El editor inline viejo de la card quedó sin uso (el dueño decide si se borra).
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Product } from "@prisma/client";
import { InventarioCard } from "./InventarioCard";

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

// Una prenda se edita con su propia ficha (U3): `PrendaForm` vive en la card.
// El panel de etiquetas de la prenda arma el PDF en el servidor con `pdf-lib`,
// que no corre en jsdom: se mockea la action, igual que en `PrendaForm.test`.
jest.mock("@/actions/label-print", () => ({
  generatePrendaLabels: jest.fn(),
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

// El modal de producto trae fotos y el picker de categorías: se mockean sus
// acciones para que la suite hable solo de la card.
jest.mock("@/app/actions/foto", () => ({
  firmarSubidaFoto: jest.fn(),
  confirmarFoto: jest.fn(),
  quitarFoto: jest.fn(),
  getFotosProducto: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock("@/components/ui/CategorySelector", () => ({
  CategorySelector: () => <div data-testid="category-selector" />,
}));

// El picker múltiple de categorías importa la action real (y con ella Prisma).
jest.mock("@/app/actions/category", () => ({
  getCategoryOptions: jest.fn(async () => ({ success: true, data: [] })),
  createCategory: jest.fn(),
}));

jest.mock("@/app/actions/branch", () => ({
  getBranchOptions: jest.fn(async () => ({ success: true, data: [] })),
}));

import { getProductById, updateProductExtended } from "@/app/actions/product";
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

/** Filas de stock por sucursal tal como las devuelve `getProductsWithBranchStock`. */
const sucursales = (...filas: Array<[string, number]>) =>
  filas.map(([name, stock], i) => ({
    id: i + 1,
    branchId: i + 1,
    productId: 7,
    stock,
    lastUpdated: new Date(),
    branch: { id: i + 1, name },
  }));

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
  inventory: sucursales(["Salta", 10], ["Centro", 0]),
} as unknown as Product;

const renderCard = (p: Product = producto) =>
  render(<InventarioCard product={p} categories={[]} />);

const entrarAEditar = () => fireEvent.click(screen.getByRole("button", { name: "Editar" }));

beforeEach(() => {
  jest.clearAllMocks();
  mockActualizar.mockResolvedValue({ success: true } as never);
  mockAjustarStock.mockResolvedValue({ success: true } as never);
  (getProductById as jest.Mock).mockResolvedValue({
    success: true,
    data: { id: 7, publicadaEn: [] },
  });
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

describe("InventarioCard — editar un producto abre el modal", () => {
  it("«Editar» monta el modal de producto y no el editor inline de la card", async () => {
    renderCard();

    entrarAEditar();

    expect(await screen.findByRole("dialog", { name: "Editar Producto" })).toBeInTheDocument();
    // El editor inline viejo se identificaba por su botón «Guardar».
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });

  it("el modal recibe el producto que se está editando y sus campos", async () => {
    renderCard();

    entrarAEditar();
    await screen.findByRole("dialog", { name: "Editar Producto" });

    expect(screen.getByLabelText("Nombre *")).toHaveValue("Jabón de Avena");
    expect(screen.getByLabelText("Precio de venta *")).toHaveValue(1500);
    expect(screen.getByLabelText("Código")).toHaveValue("JA000");
    // Fotos, «Publicar en», categorías y activo: lo que el editor inline no tenía.
    expect(screen.getByText("Fotos")).toBeInTheDocument();
    expect(screen.getByText("Publicar en")).toBeInTheDocument();
    expect(screen.getByText("Categorías")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Activo" })).toBeInTheDocument();
  });
});

describe("InventarioCard — el stock no se edita a mano (S20)", () => {
  it("muestra el stock en la card y el modal de edición no ofrece un campo de stock", async () => {
    renderCard();

    // Se muestra: la cantidad y el estado siguen visibles en la card.
    expect(screen.getByText("10 uds")).toBeInTheDocument();
    expect(screen.getByText("En stock")).toBeInTheDocument();

    entrarAEditar();
    await screen.findByRole("dialog", { name: "Editar Producto" });

    // No se edita: el modal no tiene ningún campo de stock.
    expect(screen.queryByRole("spinbutton", { name: /stock/i })).not.toBeInTheDocument();
  });

  it("guardar desde el modal no escribe stock en la sucursal", async () => {
    renderCard();

    entrarAEditar();
    await screen.findByRole("dialog", { name: "Editar Producto" });

    fireEvent.change(screen.getByLabelText("Nombre *"), {
      target: { value: "Jabón de Avena x2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar Producto" }));

    await waitFor(() =>
      expect(mockActualizar).toHaveBeenCalledWith(
        expect.objectContaining({ id: 7, name: "Jabón de Avena x2" })
      )
    );
    expect(mockAjustarStock).not.toHaveBeenCalled();
  });
});

describe("InventarioCard — el nombre largo no rompe la card", () => {
  it("el título puede encoger dentro de su columna y envolver", () => {
    renderCard();

    // El nombre vive en una columna `min-w-0`: sin eso el `break-words` nunca
    // actúa y un nombre largo desborda la card (reporte del dueño).
    const titulo = screen.getByRole("heading", { name: "Jabón de Avena" });
    expect(titulo.parentElement?.className).toContain("min-w-0");
    expect(titulo.className).toContain("break-words");
  });
});

describe("InventarioCard — nombres largos y sin descripción (celular)", () => {
  const NOMBRE_LARGO = "Peluche Cosplay Piyama Sanrio My Melody Estrellas Moño Party";
  const largo = { ...producto, name: NOMBRE_LARGO } as unknown as Product;

  it("recorta el nombre a 2 líneas y deja el completo en el title", () => {
    renderCard(largo);

    const titulo = screen.getByRole("heading", { name: NOMBRE_LARGO });
    expect(titulo.className).toContain("line-clamp-2");
    expect(titulo.className).toContain("break-words");
    expect(titulo).toHaveAttribute("title", NOMBRE_LARGO);
  });

  it("muestra el código debajo del nombre, en su propia línea", () => {
    renderCard(largo);

    const titulo = screen.getByRole("heading", { name: NOMBRE_LARGO });
    const codigo = screen.getByText("JA000");

    // Orden en el DOM: primero el nombre, después el código.
    expect(
      titulo.compareDocumentPosition(codigo) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // Mismo bloque de texto: el código no compite con el stock en la fila alta.
    expect(codigo.parentElement).toBe(titulo.parentElement);
    expect(codigo.className).toContain("block");
    expect(codigo.className).toContain("font-mono");
  });

  it.each([null, "", "-", "   ", "\n\t-"])(
    "sin descripción real (%p) no muestra ni placeholder",
    (descripcion) => {
      const { container } = render(
        <InventarioCard
          product={{ ...largo, description: descripcion } as unknown as Product}
          categories={[]}
        />
      );

      // La card no tiene otro párrafo: si aparece uno, es el de descripción.
      expect(container.querySelector("p")).toBeNull();
    }
  );

  it("con descripción real la sigue mostrando", () => {
    const { container } = render(
      <InventarioCard
        product={{ ...producto, description: "Jabón artesanal de avena" } as unknown as Product}
        categories={[]}
      />
    );

    expect(container.querySelector("p")).toHaveTextContent("Jabón artesanal de avena");
  });

  it("la tarjeta sigue completa con foto, chips, stock y botones", () => {
    renderCard({
      ...largo,
      description: null,
      images: [{ position: 0, path: "hash-portada" }],
      categorias: [{ category: { id: 1, name: "Peluches" } }],
    } as unknown as Product);

    expect(screen.getByRole("img", { name: NOMBRE_LARGO })).toBeInTheDocument();
    expect(screen.getByLabelText("Categorías")).toHaveTextContent("Peluches");
    expect(screen.getByLabelText("Stock en Salta: 10 unidades")).toHaveTextContent("Salta · 10");
    expect(screen.getByText("10 uds")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver Movimientos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desactivar" })).toBeInTheDocument();
  });
});

describe("InventarioCard — etiqueta de sucursales con stock", () => {
  it("muestra una etiqueta por sucursal con stock > 0, con su cantidad", () => {
    renderCard();

    expect(screen.getByLabelText("Stock en Salta: 10 unidades")).toHaveTextContent("Salta · 10");
    // Centro tiene fila de inventario pero stock 0: no se lista.
    expect(screen.queryByLabelText("Stock en Centro: 0 unidades")).not.toBeInTheDocument();
    expect(screen.queryByText(/Centro/)).not.toBeInTheDocument();
  });

  it("no muestra etiquetas cuando ninguna sucursal tiene stock", () => {
    renderCard({
      ...producto,
      inventory: sucursales(["Salta", 0], ["Centro", 0]),
    } as unknown as Product);

    expect(screen.queryByLabelText(/^Stock en /)).not.toBeInTheDocument();
  });

  it("con más de 3 sucursales muestra las 3 primeras y un chip «+N»", () => {
    renderCard({
      ...producto,
      inventory: sucursales(["Salta", 1], ["Centro", 2], ["Norte", 3], ["Sur", 4], ["Oeste", 5]),
    } as unknown as Product);

    expect(screen.getByLabelText("Stock en Salta: 1 unidades")).toBeInTheDocument();
    expect(screen.getByLabelText("Stock en Centro: 2 unidades")).toBeInTheDocument();
    expect(screen.getByLabelText("Stock en Norte: 3 unidades")).toBeInTheDocument();
    expect(screen.queryByLabelText("Stock en Sur: 4 unidades")).not.toBeInTheDocument();
    expect(screen.getByLabelText("2 sucursales más")).toHaveTextContent("+2");
  });

  it("la prenda también muestra sus sucursales con stock", () => {
    renderCard({
      ...producto,
      kind: "PRENDA",
      name: "Campera de jean",
      code: "PK000",
    } as unknown as Product);

    expect(screen.getByLabelText("Stock en Salta: 10 unidades")).toHaveTextContent("Salta · 10");
  });
});

describe("InventarioCard — la prenda se edita con su ficha (U3)", () => {
  const prenda = {
    ...producto,
    kind: "PRENDA",
    name: "Campera de jean",
    code: "PK000",
  } as unknown as Product;

  it("«Editar» abre PrendaForm en modo edición, no el formulario de producto", async () => {
    render(<InventarioCard product={prenda} categories={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    const dialogo = await screen.findByRole("dialog", { name: "Editar prenda" });
    expect(dialogo).toBeInTheDocument();
    expect(getPrenda).toHaveBeenCalledWith(7);
    // El modo edición propio de la card (producto normal) no se abrió.
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Editar Producto" })).not.toBeInTheDocument();
  });
});

describe("InventarioCard — foto de portada y variantes", () => {
  const conFotosYVariantes = {
    ...producto,
    images: [{ position: 0, path: "hash-portada", alt: null }],
    variantes: [{ nombre: "Roja" }, { nombre: "Azul" }],
  } as unknown as Product;

  it("muestra la miniatura de la portada del producto", () => {
    renderCard(conFotosYVariantes);

    const foto = screen.getByRole("img", { name: /jabón de avena/i });
    expect(foto.getAttribute("src")).toContain("hash-portada_sm.webp");
  });

  it("sin fotos no renderiza imagen", () => {
    renderCard();

    expect(screen.queryByRole("img", { name: /jabón de avena/i })).not.toBeInTheDocument();
  });

  it("muestra las variantes como chips bajo el nombre", () => {
    renderCard(conFotosYVariantes);

    expect(screen.getByText("Roja")).toBeInTheDocument();
    expect(screen.getByText("Azul")).toBeInTheDocument();
  });

  it("sin variantes no hay chips", () => {
    renderCard();

    expect(screen.queryByLabelText("Variantes")).not.toBeInTheDocument();
  });
});

describe("InventarioCard — categorías del producto (N:N)", () => {
  const conCategorias = {
    ...producto,
    categorias: [
      { categoryId: 1, category: { id: 1, name: "Limpieza" } },
      { categoryId: 2, category: { id: 2, name: "Regalos" } },
    ],
  } as unknown as Product;

  it("muestra todas las categorías del producto, no solo la primera", () => {
    renderCard(conCategorias);

    expect(screen.getByLabelText("Categorías")).toHaveTextContent("Limpieza");
    expect(screen.getByLabelText("Categorías")).toHaveTextContent("Regalos");
  });

  it("sin categorías no hay chips", () => {
    renderCard();

    expect(screen.queryByLabelText("Categorías")).not.toBeInTheDocument();
  });
});
