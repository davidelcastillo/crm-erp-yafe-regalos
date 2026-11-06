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

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
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
import type { StockMovementReceipt } from "@/lib/stock-movement-receipt";
import Swal from "sweetalert2";

const mockGetCategoryOptions = getCategoryOptions as jest.MockedFunction<typeof getCategoryOptions>;
const mockCreateCategory = createCategory as jest.MockedFunction<typeof createCategory>;

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
  // La lista de categorías se carga en el mount: esperarla deja el modal listo
  // y evita actualizaciones fuera de `act`.
  await esperarCategorias();
  return { onClose, onSuccess };
};

const nombres = () => screen.getAllByLabelText(/^nombre/i);
const prefijos = () => screen.getAllByLabelText(/^prefijo/i);
const precios = () => screen.getAllByLabelText(/^precio/i);
const categorias = () => screen.getAllByLabelText(/^categoría/i);
/** Solo existe con una sucursal elegida (T5). */
const stocks = () => screen.queryAllByLabelText(/^stock inicial/i);
const elegirSucursal = (nombre = "Sucursal Centro") =>
  fireEvent.click(screen.getByRole("button", { name: nombre }));

/** Espera a que la lista única de categorías termine de cargar. */
const esperarCategorias = () => waitFor(() => expect(categorias()[0]).toBeEnabled());

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

    expect(screen.queryByLabelText("Quitar producto 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    // Con dos filas cada una se puede quitar.
    expect(screen.getByLabelText("Quitar producto 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Quitar producto 2")).toBeInTheDocument();
  });

  it("quitar una fila con datos pide confirmación", async () => {
    await renderForm();
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(1, "Producto con datos");

    fireEvent.click(screen.getByLabelText("Quitar producto 2"));

    await waitFor(() => expect(mockSwalFire).toHaveBeenCalled());
    await waitFor(() => expect(nombres()).toHaveLength(1));
  });

  it("el tope es de 50 filas y el botón pasa a 'Máximo 50'", async () => {
    await renderForm();

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
    fireEvent.change(prefijos()[0], { target: { value: "ab" } });

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));

    // El prefijo se normaliza a mayúsculas.
    expect(prefijos()[0]).toHaveValue("AB");
    expect(prefijos()[1]).toHaveValue("AB");
  });

  it("Enter no envía: pasa al campo siguiente y en el último agrega una fila", async () => {
    await renderForm();
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
    llenarFila(0, "Producto único");

    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      rows: [{ name: "Producto único", prefix: "AA", price: 10, categoryId: null }],
    });
    expect(mockSwalFire).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("1 producto") })
    );
  });

  it("si falla conserva todas las filas para corregir", async () => {
    mockCreateProductsBatch.mockResolvedValue({ success: false, error: "Error al crear los productos" } as never);

    const { onClose, onSuccess } = await renderForm();
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
        { name: "Producto uno", prefix: "AA", price: 10, categoryId: 5 },
        { name: "Producto dos", prefix: "AA", price: 10, categoryId: 7 },
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
        { name: "Producto uno", prefix: "AA", price: 10, categoryId: null },
        { name: "Producto dos", prefix: "AA", price: 10, categoryId: 11 },
      ],
    });
    expect(mockGetCategoryOptions).toHaveBeenCalledTimes(1);
  });

  it("pide la lista de categorías una sola vez aunque haya varias filas", async () => {
    await renderForm();
    await esperarCategorias();

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));

    expect(categorias()).toHaveLength(3);
    expect(mockGetCategoryOptions).toHaveBeenCalledTimes(1);
  });

  it("avisa cuando no se pudieron cargar las categorías", async () => {
    mockGetCategoryOptions.mockResolvedValue({ success: false, error: "sin permisos" } as never);

    await renderForm();

    expect(
      await screen.findByText(/no se pudieron cargar las categorías/i),
    ).toBeInTheDocument();
  });

  // T5: la sucursal es opcional y global. Sin ella el modal es el de T4.
  it("sin sucursal no hay campo de stock y el payload va sin stock", async () => {
    const { onSuccess } = await renderForm();

    // El estado vacío se explica, no se adivina.
    expect(
      screen.getByText(/sin sucursal: los productos se crean sin stock/i),
    ).toBeInTheDocument();
    expect(stocks()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "No cargar stock" })).not.toBeInTheDocument();

    llenarFila(0, "Producto único");
    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // Sin sucursal no viajan `branchId` ni `initialStock`.
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      rows: [{ name: "Producto único", prefix: "AA", price: 10, categoryId: null }],
    });
  });

  it("con sucursal cada fila lleva stock inicial y el payload lleva branchId", async () => {
    const { onSuccess } = await renderForm();

    elegirSucursal();
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
        { name: "Producto uno", prefix: "AA", price: 10, categoryId: null, initialStock: 5 },
        { name: "Producto dos", prefix: "AA", price: 20, categoryId: null, initialStock: 0 },
      ],
    });
  });

  it("quitar la sucursal vuelve a esconder el stock y a limpiar el payload", async () => {
    const { onSuccess } = await renderForm();

    elegirSucursal();
    expect(stocks()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "No cargar stock" }));
    expect(stocks()).toHaveLength(0);

    llenarFila(0, "Producto único");
    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      rows: [{ name: "Producto único", prefix: "AA", price: 10, categoryId: null }],
    });
  });

  it("con comprobante muestra el panel y recién al cerrarlo cierra una sola vez", async () => {
    mockCreateProductsBatch.mockResolvedValue({
      success: true,
      data: { products: [{ id: 1, code: "CEN000", name: "Producto único" }], receipt: COMPROBANTE },
    } as Exito as never);

    const { onClose, onSuccess } = await renderForm();
    elegirSucursal();
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
    await elegirSucursal();
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
});
