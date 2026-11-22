/**
 * @jest-environment jsdom
 *
 * Alta masiva de productos (odd/tasks/productos-alta-masiva.md, T4 + T5): el
 * modal con y sin stock inicial. Lo que se fija acá es lo observable de la UI:
 * filas que se suman y se quitan, el tope de 50, Enter que no envía, el error
 * por fila con su resumen, el resultado del envío y, con sucursal elegida
 * (D8), el stock por fila con su comprobante.
 */
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { BulkProductForm } from "../components/BulkProductForm";

jest.mock("../../actions/product", () => ({
  createProductsBatch: jest.fn(),
}));

// Las categorías se piden una sola vez para todo el modal, no una por fila: cada
// `CategorySelector` recibe la lista ya cargada (T10).
jest.mock("@/app/actions/category", () => ({
  getCategoryOptions: jest.fn(),
  createCategory: jest.fn(),
}));

// Los estilos activos son la misma taxonomía que la prenda: una sola lista para
// todas las filas del lote.
jest.mock("@/app/actions/prendaTaxonomy", () => ({
  getEstiloPrendaOptions: jest.fn(),
  createEstiloPrenda: jest.fn(),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

// Fotos del lote (U2): el componente real queda y se observa el helper que
// dispara la subida, igual que en el alta individual.
jest.mock("@/components/ui/FotoUploader", () => ({
  ...jest.requireActual("@/components/ui/FotoUploader"),
  subirFoto: jest.fn(async () => ({ success: true })),
}));

jest.mock("@/app/actions/foto", () => ({
  firmarSubidaFoto: jest.fn(),
  confirmarFoto: jest.fn(),
  quitarFoto: jest.fn(),
  getFotosProducto: jest.fn(),
}));

// El panel genera PDFs por import dinámico: acá solo se mira que se monte con
// el comprobante del servidor y que el cierre ordene el cierre del modal.
jest.mock("@/app/inventario/components/StockMovementReceiptPanel", () => ({
  StockMovementReceiptPanel: ({
    receipt,
    onClose,
  }: {
    receipt: { reference: string };
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Comprobante">
      <p>Comprobante {receipt.reference}</p>
      <button type="button" onClick={onClose}>
        Cerrar comprobante
      </button>
    </div>
  ),
}));

import { createProductsBatch } from "../../actions/product";
import { getCategoryOptions, createCategory } from "@/app/actions/category";
import { createEstiloPrenda, getEstiloPrendaOptions } from "@/app/actions/prendaTaxonomy";
import type { StockMovementReceipt } from "@/lib/stock-movement-receipt";
import Swal from "sweetalert2";
import { subirFoto } from "@/components/ui/FotoUploader";

const mockSubirFoto = subirFoto as jest.MockedFunction<typeof subirFoto>;

// jsdom no implementa object URLs y las miniaturas de las fotos pendientes los usan.
beforeAll(() => {
  Object.assign(URL, {
    createObjectURL: jest.fn(() => "blob:miniatura"),
    revokeObjectURL: jest.fn(),
  });
});

const mockGetCategoryOptions = getCategoryOptions as jest.MockedFunction<typeof getCategoryOptions>;
const mockCreateCategory = createCategory as jest.MockedFunction<typeof createCategory>;
const mockGetEstiloPrendaOptions = getEstiloPrendaOptions as jest.MockedFunction<
  typeof getEstiloPrendaOptions
>;
const mockCreateEstiloPrenda = createEstiloPrenda as jest.MockedFunction<
  typeof createEstiloPrenda
>;
/** Estilos activos: una sola lista para todas las filas del lote. */
mockGetEstiloPrendaOptions.mockResolvedValue({
  success: true,
  data: [
    { id: 1, name: "Y2K" },
    { id: 2, name: "Alternativo" },
  ],
} as never);

const mockCreateProductsBatch = createProductsBatch as jest.MockedFunction<
  typeof createProductsBatch
>;
const mockSwalFire = Swal.fire as jest.MockedFunction<typeof Swal.fire>;

type Exito = {
  success: true;
  data: {
    products: { id: number; code: string; name: string }[];
    receipt: StockMovementReceipt | null;
  };
};
type Falla = {
  success: false;
  error: string;
  rowErrors?: { row: number; field?: string; message: string }[];
};

/** Sucursales activas: el stock inicial es global para el lote (D8). */
const SUCURSALES = [
  { id: 1, name: "Sucursal Centro" },
  { id: 2, name: "Sucursal Norte" },
];

const COMPROBANTE: StockMovementReceipt = {
  movementType: "ENTRY",
  branchId: 1,
  branchName: "Sucursal Centro",
  branchCode: "CEN",
  date: "2026-01-01T00:00:00.000Z",
  reference: "ALTA DE PRODUCTOS",
  rows: [
    { productId: 1, code: "CEN000", name: "Producto único", quantity: 5, stock: 5, price: 10 },
  ],
};

const renderForm = async () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  render(<BulkProductForm branches={SUCURSALES} onClose={onClose} onSuccess={onSuccess} />);
  // El wizard abre en el paso 1 (T15). La lista de categorías se pide igual en
  // el mount, así que esperar el microtask deja el modal sin actualizaciones
  // pendientes aunque todavía no haya filas en pantalla.
  await screen.findByRole("heading", { name: "Elegí la sucursal" });
  await act(async () => {});
  return { onClose, onSuccess };
};

const nombres = () => screen.getAllByLabelText(/^nombre/i);
const prefijos = () => screen.getAllByLabelText(/^prefijo/i);
const precios = () => screen.getAllByLabelText(/^precio/i);
const categorias = () => screen.getAllByLabelText(/^categoría/i);
/** Solo existe con una sucursal elegida (T5). */
const stocks = () => screen.queryAllByLabelText(/^stock inicial/i);
/** Costo por fila (T4): también solo con sucursal, porque la compra es del lote. */
const costos = () => screen.queryAllByLabelText(/^costo/i);
const elegirSucursal = (nombre = "Sucursal Centro") =>
  fireEvent.click(screen.getByRole("button", { name: nombre }));

/** Espera a que la lista única de categorías termine de cargar. */
const esperarCategorias = () => waitFor(() => expect(categorias()[0]).toBeEnabled());

/** Paso 1 → paso 2 (T15): Continuar y esperar la lista única de categorías. */
const continuar = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await esperarCategorias();
};

/** Completa una fila por índice (0-based). */
const llenarFila = (i: number, name: string, prefix = "AA", price = "10") => {
  fireEvent.change(nombres()[i], { target: { value: name } });
  fireEvent.change(prefijos()[i], { target: { value: prefix } });
  fireEvent.change(precios()[i], { target: { value: price } });
};

describe("BulkProductForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCategoryOptions.mockResolvedValue({
      success: true,
      data: [
        { id: 5, name: "Bebidas" },
        { id: 7, name: "Limpieza" },
      ],
    } as never);
    mockSwalFire.mockResolvedValue({ isConfirmed: true } as never);
    mockCreateProductsBatch.mockResolvedValue({
      success: true,
      data: { products: [{ id: 1, code: "AA000", name: "Producto 1" }], receipt: null },
    } as Exito as never);
  });

  it("agrega y quita filas", async () => {
    await renderForm();
    await continuar();

    expect(nombres()).toHaveLength(1);
    expect(screen.queryByLabelText("Quitar producto 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    expect(nombres()).toHaveLength(2);

    // Una fila vacía se quita sin confirmación.
    fireEvent.click(screen.getByLabelText("Quitar producto 2"));
    expect(nombres()).toHaveLength(1);
    expect(mockSwalFire).not.toHaveBeenCalled();
  });

  it("la última fila no se puede quitar", async () => {
    await renderForm();
    await continuar();

    expect(screen.queryByLabelText("Quitar producto 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    // Con dos filas cada una se puede quitar.
    expect(screen.getByLabelText("Quitar producto 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Quitar producto 2")).toBeInTheDocument();
  });

  it("quitar una fila con datos pide confirmación", async () => {
    await renderForm();
    await continuar();
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(1, "Producto con datos");

    fireEvent.click(screen.getByLabelText("Quitar producto 2"));

    await waitFor(() => expect(mockSwalFire).toHaveBeenCalled());
    await waitFor(() => expect(nombres()).toHaveLength(1));
  });

  it("el tope es de 50 filas y el botón pasa a 'Máximo 50'", async () => {
    await renderForm();
    await continuar();

    for (let i = 0; i < 49; i++) {
      fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    }

    expect(nombres()).toHaveLength(50);
    const boton = screen.getByRole("button", { name: "Máximo 50" });
    expect(boton).toBeDisabled();
    // Un toque más no suma filas.
    fireEvent.click(boton);
    expect(nombres()).toHaveLength(50);
  });

  it("una fila nueva copia el prefijo de la anterior", async () => {
    await renderForm();
    await continuar();
    fireEvent.change(prefijos()[0], { target: { value: "ab" } });

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));

    // El prefijo se normaliza a mayúsculas.
    expect(prefijos()[0]).toHaveValue("AB");
    expect(prefijos()[1]).toHaveValue("AB");
  });

  it("Enter no envía: pasa al campo siguiente y en el último agrega una fila", async () => {
    await renderForm();
    await continuar();
    llenarFila(0, "Producto único");

    // Enter en el primer campo: se mueve al prefijo, no envía.
    fireEvent.keyDown(nombres()[0], { key: "Enter" });
    expect(prefijos()[0]).toHaveFocus();
    expect(mockCreateProductsBatch).not.toHaveBeenCalled();

    // Enter en el último campo de la última fila: agrega una fila.
    fireEvent.keyDown(precios()[0], { key: "Enter" });
    expect(nombres()).toHaveLength(2);
    expect(mockCreateProductsBatch).not.toHaveBeenCalled();
  });

  it("mientras se envía no se puede agregar ni quitar filas", async () => {
    await renderForm();
    await continuar();
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(0, "Producto uno");
    llenarFila(1, "Producto dos");

    // Envío en vuelo: la promesa queda pendiente a propósito.
    let resolver: (valor: unknown) => void = () => {};
    mockCreateProductsBatch.mockImplementation(
      () =>
        new Promise((r) => {
          resolver = r as (valor: unknown) => void;
        }) as never,
    );

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /creando/i })).toBeDisabled());
    // Quitar una fila en vuelo perdería el error que vuelve del servidor.
    expect(screen.getByRole("button", { name: /agregar producto/i })).toBeDisabled();
    expect(screen.getByLabelText("Quitar producto 2")).toBeDisabled();

    await act(async () => {
      resolver({ success: true, data: { products: [], receipt: null } });
    });
  });

  it("el error por fila se ve, queda asociado al campo y el resumen lo enfoca", async () => {
    const falla: Falla = {
      success: false,
      error: "Ya existe un producto con ese nombre",
      rowErrors: [{ row: 1, field: "name", message: "Ya existe un producto con ese nombre" }],
    };
    mockCreateProductsBatch.mockResolvedValue(falla as Falla as never);

    await renderForm();
    await continuar();
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(0, "Producto libre");
    llenarFila(1, "Producto repetido");

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));

    // La fila queda en pantalla con su mensaje.
    const mensaje = await screen.findByText("Ya existe un producto con ese nombre");
    expect(mensaje).toBeInTheDocument();
    expect(nombres()).toHaveLength(2);
    expect(nombres()[1]).toHaveValue("Producto repetido");
    expect(nombres()[0]).toHaveValue("Producto libre");

    // El campo con error lo anuncia.
    expect(nombres()[1]).toHaveAttribute("aria-invalid", "true");
    const descrito = nombres()[1].getAttribute("aria-describedby") ?? "";
    expect(descrito).toContain(mensaje.id);
    expect(nombres()[0]).not.toHaveAttribute("aria-invalid");

    // El resumen cuenta las filas con error y recibe el foco.
    const resumen = screen.getByRole("alert");
    expect(resumen).toHaveTextContent("1 fila con errores");
    await waitFor(() => expect(resumen).toHaveFocus());

    // Su botón lleva a la primera fila con error.
    fireEvent.click(screen.getByRole("button", { name: /ir a la primera/i }));
    expect(nombres()[1]).toHaveFocus();
  });

  it("el error de categoría se anuncia en el disparador de la fila", async () => {
    mockCreateProductsBatch.mockResolvedValue({
      success: false,
      error: "La categoría seleccionada no existe",
      rowErrors: [{ row: 0, field: "categoryId", message: "La categoría seleccionada no existe" }],
    } as never);

    await renderForm();
    await continuar();
    llenarFila(0, "Producto único");
    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    // El disparador lleva el aria del campo que reemplazó al `<select>` previo.
    const mensaje = await screen.findByText("La categoría seleccionada no existe");
    expect(categorias()[0]).toHaveAttribute("aria-invalid", "true");
    expect(categorias()[0].getAttribute("aria-describedby") ?? "").toContain(mensaje.id);

    fireEvent.click(screen.getByRole("button", { name: /ir a la primera/i }));
    expect(categorias()[0]).toHaveFocus();
  });

  it("valida en el cliente antes de llamar a la acción", async () => {
    await renderForm();
    await continuar();

    // Prefijo inválido (un número): el mismo esquema del servidor lo rechaza.
    fireEvent.change(nombres()[0], { target: { value: "Producto único" } });
    fireEvent.change(prefijos()[0], { target: { value: "1" } });
    fireEvent.change(precios()[0], { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("1 fila con errores");
    expect(prefijos()[0]).toHaveAttribute("aria-invalid", "true");
    expect(mockCreateProductsBatch).not.toHaveBeenCalled();
  });

  it("si sale bien muestra la cantidad, llama a onSuccess y cierra", async () => {
    const { onClose, onSuccess } = await renderForm();
    await continuar();
    llenarFila(0, "Producto único");

    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      rows: [{ name: "Producto único", prefix: "AA", price: 10, categoryId: null, estilos: [] }],
    });
    expect(mockSwalFire).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("1 producto") })
    );
  });

  it("si falla conserva todas las filas para corregir", async () => {
    mockCreateProductsBatch.mockResolvedValue({ success: false, error: "Error al crear los productos" } as never);

    const { onClose, onSuccess } = await renderForm();
    await continuar();
    llenarFila(0, "Producto A");
    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(mockSwalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: "error" })));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(nombres()).toHaveLength(1);
    expect(nombres()[0]).toHaveValue("Producto A");
  });

  // S4: una categoría por fila. La lista se pide una sola vez para todo el modal.
  it("cada fila tiene su categoría y viaja con su fila", async () => {
    const { onSuccess } = await renderForm();
    await continuar();

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(0, "Producto uno");
    llenarFila(1, "Producto dos");

    expect(categorias()).toHaveLength(2);
    fireEvent.click(categorias()[0]);
    fireEvent.click(screen.getByRole("option", { name: "Bebidas" }));
    fireEvent.click(categorias()[1]);
    fireEvent.click(screen.getByRole("option", { name: "Limpieza" }));

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      rows: [
        { name: "Producto uno", prefix: "AA", price: 10, categoryId: 5, estilos: [] },
        { name: "Producto dos", prefix: "AA", price: 10, categoryId: 7, estilos: [] },
      ],
    });
  });

  // S12: «+ Nueva categoría» vuelve por fila, con una sola carga para el modal.
  it("crear una categoría desde una fila la deja elegida ahí y no suma cargas", async () => {
    mockSwalFire.mockResolvedValue({ isConfirmed: true, value: "Almacén" } as never);
    mockCreateCategory.mockResolvedValue({
      success: true,
      data: { id: 11, name: "Almacén" },
    } as never);

    const { onSuccess } = await renderForm();
    await continuar();
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(0, "Producto uno");
    llenarFila(1, "Producto dos");

    // La píldora de la segunda fila crea la categoría.
    fireEvent.click(screen.getAllByRole("button", { name: "Crear nueva categoría" })[1]);

    await waitFor(() => expect(categorias()[1]).toHaveTextContent("Almacén"));
    // Solo la fila que la creó la elige; la otra sigue vacía.
    expect(categorias()[0]).toHaveTextContent("Seleccionar categoría");
    expect(mockGetCategoryOptions).toHaveBeenCalledTimes(1);

    // La lista del modal creció: la otra fila también la ofrece.
    fireEvent.click(categorias()[0]);
    expect(screen.getByRole("option", { name: "Almacén" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Sin categoría" }));

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      rows: [
        { name: "Producto uno", prefix: "AA", price: 10, categoryId: null, estilos: [] },
        { name: "Producto dos", prefix: "AA", price: 10, categoryId: 11, estilos: [] },
      ],
    });
    expect(mockGetCategoryOptions).toHaveBeenCalledTimes(1);
  });

  it("pide la lista de categorías una sola vez aunque haya varias filas", async () => {
    await renderForm();
    await continuar();
    await esperarCategorias();

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));

    expect(categorias()).toHaveLength(3);
    expect(mockGetCategoryOptions).toHaveBeenCalledTimes(1);
  });

  it("avisa cuando no se pudieron cargar las categorías", async () => {
    mockGetCategoryOptions.mockResolvedValue({ success: false, error: "sin permisos" } as never);

    await renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      await screen.findByText(/no se pudieron cargar las categorías/i),
    ).toBeInTheDocument();
  });

  // T5: la sucursal es opcional y global. Sin ella el modal es el de T4.
  it("sin sucursal no hay campo de stock y el payload va sin stock", async () => {
    const { onSuccess } = await renderForm();

    // El estado vacío se explica en el paso 1, no se adivina.
    expect(
      screen.getByText(/sin sucursal: los productos se crean sin stock/i),
    ).toBeInTheDocument();
    await continuar();

    // En el paso 2 no hay stock ni la acción de quitarlo.
    expect(stocks()).toHaveLength(0);
    expect(costos()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "No cargar stock" })).not.toBeInTheDocument();

    llenarFila(0, "Producto único");
    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // Sin sucursal no viajan `branchId` ni `initialStock`.
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      rows: [{ name: "Producto único", prefix: "AA", price: 10, categoryId: null, estilos: [] }],
    });
  });

  it("con sucursal cada fila lleva stock inicial y el payload lleva branchId", async () => {
    const { onSuccess } = await renderForm();

    elegirSucursal();
    await continuar();
    expect(stocks()).toHaveLength(1);
    expect(stocks()[0]).toHaveAttribute("inputmode", "numeric");

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    // La fila nueva también nace con su stock, vacío.
    expect(stocks()).toHaveLength(2);

    llenarFila(0, "Producto uno");
    llenarFila(1, "Producto dos", "AA", "20");
    fireEvent.change(stocks()[0], { target: { value: "5" } });

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // El stock vacío viaja como 0: el esquema lo acepta y la fila de
    // inventario queda en 0 (L12).
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      branchId: 1,
      rows: [
        { name: "Producto uno", prefix: "AA", price: 10, categoryId: null, estilos: [], initialStock: 5 },
        { name: "Producto dos", prefix: "AA", price: 20, categoryId: null, estilos: [], initialStock: 0 },
      ],
    });
  });

  // T4: el costo de cada fila genera UNA compra del lote (solo con sucursal,
  // porque la compra necesita la sucursal global).
  it("con sucursal cada fila lleva costo y el payload lo incluye solo si se cargó", async () => {
    const { onSuccess } = await renderForm();

    elegirSucursal();
    await continuar();
    expect(costos()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    // La fila nueva también nace con su costo, vacío.
    expect(costos()).toHaveLength(2);

    llenarFila(0, "Producto uno");
    llenarFila(1, "Producto dos", "AA", "20");
    fireEvent.change(stocks()[0], { target: { value: "2" } });
    fireEvent.change(costos()[0], { target: { value: "100" } });

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // El costo vacío no viaja: la fila sin costo no entra en la compra.
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      branchId: 1,
      rows: [
        { name: "Producto uno", prefix: "AA", price: 10, categoryId: null, estilos: [], initialStock: 2, costo: 100 },
        { name: "Producto dos", prefix: "AA", price: 20, categoryId: null, estilos: [], initialStock: 0 },
      ],
    });
  });

  it("quitar la sucursal vuelve a esconder el stock y a limpiar el payload", async () => {
    const { onSuccess } = await renderForm();

    elegirSucursal();
    await continuar();
    expect(stocks()).toHaveLength(1);
    expect(costos()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "No cargar stock" }));
    expect(stocks()).toHaveLength(0);

    llenarFila(0, "Producto único");
    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      rows: [{ name: "Producto único", prefix: "AA", price: 10, categoryId: null, estilos: [] }],
    });
  });

  it("con comprobante muestra el panel y recién al cerrarlo cierra una sola vez", async () => {
    mockCreateProductsBatch.mockResolvedValue({
      success: true,
      data: { products: [{ id: 1, code: "CEN000", name: "Producto único" }], receipt: COMPROBANTE },
    } as Exito as never);

    const { onClose, onSuccess } = await renderForm();
    elegirSucursal();
    await continuar();
    llenarFila(0, "Producto único");
    fireEvent.change(stocks()[0], { target: { value: "5" } });

    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    // El comprobante reemplaza al modal; no hay Swal ni cierre todavía.
    expect(await screen.findByText(/comprobante alta de productos/i)).toBeInTheDocument();
    expect(screen.queryByText("Productos creados")).not.toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /cerrar comprobante/i }));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("con sucursal y stock 0 el servidor no devuelve comprobante: sigue el Swal", async () => {
    const { onClose, onSuccess } = await renderForm();
    elegirSucursal();
    await continuar();
    llenarFila(0, "Producto sin stock");

    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(mockSwalFire).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("1 producto") }),
    );
    expect(screen.queryByRole("dialog", { name: "Comprobante" })).not.toBeInTheDocument();
  });

  it("el error de stock del servidor queda en el campo de la fila", async () => {
    mockCreateProductsBatch.mockResolvedValue({
      success: false,
      error: "El stock no puede ser negativo",
      rowErrors: [{ row: 0, field: "initialStock", message: "El stock no puede ser negativo" }],
    } as Falla as never);

    await renderForm();
    elegirSucursal();
    await continuar();
    llenarFila(0, "Producto único");
    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    const mensaje = await screen.findByText("El stock no puede ser negativo");
    expect(stocks()[0]).toHaveAttribute("aria-invalid", "true");
    expect(stocks()[0].getAttribute("aria-describedby") ?? "").toContain(mensaje.id);

    fireEvent.click(screen.getByRole("button", { name: /ir a la primera/i }));
    expect(stocks()[0]).toHaveFocus();
  });

  it("quitar la sucursal borra el error de stock, que ya no tiene campo", async () => {
    await renderForm();
    elegirSucursal();
    await continuar();
    llenarFila(0, "Producto con error");
    mockCreateProductsBatch.mockResolvedValue({
      success: false,
      error: "El stock no puede ser negativo",
      rowErrors: [{ row: 0, field: "initialStock", message: "El stock no puede ser negativo" }],
    } as Falla as never);

    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));
    expect(await screen.findByText("El stock no puede ser negativo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /no cargar stock/i }));

    await waitFor(() =>
      expect(screen.queryByText("El stock no puede ser negativo")).not.toBeInTheDocument(),
    );
  });
  // T15 (S17): wizard de dos pasos. El paso 1 no comparte el scroll con las
  // filas, que es lo que pintaba la sucursal encima de la primera card (S18).
  it("abre en el paso 1 y recién Continuar revela las filas", async () => {
    await renderForm();

    expect(screen.getByText("Paso 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sucursal Centro" })).toBeInTheDocument();
    // El paso 1 no tiene filas ni acción de crear.
    expect(screen.queryAllByLabelText(/^nombre/i)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /crear \d+ producto/i })).not.toBeInTheDocument();
    // Una sola acción principal en pantalla (STYLE.md).
    const primarios = screen
      .getAllByRole("button")
      .filter((b) => b.className.includes("btn-primary"));
    expect(primarios).toHaveLength(1);
    expect(primarios[0]).toHaveTextContent("Continuar");

    await continuar();

    expect(screen.getByText("Paso 2 de 2")).toBeInTheDocument();
    expect(nombres()).toHaveLength(1);
    expect(screen.getByRole("button", { name: /crear 1 producto/i })).toBeInTheDocument();
  });

  it("volver al paso 1 conserva lo tipeado y no vuelve a pedir las categorías", async () => {
    await renderForm();
    await continuar();
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(0, "Producto uno");
    llenarFila(1, "Producto dos", "AB", "20");

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    // De vuelta en el paso 1 no hay filas, pero tampoco se perdió nada.
    expect(screen.getByText("Paso 1 de 2")).toBeInTheDocument();
    expect(screen.queryAllByLabelText(/^nombre/i)).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(nombres()).toHaveLength(2);
    expect(nombres()[0]).toHaveValue("Producto uno");
    expect(nombres()[1]).toHaveValue("Producto dos");
    expect(prefijos()[1]).toHaveValue("AB");
    expect(precios()[1]).toHaveValue(20);
    // La lista de categorías se pide una sola vez, en el mount.
    expect(mockGetCategoryOptions).toHaveBeenCalledTimes(1);
  });

  it("al cambiar de paso el foco entra al título del paso nuevo", async () => {
    await renderForm();
    const tituloSucursal = screen.getByRole("heading", { name: "Elegí la sucursal" });
    await waitFor(() => expect(tituloSucursal).toHaveFocus());

    await continuar();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Cargá los productos" })).toHaveFocus(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Elegí la sucursal" })).toHaveFocus(),
    );
  });

  it("sin sucursales activas igual se puede seguir al paso de productos", async () => {
    // La sucursal es opcional (D8): un negocio sin sucursales no puede quedar
    // encerrado en un paso donde no hay nada que elegir.
    render(<BulkProductForm branches={[]} onClose={jest.fn()} onSuccess={jest.fn()} />);

    const seguir = await screen.findByRole("button", { name: "Continuar" });
    expect(seguir).toBeEnabled();

    fireEvent.click(seguir);
    await esperarCategorias();
    expect(screen.getByRole("heading", { name: "Cargá los productos" })).toBeInTheDocument();
  });
});

