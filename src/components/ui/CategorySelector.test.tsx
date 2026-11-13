/**
 * @jest-environment jsdom
 *
 * Cobertura mínima del selector de categorías compartido: la píldora de alta,
 * el texto del disparador y la selección. Hasta ahora nada fijaba la píldora,
 * que es el único botón del componente que puede desbordar en una fila angosta.
 *
 * T10 suma la lista inyectada por el padre: con `options` el componente no pide
 * nada y avisa la lista nueva al crear, para que el alta masiva tenga una sola
 * carga para todas las filas.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CategorySelector } from "./CategorySelector";

jest.mock("@/app/actions/category", () => ({
  getCategoryOptions: jest.fn(),
  createCategory: jest.fn(),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: false }),
}));

import { getCategoryOptions, createCategory } from "@/app/actions/category";
import Swal from "sweetalert2";

const mockOpciones = getCategoryOptions as jest.MockedFunction<typeof getCategoryOptions>;
const mockCrear = createCategory as jest.MockedFunction<typeof createCategory>;
const mockSwalFire = Swal.fire as jest.MockedFunction<typeof Swal.fire>;

const opciones = [
  { id: 7, name: "Bebidas" },
  { id: 9, name: "Limpieza" },
];

describe("CategorySelector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpciones.mockResolvedValue({ success: true, data: opciones } as never);
  });

  it("la píldora de nueva categoría se anuncia y trae las dos variantes del texto", async () => {
    render(<CategorySelector />);

    const pildora = screen.getByRole("button", { name: "Crear nueva categoría" });
    expect(pildora).toHaveTextContent("Nueva categoría");
    expect(pildora).toHaveTextContent("Nueva");

    await waitFor(() => expect(mockOpciones).toHaveBeenCalled());
  });

  it("el disparador muestra la categoría elegida y cae en el texto por defecto", async () => {
    const { rerender } = render(<CategorySelector />);
    await waitFor(() => expect(screen.getByRole("button", { name: /seleccionar categoría/i })).toBeEnabled());

    rerender(<CategorySelector selectedId={9} />);
    expect(await screen.findByRole("button", { name: /limpieza/i })).toBeInTheDocument();
  });

  it("elegir una opción avisa el id, y sin categoría avisa null", async () => {
    const alCambiar = jest.fn();
    render(<CategorySelector onValueChange={alCambiar} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /seleccionar categoría/i })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: /seleccionar categoría/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Bebidas" }));
    expect(alCambiar).toHaveBeenLastCalledWith(7);

    // El control no guarda estado propio: el disparador sigue mostrando el texto
    // por defecto hasta que el padre actualice `selectedId`.
    fireEvent.click(screen.getByRole("button", { name: /seleccionar categoría/i }));
    fireEvent.click(screen.getByRole("option", { name: "Sin categoría" }));
    expect(alCambiar).toHaveBeenLastCalledWith(null);
  });

  it("con la lista inyectada no pide las categorías y muestra las del padre", async () => {
    render(<CategorySelector options={opciones} />);

    const disparador = screen.getByRole("button", { name: /seleccionar categoría/i });
    expect(disparador).toBeEnabled();

    fireEvent.click(disparador);
    expect(screen.getByRole("option", { name: "Bebidas" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Limpieza" })).toBeInTheDocument();
    expect(mockOpciones).not.toHaveBeenCalled();
  });

  it("al crear avisa la lista completa y elige la categoría nueva", async () => {
    const alCambiar = jest.fn();
    const alCambiarLista = jest.fn();
    mockSwalFire.mockResolvedValue({ isConfirmed: true, value: "Almacén" } as never);
    mockCrear.mockResolvedValue({ success: true, data: { id: 11, name: "Almacén" } } as never);

    render(
      <CategorySelector
        options={opciones}
        onValueChange={alCambiar}
        onOptionsChange={alCambiarLista}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Crear nueva categoría" }));

    // La lista del padre crece con la nueva, ordenada por nombre.
    await waitFor(() => expect(alCambiarLista).toHaveBeenCalled());
    expect(alCambiarLista).toHaveBeenLastCalledWith([
      { id: 11, name: "Almacén" },
      { id: 7, name: "Bebidas" },
      { id: 9, name: "Limpieza" },
    ]);
    // Y queda elegida para la fila que la creó.
    expect(alCambiar).toHaveBeenLastCalledWith(11);
    // Nunca pidió la lista: el padre es la fuente de verdad.
    expect(mockOpciones).not.toHaveBeenCalled();
  });
});
