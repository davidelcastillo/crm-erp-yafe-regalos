/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Product } from "@prisma/client";
import { ProductForm } from "../components/ProductForm";

// Mock the actions. We mock BOTH the HU2 `createProduct` and the extended
// `updateProductExtended` so we can exercise both modes. `getProductById` es de
// donde la edición saca los canales publicados (T3).
jest.mock("../../actions/product", () => ({
  createProduct: jest.fn(),
  updateProductExtended: jest.fn(),
  getProductById: jest.fn(),
}));

// Las fotos del alta se suben con el producto ya creado (T2): se conserva el
// componente real y se observa el helper que dispara la subida.
jest.mock("@/components/ui/FotoUploader", () => ({
  ...jest.requireActual("@/components/ui/FotoUploader"),
  subirFotos: jest.fn(async () => null),
}));

jest.mock("@/app/actions/foto", () => ({
  firmarSubidaFoto: jest.fn(),
  confirmarFoto: jest.fn(),
  quitarFoto: jest.fn(),
  getFotosProducto: jest.fn(async () => ({ success: true, data: [] })),
}));

// Categorías: el picker múltiple carga la lista desde la action (una sola vez).
jest.mock("@/app/actions/category", () => ({
  getCategoryOptions: jest.fn(),
  createCategory: jest.fn(),
}));

// El alta pide la sucursal del stock inicial (T3): se mockean las opciones.
jest.mock("@/app/actions/branch", () => ({
  getBranchOptions: jest.fn(),
}));

// Los estilos activos son la misma taxonomía que la prenda (pills seleccionables).
jest.mock("@/app/actions/prendaTaxonomy", () => ({
  getEstiloPrendaOptions: jest.fn(),
  createEstiloPrenda: jest.fn(),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}));

// Mock SweetAlert2 — default resolves "Aceptar" (isConfirmed: true)
jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

import { createProduct, updateProductExtended, getProductById } from "../../actions/product";
import { createCategory, getCategoryOptions } from "@/app/actions/category";
import { getBranchOptions } from "@/app/actions/branch";
import { createEstiloPrenda, getEstiloPrendaOptions } from "@/app/actions/prendaTaxonomy";
import { subirFotos } from "@/components/ui/FotoUploader";
import { getFotosProducto } from "@/app/actions/foto";
import { createProductSchema } from "@/lib/validations/product";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

const mockCreateProduct = createProduct as jest.MockedFunction<typeof createProduct>;
const mockUpdateProductExtended = updateProductExtended as jest.MockedFunction<
  typeof updateProductExtended
>;
const mockGetProductById = getProductById as jest.MockedFunction<typeof getProductById>;
const mockSubirFotos = subirFotos as jest.MockedFunction<typeof subirFotos>;
const mockGetEstiloPrendaOptions = getEstiloPrendaOptions as jest.MockedFunction<
  typeof getEstiloPrendaOptions
>;
const mockCreateEstiloPrenda = createEstiloPrenda as jest.MockedFunction<
  typeof createEstiloPrenda
>;
const mockGetCategoryOptions = getCategoryOptions as jest.MockedFunction<
  typeof getCategoryOptions
>;
const mockCreateCategory = createCategory as jest.MockedFunction<typeof createCategory>;

/**
 * Categorías del producto: pills múltiples (todas equivalentes). La lista se
 * pide una vez al abrir el modal.
 */
const elegirCategoria = (nombre: string) =>
  fireEvent.click(screen.getByRole("button", { name: nombre }));
/** Los estilos activos se piden una vez al abrir el modal: default para toda la suite. */
mockGetEstiloPrendaOptions.mockResolvedValue({
  success: true,
  data: [
    { id: 1, name: "Y2K" },
    { id: 2, name: "Alternativo" },
  ],
} as never);

/**
 * El alta es un wizard (2 pasos): la sucursal primero y la ficha después. Los
 * campos de la ficha solo existen en el paso 2.
 */
const irAlPaso2 = async () => {
  fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
  await screen.findByLabelText(/nombre/i);
};