// U2: fotos por fila. Quedan pendientes mientras se completa el lote y se suben
// recién con el producto creado, con el id que devuelve `createProductsBatch`.
describe("BulkProductForm: fotos del lote", () => {
  const archivo = (nombre: string) =>
    new File([new Uint8Array(4)], nombre, { type: "image/jpeg" });

  /** El selector de fotos de la fila `i` (0-based). */
  const selectorFotos = (i: number) => screen.getAllByLabelText(/fotos de/i)[i];

  const elegirFotos = (i: number, archivos: File[]) =>
    fireEvent.change(selectorFotos(i), { target: { files: archivos } });

  beforeEach(() => {
    // Este describe no hereda el `beforeEach` del anterior: se limpia acá.
    jest.clearAllMocks();
    mockSubirFoto.mockResolvedValue({ success: true });
    mockCreateProductsBatch.mockResolvedValue({
      success: true,
      data: {
        products: [
          { id: 11, code: "AA000", name: "Producto uno" },
          { id: 22, code: "AA001", name: "Producto dos" },
        ],
        receipt: null,
      },
    } as Exito as never);
  });

  /** Dos filas completas y listas para enviar. */
  const dosFilas = async () => {
    const utilidades = await renderForm();
    await continuar();
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(0, "Producto uno");
    llenarFila(1, "Producto dos");
    return utilidades;
  };

  it("cada fila acepta fotos, las muestra pendientes y no viajan en el payload", async () => {
    const { onSuccess } = await dosFilas();

    // El label dice de qué fila son las fotos (accesibilidad de U2).
    expect(selectorFotos(0)).toHaveAttribute("type", "file");
    expect(selectorFotos(1)).toBeInTheDocument();

    elegirFotos(0, [archivo("uno-a.jpg"), archivo("uno-b.jpg")]);

    // Miniaturas, portada marcada y tope visible.
    expect(screen.getByRole("img", { name: "uno-a.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "uno-b.jpg" })).toBeInTheDocument();
    expect(screen.getByText("Portada")).toBeInTheDocument();
    expect(screen.getByText(/2 de 4/)).toBeInTheDocument();

    // Quitar una pendiente deja la que queda como portada.
    fireEvent.click(screen.getByRole("button", { name: "Quitar foto 1 de Producto uno" }));
    expect(screen.queryByRole("img", { name: "uno-a.jpg" })).not.toBeInTheDocument();
    expect(screen.getByText(/1 de 4/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    // El esquema del lote no tiene fotos: viajan solo los campos de la fila.
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      rows: [
        { name: "Producto uno", prefix: "AA", price: 10, categoryId: null, estilos: [] },
        { name: "Producto dos", prefix: "AA", price: 10, categoryId: null, estilos: [] },
      ],
    });
  });

  it("sube las fotos con el id de cada fila, sin depender del orden del lote", async () => {
    // El servidor no promete el orden: el lote vuelve al revés a propósito.
    mockCreateProductsBatch.mockResolvedValue({
      success: true,
      data: {
        products: [
          { id: 22, code: "AA001", name: "Producto dos" },
          { id: 11, code: "AA000", name: "Producto uno" },
        ],
        receipt: null,
      },
    } as Exito as never);
    const uno = archivo("uno.jpg");
    const dos = archivo("dos.jpg");

    const { onSuccess } = await dosFilas();
    elegirFotos(0, [uno]);
    elegirFotos(1, [dos]);

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));

    await waitFor(() => expect(mockSubirFoto).toHaveBeenCalledTimes(2));
    expect(mockSubirFoto).toHaveBeenCalledWith(11, uno);
    expect(mockSubirFoto).toHaveBeenCalledWith(22, dos);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("una fila sin fotos no dispara la subida", async () => {
    const { onSuccess } = await dosFilas();
    elegirFotos(1, [archivo("dos.jpg")]);

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockSubirFoto).toHaveBeenCalledTimes(1);
    expect(mockSubirFoto).toHaveBeenCalledWith(22, expect.any(File));
  });

  it("una foto que falla no aborta el lote: se avisa cuántas se subieron y qué fila falló", async () => {
    mockSubirFoto.mockImplementation(async (_productId: number, archivo: File) =>
      archivo.name === "dos.jpg"
        ? { success: false, error: "No se pudo procesar la foto" }
        : { success: true },
    );
    const { onClose, onSuccess } = await dosFilas();
    elegirFotos(0, [archivo("uno.jpg")]);
    elegirFotos(1, [archivo("dos.jpg")]);

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));

    // El aviso de fotos llega antes que el de éxito y nombra la fila que falló.
    await waitFor(() =>
      expect(mockSwalFire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Fotos sin subir",
          text: expect.stringContaining("Se subieron 1 de 2 fotos"),
        }),
      ),
    );
    expect(mockSwalFire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Fotos sin subir",
        text: expect.stringContaining("Fila 2 «Producto dos»"),
      }),
    );
    expect(mockSwalFire).toHaveBeenCalledWith(
      expect.objectContaining({ icon: "success" }),
    );
    // El lote ya creado no se pierde.
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("el tope por fila es de 4 fotos", async () => {
    await dosFilas();

    elegirFotos(0, [archivo("a.jpg"), archivo("b.jpg"), archivo("c.jpg")]);
    elegirFotos(0, [archivo("d.jpg"), archivo("e.jpg")]);

    // El exceso no entra y la fila conserva lo que ya tenía.
    expect(await screen.findByRole("alert")).toHaveTextContent(/máximo es 4 fotos/i);
    expect(screen.getByText(/3 de 4/)).toBeInTheDocument();

    elegirFotos(0, [archivo("d.jpg")]);
    expect(screen.getByText(/4 de 4/)).toBeInTheDocument();
    expect(selectorFotos(0)).toBeDisabled();
  });
});

