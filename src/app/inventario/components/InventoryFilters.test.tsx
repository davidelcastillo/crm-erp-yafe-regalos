/**
 * @jest-environment jsdom
 *
 * S2: los dos selectores de la lista (categoría y orden) comparten el control
 * del sistema (`.field-select`) y el mismo contenedor. Si uno se cambia de
 * clases o se muda a otra tarjeta, dejan de medir lo mismo.
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

describe("InventoryFilters — categoría y orden con el mismo control (S2)", () => {
  it("los dos selectores usan la clase del sistema", () => {
    renderFilters();

    const categoria = screen.getByLabelText("Categoría");
    const orden = screen.getByLabelText("Ordenar por");

    expect(categoria).toHaveClass("field-select");
    expect(orden).toHaveClass("field-select");
    // Mismo contenedor: el grid que los pone uno al lado del otro desde `sm`.
    expect(categoria.parentElement?.parentElement).toBe(orden.parentElement?.parentElement);
  });

  it("ofrece las opciones de orden de la lista y avisa el cambio", () => {
    const onSortChange = jest.fn();
    renderFilters({ onSortChange });

    const orden = screen.getByLabelText("Ordenar por");
    expect(orden.querySelectorAll("option")).toHaveLength(INVENTORY_SORT_OPTIONS.length);

    fireEvent.change(orden, { target: { value: "stock-desc" } });
    expect(onSortChange).toHaveBeenCalledWith("stock-desc");
  });
});