describe("ProductForm Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCategoryOptions.mockResolvedValue({
      success: true,
      data: [
        { id: 5, name: "Bebidas" },
        { id: 7, name: "Limpieza" },
      ],
    } as never);
    mockGetProductById.mockResolvedValue({ success: true, data: { publicadaEn: [] } } as never);
    mockCreateProduct.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        name: "Test",
        description: "-",
        categoryId: null,
        active: true,
        kind: "PRODUCT" as const,
        destacado: false,
        price: 0 as unknown as import("@prisma/client/runtime/library").Decimal,
        code: "TS000",
        codePrefix: "TS",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    mockUpdateProductExtended.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        name: "Test",
        description: "-",
        categoryId: null,
        active: true,
        kind: "PRODUCT" as const,
        destacado: false,
        price: 0 as unknown as import("@prisma/client/runtime/library").Decimal,
        code: "TS000",
        codePrefix: "TS",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  it("renders the create form as a two-step wizard, branch first", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    // Paso 1: sucursal, con la opción explícita de no cargar stock.
    expect(screen.getByText(/paso 1 de 2 · elegí la sucursal/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sin sucursal/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    // Sin sucursal elegida se puede continuar: el producto se crea sin stock.
    expect(screen.getByRole("button", { name: /continuar/i })).toBeEnabled();
    expect(screen.queryByLabelText(/nombre/i)).not.toBeInTheDocument();

    await irAlPaso2();

    expect(screen.getByText(/paso 2 de 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/prefijo.*2-4 letras/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/precio de venta/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear producto/i })).toBeInTheDocument();
    // Categoría, fotos y canales viven en el paso 2.
    expect(screen.getByText("Categorías")).toBeInTheDocument();
    expect(screen.getByText("Fotos")).toBeInTheDocument();
    // Active toggle is NOT shown in create mode (defaults to active=true)
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("cantidad y costo se cargan siempre: sin sucursal el aviso lo explica", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    expect(screen.getByLabelText(/cantidad inicial/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^costo/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /sin sucursal: no se carga stock; el costo igual queda registrado como compra/i
      )
    ).toBeInTheDocument();
  });

  it("shows validation error when required fields are empty", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // createProduct IS called (HTML form validation kicks in later than the
      // onClick — we only assert the action has not been called yet after submit)
      expect(mockCreateProduct).not.toHaveBeenCalled();
    });
  });

  it("calls createProduct with correct data when form is submitted", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    const nameInput = screen.getByLabelText(/nombre/i);
    const descInput = screen.getByLabelText(/descripción/i);
    const prefixInput = screen.getByLabelText(/prefijo.*2-4 letras/i);
    const priceInput = screen.getByLabelText(/precio de venta/i);

    fireEvent.change(nameInput, { target: { value: "Jabón de Avena y Arroz" } });
    fireEvent.change(descInput, { target: { value: "Jabón artesanal exfoliante" } });
    fireEvent.change(prefixInput, { target: { value: "AA" } });
    fireEvent.change(priceInput, { target: { value: "1500" } });

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith({
        name: "Jabón de Avena y Arroz",
        description: "Jabón artesanal exfoliante",
        prefix: "AA",
        price: 1500,
        // Sin categorías elegidas el alta manda la lista vacía: el producto
        // queda igual que antes (sin categoría).
        categorias: [],
        // Sin canales elegidos no publica en ninguno (T3).
        publicadaEn: [],
        // Sin estilos elegidos el alta manda la lista vacía.
        estilos: [],
        // Sin sucursal el payload no lleva branchId, pero la cantidad y el
        // costo viajan siempre (se registran como compra).
        cantidadInicial: 0,
        costoUnitario: 0,
      });
    });
  });

  it("sends the chosen categories in the create payload", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Con categoría" } });
    fireEvent.change(screen.getByLabelText(/prefijo.*2-4 letras/i), { target: { value: "AA" } });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "100" } });

    // Un producto puede tener varias: todas viajan en el alta.
    elegirCategoria("Bebidas");
    elegirCategoria("Limpieza");

    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Con categoría", categorias: [5, 7] })
      );
    });
  });

  it("crear una categoría desde el picker la deja elegida sin recargar la lista", async () => {
    ;(Swal.fire as jest.Mock).mockResolvedValueOnce({ isConfirmed: true, value: "Almacén" });
    mockCreateCategory.mockResolvedValue({
      success: true,
      data: { id: 11, name: "Almacén" },
    } as never);

    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    fireEvent.click(screen.getByRole("button", { name: "Crear nueva categoría" }));

    const nueva = await screen.findByRole("button", { name: "Almacén" });
    expect(nueva).toHaveAttribute("aria-pressed", "true");
    expect(mockGetCategoryOptions).toHaveBeenCalledTimes(1);
  });

  it("keeps the create payload valid for the schema when no category is chosen", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Sin categoría" } });
    fireEvent.change(screen.getByLabelText(/prefijo.*2-4 letras/i), { target: { value: "AA" } });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "100" } });

    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => expect(mockCreateProduct).toHaveBeenCalled());

    const payload = mockCreateProduct.mock.calls[0][0];
    const parsed = createProductSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.categorias).toEqual([]);
  });

  it("displays error message when createProduct fails", async () => {
    mockCreateProduct.mockResolvedValue({ success: false, error: "El nombre es requerido" });

    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    const nameInput = screen.getByLabelText(/nombre/i);
    const prefixInput = screen.getByLabelText(/prefijo.*2-4 letras/i);
    const priceInput = screen.getByLabelText(/precio de venta/i);

    fireEvent.change(nameInput, { target: { value: "Test" } });
    fireEvent.change(prefixInput, { target: { value: "AA" } });
    fireEvent.change(priceInput, { target: { value: "100" } });

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          text: "El nombre es requerido",
          icon: "error",
        })
      );
    });
  });

  it("prefills form when editing an existing product", () => {
    const product = {
      id: 1,
      name: "Producto Existente",
      description: "Descripción existente",
      categoryId: null,
      active: true,
      price: 500,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    render(<ProductForm product={product} onClose={() => {}} />);

    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Producto Existente");
    expect(screen.getByLabelText(/descripción/i)).toHaveValue("Descripción existente");
    expect(screen.getByLabelText(/código/i)).toHaveValue("EX001");
    expect(screen.getByLabelText(/prefijo/i)).toHaveValue("EX");
    expect(screen.getByLabelText(/precio de venta/i)).toHaveValue(500);
    expect(screen.getByRole("button", { name: /actualizar producto/i })).toBeInTheDocument();
    // Active toggle should be visible in edit mode
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("calls onSuccess with created product and does NOT call router.refresh when onSuccess is provided", async () => {
    const onSuccessMock = jest.fn();
    const onCloseMock = jest.fn();
    const mockRefresh = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      refresh: mockRefresh,
    });

    render(
      <ProductForm
        product={null}
        onClose={onCloseMock}
        onSuccess={onSuccessMock}
      />
    );
    await irAlPaso2();

    const nameInput = screen.getByLabelText(/nombre/i);
    const prefixInput = screen.getByLabelText(/prefijo.*2-4 letras/i);
    const priceInput = screen.getByLabelText(/precio de venta/i);

    fireEvent.change(nameInput, { target: { value: "Test Product" } });
    fireEvent.change(prefixInput, { target: { value: "TS" } });
    fireEvent.change(priceInput, { target: { value: "1000" } });

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  it("calls router.refresh when onSuccess is NOT provided (backward compatibility)", async () => {
    const onCloseMock = jest.fn();
    const mockRefresh = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      refresh: mockRefresh,
    });

    render(<ProductForm product={null} onClose={onCloseMock} />);
    await irAlPaso2();

    const nameInput = screen.getByLabelText(/nombre/i);
    const prefixInput = screen.getByLabelText(/prefijo.*2-4 letras/i);
    const priceInput = screen.getByLabelText(/precio de venta/i);

    fireEvent.change(nameInput, { target: { value: "Test Product" } });
    fireEvent.change(prefixInput, { target: { value: "TS" } });
    fireEvent.change(priceInput, { target: { value: "1000" } });

    const submitButton = screen.getByRole("button", { name: /crear producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("calls onSuccess with updated product when editing and does NOT call router.refresh", async () => {
    const onSuccessMock = jest.fn();
    const onCloseMock = jest.fn();
    const mockRefresh = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      refresh: mockRefresh,
    });

    const existingProduct = {
      id: 1,
      name: "Producto Existente",
      description: "Descripción existente",
      categoryId: null,
      active: true,
      price: 500,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    mockUpdateProductExtended.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        name: "Producto Actualizado",
        description: "Descripción existente",
        categoryId: null,
        active: true,
        price: 500,
        code: "EX001",
        codePrefix: "EX",
        createdAt: existingProduct.createdAt,
        updatedAt: existingProduct.updatedAt,
      },
    } as never);

    render(
      <ProductForm
        product={existingProduct}
        onClose={onCloseMock}
        onSuccess={onSuccessMock}
      />
    );

    const nameInput = screen.getByLabelText(/nombre/i);
    fireEvent.change(nameInput, { target: { value: "Producto Actualizado" } });

    const submitButton = screen.getByRole("button", { name: /actualizar producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalled();
      expect(onCloseMock).toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  it("uses updateProductExtended with id, name, price, categorias, active when editing", async () => {
    const existingProduct = {
      id: 1,
      name: "Producto",
      description: "-",
      categoryId: null,
      active: true,
      price: 100,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    // La edición precarga las categorías guardadas del producto.
    mockGetProductById.mockResolvedValue({
      success: true,
      data: { publicadaEn: [], categorias: [5, 7] },
    } as never);

    render(
      <ProductForm
        product={existingProduct}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    // Las dos pills llegan marcadas desde la ficha.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Bebidas" })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
    expect(screen.getByRole("button", { name: "Limpieza" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    const submitButton = screen.getByRole("button", { name: /actualizar producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateProductExtended).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          categorias: [5, 7],
          active: true,
        })
      );
    });
    // La columna heredada la sincroniza el servidor con la primera categoría.
    expect(mockUpdateProductExtended.mock.calls[0][0]).not.toHaveProperty("categoryId");
  });

  it("confirms with SweetAlert2 before deactivating a product (edit mode)", async () => {
    // First call is the SweetAlert2 confirm; resolve with isConfirmed: true
    ;(Swal.fire as jest.Mock).mockResolvedValueOnce({ isConfirmed: true });

    const existingProduct = {
      id: 1,
      name: "Producto",
      description: "-",
      categoryId: null,
      active: true,
      price: 100,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    render(<ProductForm product={existingProduct} onClose={() => {}} />);

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    // Click the toggle → deactivating an active product must ask for confirmation
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "¿Desactivar producto?",
          showCancelButton: true,
          // Swal pinta su botón con texto blanco: #be185d es el único rosa de marca que llega a 4.5:1.
          confirmButtonColor: "var(--palette-brand-action)",
          confirmButtonText: "Sí, desactivar",
        })
      );
    });

    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-checked", "false");
    });
  });

  it("does NOT deactivate when the SweetAlert2 confirmation is cancelled", async () => {
    // Confirm cancelled
    ;(Swal.fire as jest.Mock).mockResolvedValueOnce({ isConfirmed: false });

    const existingProduct = {
      id: 1,
      name: "Producto",
      description: "-",
      categoryId: null,
      active: true,
      price: 100,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    render(<ProductForm product={existingProduct} onClose={() => {}} />);

    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);

    await waitFor(() => {
      // Confirmation was requested but cancelled → toggle stays active
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });
  });
});

