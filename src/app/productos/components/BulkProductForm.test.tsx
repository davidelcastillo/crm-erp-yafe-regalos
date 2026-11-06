/**
 * @jest-environment jsdom
 *
 * Alta masiva de productos (odd/tasks/productos-alta-masiva.md, T4): el modal
 * sin stock. Lo que se fija acá es lo observable de la UI: filas que se suman y
 * se quitan, el tope de 50, Enter que no envía, el error por fila con su
 * resumen, y el resultado del envío.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BulkProductForm } from "../components/BulkProductForm";

jest.mock("../../actions/product", () => ({
  createProductsBatch: jest.fn(),
}));

// CategorySelector se mockea para aislar el modal de la carga de categorías.
type CategorySelectorMockProps = {
  selectedId?: number | null;
  onValueChange?: (id: number | null) => void;
};

jest.mock("@/components/ui/CategorySelector", () => ({
  CategorySelector: ({ onValueChange, selectedId }: CategorySelectorMockProps) => (
    <button type="button" aria-label="select-category" onClick={() => onValueChange?.(42)}>
      Categoría {selectedId ?? "ninguna"}
    </button>
  ),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

import { createProductsBatch } from "../../actions/product";
import Swal from "sweetalert2";

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

const renderForm = () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  render(<BulkProductForm onClose={onClose} onSuccess={onSuccess} />);
  return { onClose, onSuccess };
};

const nombres = () => screen.getAllByLabelText(/^nombre/i);
const prefijos = () => screen.getAllByLabelText(/^prefijo/i);
const precios = () => screen.getAllByLabelText(/^precio/i);

/** Completa una fila por índice (0-based). */
const llenarFila = (i: number, name: string, prefix = "AA", price = "10") => {
  fireEvent.change(nombres()[i], { target: { value: name } });
  fireEvent.change(prefijos()[i], { target: { value: prefix } });
  fireEvent.change(precios()[i], { target: { value: price } });
};

describe("BulkProductForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSwalFire.mockResolvedValue({ isConfirmed: true } as never);
    mockCreateProductsBatch.mockResolvedValue({
      success: true,
      data: { products: [{ id: 1, code: "AA000", name: "Producto 1" }] },
    } as Exito as never);
  });

  it("agrega y quita filas", () => {
    renderForm();

    expect(nombres()).toHaveLength(1);
    expect(screen.queryByLabelText("Quitar producto 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    expect(nombres()).toHaveLength(2);

    // Una fila vacía se quita sin confirmación.
    fireEvent.click(screen.getByLabelText("Quitar producto 2"));
    expect(nombres()).toHaveLength(1);
    expect(mockSwalFire).not.toHaveBeenCalled();
  });

  it("la última fila no se puede quitar", () => {
    renderForm();

    expect(screen.queryByLabelText("Quitar producto 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    // Con dos filas cada una se puede quitar.
    expect(screen.getByLabelText("Quitar producto 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Quitar producto 2")).toBeInTheDocument();
  });

  it("quitar una fila con datos pide confirmación", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));
    llenarFila(1, "Producto con datos");

    fireEvent.click(screen.getByLabelText("Quitar producto 2"));

    await waitFor(() => expect(mockSwalFire).toHaveBeenCalled());
    await waitFor(() => expect(nombres()).toHaveLength(1));
  });

  it("el tope es de 50 filas y el botón pasa a 'Máximo 50'", () => {
    renderForm();

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

  it("una fila nueva copia el prefijo de la anterior", () => {
    renderForm();
    fireEvent.change(prefijos()[0], { target: { value: "ab" } });

    fireEvent.click(screen.getByRole("button", { name: /agregar producto/i }));

    // El prefijo se normaliza a mayúsculas.
    expect(prefijos()[0]).toHaveValue("AB");
    expect(prefijos()[1]).toHaveValue("AB");
  });

  it("Enter no envía: pasa al campo siguiente y en el último agrega una fila", () => {
    renderForm();
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

  it("el error por fila se ve, queda asociado al campo y el resumen lo enfoca", async () => {
    const falla: Falla = {
      success: false,
      error: "Ya existe un producto con ese nombre",
      rowErrors: [{ row: 1, field: "name", message: "Ya existe un producto con ese nombre" }],
    };
    mockCreateProductsBatch.mockResolvedValue(falla as Falla as never);

    renderForm();
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

  it("valida en el cliente antes de llamar a la acción", async () => {
    renderForm();

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
    const { onClose, onSuccess } = renderForm();
    llenarFila(0, "Producto único");

    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(mockCreateProductsBatch).toHaveBeenCalledWith({
      categoryId: null,
      rows: [{ name: "Producto único", prefix: "AA", price: 10 }],
    });
    expect(mockSwalFire).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("1 producto") })
    );
  });

  it("si falla conserva todas las filas para corregir", async () => {
    mockCreateProductsBatch.mockResolvedValue({ success: false, error: "Error al crear los productos" } as never);

    const { onClose, onSuccess } = renderForm();
    llenarFila(0, "Producto A");
    fireEvent.click(screen.getByRole("button", { name: /crear 1 producto/i }));

    await waitFor(() => expect(mockSwalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: "error" })));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(nombres()).toHaveLength(1);
    expect(nombres()[0]).toHaveValue("Producto A");
  });
});