/**
 * Estilos por fila (pedido del dueño): la misma taxonomía que la prenda, pero
 * elegida dentro de la card de cada producto y enviada en su fila.
 */
describe("BulkProductForm · estilos por fila", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCategoryOptions.mockResolvedValue({
      success: true,
      data: [{ id: 5, name: "Bebidas" }],
    } as never);
    mockCreateProductsBatch.mockResolvedValue({
      success: true,
      data: { products: [{ id: 1, code: "AA000", name: "Producto uno" }], receipt: null },
    } as never);
  });

  it("cada fila elige sus estilos y viajan en su fila del payload", async () => {
    await renderForm();
    await continuar();
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(0, "Producto uno");
    llenarFila(1, "Producto dos");

    const y2k = await screen.findAllByRole("button", { name: "Y2K" });
    const alternativo = screen.getAllByRole("button", { name: "Alternativo" });
    expect(y2k).toHaveLength(2);

    fireEvent.click(alternativo[0]);
    expect(alternativo[0]).toHaveAttribute("aria-pressed", "true");
    expect(y2k[1]).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(y2k[1]);

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));

    await waitFor(() => expect(mockCreateProductsBatch).toHaveBeenCalled());
    const payload = mockCreateProductsBatch.mock.calls[0][0] as {
      rows: { estilos: number[] }[];
    };
    // Cada fila lleva los suyos; la que no eligió va vacía.
    expect(payload.rows.map((row) => row.estilos)).toEqual([[2], [1]]);
  });

  it("sin estilos cargados la card muestra el estado vacío", async () => {
    mockGetEstiloPrendaOptions.mockResolvedValueOnce({ success: true, data: [] } as never);

    await renderForm();
    await continuar();

    expect(screen.getByText("No hay estilos cargados")).toBeInTheDocument();
  });

  it("crear un estilo lo suma a la lista compartida y lo marca solo en su fila", async () => {
    mockCreateEstiloPrenda.mockResolvedValue({
      success: true,
      data: { id: 9, name: "Grunge" },
    } as never);
    mockSwalFire.mockResolvedValueOnce({ isConfirmed: true, value: " Grunge " } as never);

    await renderForm();
    await continuar();
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(0, "Producto uno");
    llenarFila(1, "Producto dos");

    // El alta vive en la card de cada fila: se crea desde la primera.
    fireEvent.click(screen.getAllByRole("button", { name: /nuevo estilo/i })[0]);

    await waitFor(() =>
      expect(mockCreateEstiloPrenda).toHaveBeenCalledWith({ name: "Grunge" })
    );
    const grunge = await screen.findAllByRole("button", { name: "Grunge" });
    expect(grunge).toHaveLength(2);
    expect(grunge[0]).toHaveAttribute("aria-pressed", "true");
    expect(grunge[1]).toHaveAttribute("aria-pressed", "false");
  });
});