/**
 * Alta sin sucursal (pedido del dueño): la sucursal es opcional en el wizard y
 * el costo se registra como compra igual, con la cantidad que da las unidades.
 */
describe("ProductForm · alta sin sucursal", () => {
  const SUCURSALES = [
    { id: 1, name: "Sucursal Centro" },
    { id: 2, name: "Sucursal Norte" },
  ];

  const mockGetBranchOptions = getBranchOptions as jest.MockedFunction<typeof getBranchOptions>;

  /** Paso 1 → elige la sucursal y continúa a la ficha. */
  const elegirSucursal = async (nombre: string) => {
    const opcion = await screen.findByRole("button", { name: nombre });
    fireEvent.click(opcion);
    await irAlPaso2();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBranchOptions.mockResolvedValue({ success: true, data: SUCURSALES } as never);
    mockCreateProduct.mockResolvedValue({ success: true, data: { id: 1 } } as never);
  });

  const llenarFicha = () => {
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Jabón de Avena" } });
    fireEvent.change(screen.getByLabelText(/prefijo.*2-4 letras/i), { target: { value: "AA" } });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "1500" } });
  };

  it("sin sucursal manda cantidad y costo y NO manda branchId", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    // La opción de no cargar stock arranca elegida y el paso 2 la mantiene.
    expect(await screen.findByRole("button", { name: "Sucursal Centro" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await irAlPaso2();
    expect(screen.getByText(/paso 2 de 2 · sin sucursal/i)).toBeInTheDocument();

    llenarFicha();
    fireEvent.change(screen.getByLabelText(/cantidad inicial/i), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/^costo/i), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => expect(mockCreateProduct).toHaveBeenCalled());

    const payload = mockCreateProduct.mock.calls[0][0];
    expect(payload).not.toHaveProperty("branchId");
    expect(payload).toEqual(
      expect.objectContaining({ cantidadInicial: 5, costoUnitario: 100 })
    );
    expect(createProductSchema.safeParse(payload).success).toBe(true);
  });

  it("con sucursal manda branchId, cantidad y costo", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await elegirSucursal("Sucursal Centro");
    expect(screen.getByText(/paso 2 de 2 · sucursal centro/i)).toBeInTheDocument();

    llenarFicha();
    fireEvent.change(screen.getByLabelText(/cantidad inicial/i), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/^costo/i), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => expect(mockCreateProduct).toHaveBeenCalled());

    expect(mockCreateProduct.mock.calls[0][0]).toEqual(
      expect.objectContaining({ branchId: 1, cantidadInicial: 5, costoUnitario: 100 })
    );
  });

  it("con sucursal y sin costo el payload viaja con costo 0", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await elegirSucursal("Sucursal Centro");
    llenarFicha();
    fireEvent.change(screen.getByLabelText(/cantidad inicial/i), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => expect(mockCreateProduct).toHaveBeenCalled());

    expect(mockCreateProduct.mock.calls[0][0]).toEqual(
      expect.objectContaining({ branchId: 1, cantidadInicial: 3, costoUnitario: 0 })
    );
  });

  it("se puede volver a «Sin sucursal» después de elegir una", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Sucursal Centro" }));
    expect(screen.getByRole("button", { name: "Sucursal Centro" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: /sin sucursal/i }));
    expect(screen.getByRole("button", { name: /sin sucursal/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Sucursal Centro" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("en la edición no hay wizard, sucursal, cantidad ni costo", async () => {
    const product = {
      id: 1,
      name: "Producto Existente",
      description: "-",
      categoryId: null,
      active: true,
      price: 500,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    render(<ProductForm product={product} onClose={() => {}} />);

    expect(screen.queryByText(/paso 1 de 2/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Sucursal" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cantidad inicial/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^costo/i)).not.toBeInTheDocument();
    // La edición no pide las sucursales.
    expect(mockGetBranchOptions).not.toHaveBeenCalled();
  });
});

/**
 * T2 y T3 de `odd/tasks/fotos-vidriera-polkalinas.md`: el producto gana la
 * sección de fotos (misma que la prenda) y «Publicar en» (S3). Las fotos del
 * alta se suben recién con el producto creado, para tener su id.
 */
describe("ProductForm · fotos y «Publicar en» (T2/T3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProductById.mockResolvedValue({ success: true, data: { publicadaEn: [] } } as never);
    mockCreateProduct.mockResolvedValue({ success: true, data: { id: 1 } } as never);
    mockUpdateProductExtended.mockResolvedValue({ success: true, data: { id: 1 } } as never);
  });

  const llenarAlta = async () => {
    await irAlPaso2();
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Jabón de Avena" } });
    fireEvent.change(screen.getByLabelText(/prefijo.*2-4 letras/i), { target: { value: "AA" } });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "1500" } });
  };

  const elegirFoto = (input: HTMLInputElement, files: File[]) => {
    Object.defineProperty(input, "files", { value: files, configurable: true });
    fireEvent.change(input);
  };

  it("muestra la sección de fotos en el alta", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    expect(screen.getByText("Fotos")).toBeInTheDocument();
    expect(screen.getByLabelText(/agregar fotos/i)).toBeInTheDocument();
  });

  // Pedido del dueño: «que salga primero para poner las fotos».
  it("pone el bloque de fotos antes que el nombre, en el alta y en la edición", async () => {
    const antesDe = (a: HTMLElement, b: HTMLElement) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

    const { unmount } = render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();
    expect(antesDe(screen.getByText("Fotos"), screen.getByLabelText(/nombre/i))).toBe(true);
    unmount();

    const productoExistente = {
      id: 1,
      name: "Producto Existente",
      description: "-",
      categoryId: null,
      active: true,
      price: 500,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    render(<ProductForm product={productoExistente} onClose={() => {}} />);
    expect(antesDe(screen.getByText("Fotos"), screen.getByLabelText(/nombre/i))).toBe(true);
  });

  it("manda publicadaEn con los canales elegidos", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await llenarAlta();
    fireEvent.click(screen.getByLabelText("Web"));

    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => expect(mockCreateProduct).toHaveBeenCalled());
    const payload = mockCreateProduct.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({ publicadaEn: ["Web"] }));
    expect(createProductSchema.safeParse(payload).success).toBe(true);
  });

  it("sin canales elegidos manda publicadaEn vacío", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await llenarAlta();

    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => expect(mockCreateProduct).toHaveBeenCalled());
    expect(mockCreateProduct.mock.calls[0][0]).toEqual(
      expect.objectContaining({ publicadaEn: [] })
    );
  });

  it("en la edición precarga los canales publicados y los guarda", async () => {
    mockGetProductById.mockResolvedValue({
      success: true,
      data: { publicadaEn: ["Web"] },
    } as never);

    const product = {
      id: 1,
      name: "Producto Existente",
      description: "-",
      categoryId: null,
      active: true,
      price: 500,
      code: "EX001",
      codePrefix: "EX",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Product;

    render(<ProductForm product={product} onClose={() => {}} />);

    expect(await screen.findByLabelText("Web")).toBeChecked();
    expect(mockGetProductById).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: /actualizar producto/i }));

    await waitFor(() =>
      expect(mockUpdateProductExtended).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, publicadaEn: ["Web"] })
      )
    );
  });

  it("en el alta sube las fotos pendientes después de crear el producto", async () => {
    mockCreateProduct.mockResolvedValue({ success: true, data: { id: 12 } } as never);

    render(<ProductForm product={null} onClose={() => {}} />);
    await llenarAlta();
    elegirFoto(screen.getByLabelText(/agregar fotos/i) as HTMLInputElement, [
      new File(["x"], "foto.jpg", { type: "image/jpeg" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => expect(mockSubirFotos).toHaveBeenCalledWith(12, [expect.any(File)]));
  });
});

/**
 * Reporte del dueño: «El modal de productos no me deja hacer scroll hacia
 * abajo, baja la página de atrás de inventario» y «editar un producto normal
 * sigue sin dejarme ver las fotos». El shell pasa a ser el de `PrendaForm`:
 * cabecera fija, área central scrolleable que contiene el gesto y pie fijo.
 */
describe("ProductForm · scroll del modal (reporte del dueño)", () => {
  const productoExistente = {
    id: 7,
    name: "Producto Existente",
    description: "-",
    categoryId: null,
    active: true,
    price: 500,
    code: "EX001",
    codePrefix: "EX",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Product;

  const mockGetBranchOptions = getBranchOptions as jest.MockedFunction<typeof getBranchOptions>;
  const mockGetFotosProducto = getFotosProducto as jest.MockedFunction<typeof getFotosProducto>;

  /** Área central: scrollea sola y no deja que el gesto llegue al fondo. */
  const areaScrolleable = () => {
    const area = screen.getByRole("dialog").querySelector(".overscroll-contain");
    expect(area).not.toBeNull();
    return area as HTMLElement;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBranchOptions.mockResolvedValue({ success: true, data: [] } as never);
    mockGetProductById.mockResolvedValue({ success: true, data: { publicadaEn: [] } } as never);
    mockGetFotosProducto.mockResolvedValue({ success: true, data: [] } as never);
  });

  it("tiene un área central scrolleable que retiene el gesto", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    const area = areaScrolleable();
    expect(area.className).toContain("overflow-y-auto");
    expect(area.className).toContain("overscroll-contain");
    expect(area.className).toContain("min-h-0");
    expect(area.className).toContain("flex-1");
  });

  it("deja el pie (Cancelar/Continuar) fuera del área scrolleable", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);

    const area = areaScrolleable();
    expect(area.contains(screen.getByRole("button", { name: /continuar/i }))).toBe(false);
    expect(area.contains(screen.getByRole("button", { name: /cancelar/i }))).toBe(false);
  });

  it("el bloque de fotos del alta vive dentro del área scrolleable", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    const area = areaScrolleable();
    expect(area.contains(screen.getByText("Fotos"))).toBe(true);
    expect(area.contains(screen.getByLabelText(/agregar fotos/i))).toBe(true);
  });

  it("en la edición las fotos se ven, cargan las guardadas y quedan alcanzables", async () => {
    mockGetFotosProducto.mockResolvedValue({
      success: true,
      data: [{ position: 0, path: "a.jpg", alt: "Frente" }],
    } as never);

    render(<ProductForm product={productoExistente} onClose={() => {}} />);

    const area = areaScrolleable();
    expect(area.contains(screen.getByText("Fotos"))).toBe(true);
    expect(area.contains(screen.getByLabelText(/agregar fotos/i))).toBe(true);
    expect(screen.getByRole("button", { name: /actualizar producto/i })).toBeInTheDocument();

    // El uploader recibe el id del producto para traer las fotos existentes.
    await waitFor(() => expect(mockGetFotosProducto).toHaveBeenCalledWith({ productId: 7 }));
    expect(await screen.findByAltText(/frente/i)).toBeInTheDocument();
    expect(screen.getByText("Portada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quitar foto 1/i })).toBeInTheDocument();
  });

  it("bloquea el scroll del body mientras está abierto y lo libera al cerrar", () => {
    const { unmount } = render(<ProductForm product={null} onClose={() => {}} />);
    expect(document.body).toHaveClass("overflow-hidden");

    unmount();
    expect(document.body).not.toHaveClass("overflow-hidden");
  });
});

