/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import ExternalInventoryTable, {
  InventoryItem,
} from "./ExternalInventoryTable";

const items: InventoryItem[] = [
  {
    code: "PR001",
    name: "Producto Largo Que No Debe Truncarse",
    stock: 3,
    price: 1234.5,
  },
];

describe("ExternalInventoryTable", () => {
  it("muestra el estado vacío cuando no hay productos", () => {
    render(<ExternalInventoryTable inventoryData={[]} />);
    expect(screen.getByText(/no hay productos/i)).toBeInTheDocument();
  });

  it("muestra el nombre, el stock y el precio del item", () => {
    const { container } = render(
      <ExternalInventoryTable inventoryData={items} />
    );
    // El mismo dato sale dos veces: en la card de mobile y en la tabla de escritorio.
    expect(
      screen.getAllByText("Producto Largo Que No Debe Truncarse")
    ).toHaveLength(2);
    expect(screen.getAllByText("PR001")).toHaveLength(2);
    expect(screen.getAllByText("$1234.50")).toHaveLength(2);
    // El stock se lee en la card con su unidad y en la celda de la tabla.
    expect(screen.getByText("3 uds")).toBeInTheDocument();
    expect(container.querySelector("tbody td:nth-child(3)")?.textContent).toBe(
      "3"
    );
  });

  it("renderiza la tabla de escritorio y las cards de mobile", () => {
    const { container } = render(
      <ExternalInventoryTable inventoryData={items} />
    );

    // La tabla existe y su contenedor solo se ve desde md (con scroll propio).
    const tabla = container.querySelector("table");
    expect(tabla).toBeInTheDocument();
    expect(tabla?.parentElement?.className).toContain("hidden md:block");
    expect(tabla?.parentElement?.className).toContain("overflow-x-auto");

    // Hay una card de vidrio por item, oculta desde md.
    const cards = container.querySelectorAll("div.md\\:hidden > div.rounded-2xl");
    expect(cards).toHaveLength(items.length);
    expect(cards[0].className).toContain("glass");
  });

  it("muestra todos los items y ninguna acción de cuenta (vista pública de solo lectura)", () => {
    const { container } = render(
      <ExternalInventoryTable
        inventoryData={[
          ...items,
          { code: "PR002", name: "Otro producto", stock: 0, price: 10 },
        ]}
      />
    );
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(
      container.querySelectorAll("div.md\\:hidden > div.rounded-2xl")
    ).toHaveLength(2);
    // Sin botones ni enlaces: el catálogo no tiene acciones de cuenta.
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("muestra los encabezados de la tabla y los oculta con showHeaders en false", () => {
    const { unmount } = render(<ExternalInventoryTable inventoryData={items} />);
    expect(screen.getByText("Código")).toBeInTheDocument();
    expect(screen.getByText("Producto")).toBeInTheDocument();
    expect(screen.getByText("Stock")).toBeInTheDocument();
    expect(screen.getByText("Precio")).toBeInTheDocument();
    unmount();

    render(
      <ExternalInventoryTable inventoryData={items} showHeaders={false} />
    );
    expect(screen.queryByText("Código")).not.toBeInTheDocument();
    expect(screen.queryByText("Stock")).not.toBeInTheDocument();
  });
});
