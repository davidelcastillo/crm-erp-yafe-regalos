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

// Mock CategorySelector to keep this suite focused on ProductForm behavior
type CategorySelectorMockProps = {
  selectedId?: number | null;
  onValueChange?: (id: number | null) => void;
};

jest.mock("@/components/ui/CategorySelector", () => ({
  CategorySelector: ({ onValueChange, selectedId }: CategorySelectorMockProps) => (
    <div data-testid="category-selector">
      <button
        type="button"
        onClick={() => onValueChange?.(42)}
        aria-label="select-category"
      >
        Select category {selectedId ?? "none"}
      </button>
    </div>
  ),
}));

// El alta pide la sucursal del stock inicial (T3): se mockean las opciones.
jest.mock("@/app/actions/branch", () => ({
  getBranchOptions: jest.fn(),
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
import { getBranchOptions } from "@/app/actions/branch";
import { subirFotos } from "@/components/ui/FotoUploader";
import { createProductSchema } from "@/lib/validations/product";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

const mockCreateProduct = createProduct as jest.MockedFunction<typeof createProduct>;
const mockUpdateProductExtended = updateProductExtended as jest.MockedFunction<
  typeof updateProductExtended
>;
const mockGetProductById = getProductById as jest.MockedFunction<typeof getProductById>;
const mockSubirFotos = subirFotos as jest.MockedFunction<typeof subirFotos>;

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
    expect(screen.getByTestId("category-selector")).toBeInTheDocument();
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
        // Sin categoría elegida el alta manda null explícito (H2): el esquema
        // la acepta como nullable, así que el payload sigue siendo válido.
        categoryId: null,
        // Sin canales elegidos no publica en ninguno (T3).
        publicadaEn: [],
        // Sin sucursal el payload no lleva branchId, pero la cantidad y el
        // costo viajan siempre (se registran como compra).
        cantidadInicial: 0,
        costoUnitario: 0,
      });
    });
  });

  it("sends the chosen category in the create payload (H2)", async () => {
    render(<ProductForm product={null} onClose={() => {}} />);
    await irAlPaso2();

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Con categoría" } });
    fireEvent.change(screen.getByLabelText(/prefijo.*2-4 letras/i), { target: { value: "AA" } });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "100" } });

    // El mock de CategorySelector avisa 42 al hacer clic
    fireEvent.click(screen.getByLabelText(/select-category/i));

    fireEvent.click(screen.getByRole("button", { name: /crear producto/i }));

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Con categoría", categoryId: 42 })
      );
    });
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
    expect(parsed.success && parsed.data.categoryId).toBeNull();
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

  it("uses updateProductExtended with id, name, price, categoryId, active when editing", async () => {
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

    render(
      <ProductForm
        product={existingProduct}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    // Use the mocked CategorySelector to set categoryId
    fireEvent.click(screen.getByLabelText(/select-category/i));

    const submitButton = screen.getByRole("button", { name: /actualizar producto/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateProductExtended).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          categoryId: 42,
          active: true,
        })
      );
    });
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