describe("BulkProductForm · variantes", () => {
  // Igual que los otros bloques: el envío tiene que devolver el lote creado.
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateProductsBatch.mockResolvedValue({
      success: true,
      data: { products: [{ id: 1, code: "AA000", name: "Camisa" }], receipt: null },
    } as never);
  });

  it("manda las variantes de la fila y esconde el stock inicial", async () => {
    await renderForm();
    elegirSucursal();
    await continuar();
    llenarFila(0, "Camisa");
    expect(stocks()).toHaveLength(1);

    fireEvent.click(screen.getByLabelText("Agregar variante al producto 1"));
    fireEvent.change(screen.getByLabelText("Variante 1 del producto 1"), {
      target: { value: "Roja" },
    });
    fireEvent.change(screen.getByLabelText("Cantidad de la variante 1 del producto 1"), {
      target: { value: "2" },
    });

    // Con variantes el stock sale de la suma: el campo simple desaparece.
    expect(stocks()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(mockCreateProductsBatch).toHaveBeenCalled());
    expect((mockCreateProductsBatch.mock.calls[0][0] as { rows: unknown[] }).rows[0]).toEqual(
      expect.objectContaining({ name: "Camisa", variantes: [{ nombre: "Roja", cantidad: 2 }] })
    );
  });

  it("sin variantes la fila viaja como antes", async () => {
    await renderForm();
    await continuar();
    llenarFila(0, "Producto único");

    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(mockCreateProductsBatch).toHaveBeenCalled());
    expect((mockCreateProductsBatch.mock.calls[0][0] as { rows: unknown[] }).rows[0]).not.toHaveProperty("variantes");
  });
});

