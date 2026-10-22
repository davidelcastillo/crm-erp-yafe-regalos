/**
 * @jest-environment jsdom
 *
 * S18/U3: el desplegable de filtros del sistema. Es el control que imita al
 * `BranchSelector`: la opción activa se pinta con el rosa de la marca
 * (`bg-accent/10 text-brand-rosa-texto`), no con un `<select>` nativo que no se
 * puede pintar. Los casos de abajo fijan ese contrato.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterSelect } from "./FilterSelect";

const OPCIONES = [
  { value: "", label: "Todas las categorías" },
  { value: "1", label: "Limpieza" },
  { value: "2", label: "Alimentos" },
];

const renderSelect = (
  overrides: Partial<React.ComponentProps<typeof FilterSelect>> = {}
) =>
  render(
    <FilterSelect
      label="Categoría"
      value="1"
      options={OPCIONES}
      onChange={jest.fn()}
      {...overrides}
    />
  );

describe("FilterSelect — el desplegable de filtros del sistema (S18/U3)", () => {
  it("se anuncia con su etiqueta y muestra el valor elegido", () => {
    renderSelect();

    const disparador = screen.getByRole("button", { name: "Categoría" });
    expect(disparador).toHaveAttribute("aria-expanded", "false");
    expect(disparador).toHaveTextContent("Limpieza");
    // El panel arranca cerrado: el filtro no ocupa lugar de la lista.
    expect(screen.queryByRole("button", { name: "Alimentos" })).not.toBeInTheDocument();
  });

  it("abre el panel con una opción por cada valor de la lista", () => {
    renderSelect();

    fireEvent.click(screen.getByRole("button", { name: "Categoría" }));

    expect(screen.getByRole("button", { name: "Categoría" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    for (const opcion of OPCIONES) {
      expect(screen.getByRole("button", { name: opcion.label })).toBeInTheDocument();
    }
  });

  it("marca la opción activa con el rosa del sistema y el resto en tinta", () => {
    renderSelect();

    fireEvent.click(screen.getByRole("button", { name: "Categoría" }));

    const activa = screen.getByRole("button", { name: "Limpieza" });
    expect(activa).toHaveClass("bg-accent/10", "text-brand-rosa-texto", "font-medium");
    expect(activa).toHaveAttribute("aria-current", "true");

    const otra = screen.getByRole("button", { name: "Alimentos" });
    expect(otra).not.toHaveClass("bg-accent/10");
    expect(otra).toHaveClass("text-ink", "hover:bg-surface-soft");
    expect(otra).not.toHaveAttribute("aria-current");
  });

  it("avisa el valor elegido y cierra el panel", () => {
    const onChange = jest.fn();
    renderSelect({ onChange });

    fireEvent.click(screen.getByRole("button", { name: "Categoría" }));
    fireEvent.click(screen.getByRole("button", { name: "Todas las categorías" }));

    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.queryByRole("button", { name: "Alimentos" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Categoría" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("se cierra con Escape", () => {
    renderSelect();

    fireEvent.click(screen.getByRole("button", { name: "Categoría" }));
    expect(screen.getByRole("button", { name: "Alimentos" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("button", { name: "Alimentos" })).not.toBeInTheDocument();
  });

  it("se cierra al tocar afuera", () => {
    renderSelect();

    fireEvent.click(screen.getByRole("button", { name: "Categoría" }));
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("button", { name: "Alimentos" })).not.toBeInTheDocument();
  });
});