/**
 * Estilos del producto (pedido del dueño): las mismas pills que la prenda, en
 * el paso 2 del alta y en la edición, con los activos precargados.
 */
describe("ProductForm · estilos", () => {
  const productoExistente = {
    id: 1,
    name: "Remera",
    description: "-",
    categoryId: null,
    active: true,
    price: 100,
    code: "RE000",
    codePrefix: "RE",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Product;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateProduct.mockResolvedValue({ success: true, data: { id: 1 } } as never);
    mockUpdateProductExtended.mockResolvedValue({ success: true, data: { id: 1 } } as never);
    mockGetProductById.mockResolvedValue({
      success: true,
      data: { publicadaEn: [], estilos: [] },
    } as never);
  });

  it("el alta muestra los estilos activos y manda los elegidos", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    const y2k = await screen.findByRole("button", { name: "Y2K" });
    expect(screen.getByRole("button", { name: "Alternativo" })).toBeInTheDocument();
    expect(y2k).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(y2k);
    expect(y2k).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Remera Y2K" } });
    fireEvent.change(screen.getByLabelText(/prefijo.*2-4 letras/i), { target: { value: "AA" } });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() =>
      expect(mockCreateProduct).toHaveBeenCalledWith(
        expect.objectContaining({ estilos: [1] })
      )
    );
  });

  it("sin estilos cargados muestra el estado vacío", async () => {
    mockGetEstiloPrendaOptions.mockResolvedValueOnce({ success: true, data: [] } as never);

    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    expect(await screen.findByText("No hay estilos cargados")).toBeInTheDocument();
  });

  it("la edición precarga los estilos guardados y los manda", async () => {
    mockGetProductById.mockResolvedValue({
      success: true,
      data: { publicadaEn: [], estilos: [2] },
    } as never);

    render(<ProductForm product={productoExistente} onClose={() => {}} />);

    const alternativo = await screen.findByRole("button", { name: "Alternativo" });
    await waitFor(() => expect(alternativo).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: "Y2K" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: /actualizar producto/i }));

    await waitFor(() =>
      expect(mockUpdateProductExtended).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, estilos: [2] })
      )
    );
  });
});

