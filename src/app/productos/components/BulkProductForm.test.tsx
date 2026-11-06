/**
 * @jest-environment jsdom
 *
 * Alta masiva de productos (odd/tasks/productos-alta-masiva.md, T4): el modal
 * sin stock. Lo que se fija acá es lo observable de la UI: filas que se suman y
 * se quitan, el tope de 50, Enter que no envía, el error por fila con su
 * resumen, y el resultado del envío.
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

import { createProductsBatch } from "../../actions/product";
import { getCategoryOptions, createCategory } from "@/app/actions/category";
import Swal from "sweetalert2";

const mockGetCategoryOptions = getCategoryOptions as jest.MockedFunction<typeof getCategoryOptions>;
const mockCreateCategory = createCategory as jest.MockedFunction<typeof createCategory>;

const mockCreateProductsBatch = createProductsBatch as jest.MockedFunction<
  typeof createProductsBatch
>;
const mockSwalFire = Swal.fire as jest.MockedFunction<typeof Swal.fire>;

type Exito = { success: true; data: { products: { id: number; code: string; name: string }[] } };
type Falla = {
  success: false;
  error: string;
  rowErrors?: { row: number; field?: string; message: string }[];
};

const renderForm = async () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  render(<BulkProductForm onClose={onClose} onSuccess={onSuccess} />);
  // La lista de categorías se carga en el mount: esperarla deja el modal listo
  // y evita actualizaciones fuera de `act`.
  await esperarCategorias();
  return { onClose, onSuccess };
};

const nombres = () => screen.getAllByLabelText(/^nombre/i);
const prefijos = () => screen.getAllByLabelText(/^prefijo/i);
const precios = () => screen.getAllByLabelText(/^precio/i);
const categorias = () => screen.getAllByLabelText(/^categoría/i);

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
      data: { products: [{ id: 1, code: "AA000", name: "Producto 1" }] },
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
      resolver({ success: true, data: { products: [] } });
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
});