/**
 * «Publicar en» por fila (pedido del dueño): los mismos checkboxes que el alta
 * individual, dentro de la card de cada producto, y viajan en su fila.
 */
describe("BulkProductForm · publicar en por fila", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateProductsBatch.mockResolvedValue({
      success: true,
      data: {
        products: [
          { id: 1, code: "AA000", name: "Producto uno" },
          { id: 2, code: "AA001", name: "Producto dos" },
        ],
        receipt: null,
      },
    } as never);
  });

  it("cada fila elige sus canales y solo viajan los elegidos", async () => {
    await renderForm();
    await continuar();
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(0, "Producto uno");
    llenarFila(1, "Producto dos");

    // Los mismos tres canales en cada fila.
    expect(screen.getAllByLabelText("Web")).toHaveLength(2);
    expect(screen.getAllByLabelText("Instagram")).toHaveLength(2);
    expect(screen.getAllByLabelText("WhatsApp")).toHaveLength(2);

    fireEvent.click(screen.getAllByLabelText("Web")[0]);

    fireEvent.click(screen.getByRole("button", { name: /crear 2 productos/i }));

    await waitFor(() => expect(mockCreateProductsBatch).toHaveBeenCalled());
    const payload = mockCreateProductsBatch.mock.calls[0][0] as {
      rows: Record<string, unknown>[];
    };
    expect(payload.rows[0]).toEqual(expect.objectContaining({ publicadaEn: ["Web"] }));
    // La fila sin canales no manda la clave (el esquema la deja vacía).
    expect(payload.rows[1]).not.toHaveProperty("publicadaEn");
  });
});
