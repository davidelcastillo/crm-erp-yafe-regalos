/**
 * @jest-environment jsdom
 *
 * S18/U3: los dos filtros de la lista (Categoría y Ordenar por) usan el
 * desplegable del sistema (`FilterSelect`), que pinta la opción activa con el
 * rosa de la marca como el selector de sucursal. Ya no son `<select>` nativos:
 * ahí el rosa no se puede pintar. Siguen compartiendo el grid de dos columnas.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { InventoryFilters, INVENTORY_SORT_OPTIONS } from "./InventoryFilters";

const renderFilters = (overrides: Partial<Parameters<typeof InventoryFilters>[0]> = {}) =>
  render(
    <InventoryFilters
      categories={[{ id: 1, name: "Limpieza" }]}
      selectedCategoryId={null}
      onFilterChange={jest.fn()}
      sortBy="code"
      onSortChange={jest.fn()}
      {...overrides}
    />
  );

describe("InventoryFilters — filtros con el desplegable del sistema (S18/U3)", () => {
  it("los dos filtros son FilterSelect y comparten el grid de dos columnas", () => {
    renderFilters();

    const categoria = screen.getByRole("button", { name: "Categoría" });
    const orden = screen.getByRole("button", { name: "Ordenar por" });

    // Un solo `aria-expanded` cada uno: los dos son el control del sistema,
    // no un `<select>`.
    expect(categoria).toHaveAttribute("aria-expanded", "false");
    expect(orden).toHaveAttribute("aria-expanded", "false");
    expect(categoria).not.toHaveClass("field-select");
    // Mismo contenedor: el grid que los pone uno al lado del otro desde `sm`.
    const grid = categoria.closest("div.grid");
    expect(grid).not.toBeNull();
    expect(grid).toBe(orden.closest("div.grid"));
  });

  it("el filtro de categoría arranca en «Todas» y ofrece la lista de categorías", () => {
    renderFilters({ categories: [{ id: 1, name: "Limpieza" }, { id: 7, name: "Alimentos" }] });

    const categoria = screen.getByRole("button", { name: "Categoría" });
    expect(categoria).toHaveTextContent("Todas las categorías");

    fireEvent.click(categoria);
    expect(screen.getByRole("button", { name: "Todas las categorías" })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(screen.getByRole("button", { name: "Limpieza" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alimentos" })).toBeInTheDocument();
  });

  it("elegir «Todas las categorías» avisa null", () => {
    const onFilterChange = jest.fn();
    renderFilters({ selectedCategoryId: 7, onFilterChange });

    fireEvent.click(screen.getByRole("button", { name: "Categoría" }));
    fireEvent.click(screen.getByRole("button", { name: "Todas las categorías" }));

    expect(onFilterChange).toHaveBeenCalledWith(null);
  });

  it("elegir una categoría avisa su id numérico", () => {
    const onFilterChange = jest.fn();
    renderFilters({ categories: [{ id: 7, name: "Alimentos" }], onFilterChange });

    fireEvent.click(screen.getByRole("button", { name: "Categoría" }));
    fireEvent.click(screen.getByRole("button", { name: "Alimentos" }));

    expect(onFilterChange).toHaveBeenCalledWith(7);
  });

  it("el filtro de orden ofrece las opciones de la lista y avisa el valor", () => {
    const onSortChange = jest.fn();
    renderFilters({ onSortChange });

    fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
    expect(screen.getByRole("button", { name: "Código" })).toHaveAttribute(
      "aria-current",
      "true"
    );
    for (const option of INVENTORY_SORT_OPTIONS) {
      expect(screen.getByRole("button", { name: option.label })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "Stock: mayor a menor" }));
    expect(onSortChange).toHaveBeenCalledWith("stock-desc");
  });
});