/**
 * Alta rápida de un estilo desde el formulario (pedido del dueño): mismo
 * diálogo que la prenda, con la action existente `createEstiloPrenda`.
 */
describe("ProductForm · nuevo estilo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateProduct.mockResolvedValue({ success: true, data: { id: 1 } } as never);
    mockGetProductById.mockResolvedValue({
      success: true,
      data: { publicadaEn: [], estilos: [] },
    } as never);
    mockGetEstiloPrendaOptions.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: "Y2K" },
        { id: 2, name: "Alternativo" },
      ],
    } as never);
  });

  it("crea el estilo con el nombre recortado y queda seleccionado", async () => {
    mockCreateEstiloPrenda.mockResolvedValue({
      success: true,
      data: { id: 9, name: "Grunge" },
    } as never);
    (Swal.fire as jest.Mock).mockResolvedValueOnce({
      isConfirmed: true,
      value: "  Grunge  ",
    });

    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    fireEvent.click(await screen.findByRole("button", { name: /nuevo estilo/i }));

    await waitFor(() =>
      expect(mockCreateEstiloPrenda).toHaveBeenCalledWith({ name: "Grunge" })
    );
    expect(await screen.findByRole("button", { name: "Grunge" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("el error del servidor se muestra y no toca la selección", async () => {
    mockCreateEstiloPrenda.mockResolvedValue({
      success: false,
      error: "Ya existe un estilo con ese nombre",
    } as never);
    (Swal.fire as jest.Mock)
      .mockResolvedValueOnce({ isConfirmed: true, value: "Y2K" })
      .mockResolvedValueOnce({ isConfirmed: true });

    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    fireEvent.click(await screen.findByRole("button", { name: /nuevo estilo/i }));

    await waitFor(() =>
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: "error",
          text: "Ya existe un estilo con ese nombre",
        })
      )
    );
    expect(screen.getByRole("button", { name: "Y2K" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });
});

/**
 * Variantes del producto (pedido del dueño): opcionales, como los talles de la
 * prenda. Con variantes la cantidad total se deriva de las filas; sin
 * variantes el formulario queda como siempre.
 */
describe("ProductForm · variantes", () => {
  const producto = {
    id: 7,
    name: "Camisa",
    description: "-",
    categoryId: null,
    active: true,
    price: 100,
    code: "CA001",
    codePrefix: "CA",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Product;

  beforeEach(() => {
    jest.clearAllMocks();
    (getFotosProducto as jest.Mock).mockResolvedValue({ success: true, data: [] });
    mockGetProductById.mockResolvedValue({ success: true, data: { publicadaEn: [] } } as never);
    mockCreateProduct.mockResolvedValue({ success: true, data: { id: 1 } } as never);
    mockUpdateProductExtended.mockResolvedValue({ success: true, data: { id: 1 } } as never);
  });

  const llenarAlta = async () => {
    await irAlPaso2();
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Camisa" } });
    fireEvent.change(screen.getByLabelText(/prefijo.*2-4 letras/i), { target: { value: "CA" } });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "100" } });
  };

  const activarVariantes = () =>
    fireEvent.click(screen.getByLabelText("Este producto tiene variantes"));

  it("el alta ofrece el interruptor y sin activarlo no muestra filas", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    expect(screen.getByLabelText("Este producto tiene variantes")).not.toBeChecked();
    expect(screen.queryByLabelText("Variante 1")).not.toBeInTheDocument();
    // Sin variantes sigue estando la cantidad simple de siempre.
    expect(screen.getByLabelText(/cantidad inicial/i)).toBeInTheDocument();
  });

  it("al activarlo aparecen las filas y el total derivado reemplaza la cantidad", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    activarVariantes();

    expect(screen.getByLabelText("Variante 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad de la variante 1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Variante 1"), { target: { value: "Roja" } });
    fireEvent.change(screen.getByLabelText("Cantidad de la variante 1"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar variante/i }));
    fireEvent.change(screen.getByLabelText("Variante 2"), { target: { value: "Azul" } });
    fireEvent.change(screen.getByLabelText("Cantidad de la variante 2"), {
      target: { value: "3" },
    });

    expect(screen.getByTestId("product-cantidad-total")).toHaveTextContent("5 unidades");
    expect(screen.queryByLabelText(/cantidad inicial/i)).not.toBeInTheDocument();
  });

  it("el alta manda las variantes y la suma como cantidad", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await llenarAlta();
    activarVariantes();

    fireEvent.change(screen.getByLabelText("Variante 1"), { target: { value: "Roja" } });
    fireEvent.change(screen.getByLabelText("Cantidad de la variante 1"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/^costo/i), { target: { value: "40" } });

    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => expect(mockCreateProduct).toHaveBeenCalled());
    const payload = mockCreateProduct.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        variantes: [{ nombre: "Roja", cantidad: 2 }],
        cantidadInicial: 2,
      })
    );
    expect(createProductSchema.safeParse(payload).success).toBe(true);
  });

  it("la edición precarga las variantes guardadas con su foto", async () => {
    mockGetProductById.mockResolvedValue({
      success: true,
      data: {
        publicadaEn: [],
        estilos: [],
        variantes: [{ nombre: "Roja", cantidad: 2, fotoPosition: 0 }],
      },
    } as never);
    (getFotosProducto as jest.Mock).mockResolvedValue({
      success: true,
      data: [{ position: 0, path: "hash", alt: null }],
    });

    render(<ProductForm product={producto} onClose={() => {}} />);

    expect(await screen.findByLabelText("Variante 1")).toHaveValue("Roja");
    expect(screen.getByLabelText("Cantidad de la variante 1")).toHaveValue(2);
    expect(await screen.findByLabelText("Foto de la variante 1")).toHaveValue("0");
    expect(screen.getByLabelText("Este producto tiene variantes")).toBeChecked();
  });

  it("la edición manda las variantes editadas y la posición de la foto", async () => {
    render(<ProductForm product={producto} onClose={() => {}} />);
    activarVariantes();
    fireEvent.change(screen.getByLabelText("Variante 1"), { target: { value: "Roja" } });
    fireEvent.change(screen.getByLabelText("Cantidad de la variante 1"), {
      target: { value: "4" },
    });

    fireEvent.click(screen.getByRole("button", { name: /actualizar producto/i }));

    await waitFor(() => expect(mockUpdateProductExtended).toHaveBeenCalled());
    expect(mockUpdateProductExtended.mock.calls[0][0]).toEqual(
      expect.objectContaining({ id: 7, variantes: [{ nombre: "Roja", cantidad: 4 }] })
    );
  });
});

/**
 * Descripción del producto (pedido del dueño: «Hagamos mas largas las
descripciones de productos»): el tope sube de 500 a 2000 caracteres. La
descripción de la prenda tiene su propio esquema y no cambia.
 */
describe("createProductSchema · largo de la descripción", () => {
  const conDescripcion = (largo: number) =>
    createProductSchema.safeParse({
      name: "Producto",
      prefix: "AA",
      price: 100,
      description: "a".repeat(largo),
    });

  it("acepta 1500 caracteres", () => {
    expect(conDescripcion(1500).success).toBe(true);
  });

  it("rechaza 2001 caracteres con el mensaje nuevo", () => {
    const resultado = conDescripcion(2001);

    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    expect(resultado.error.issues[0]?.message).toBe("Máximo 2000 caracteres");
  });
});
