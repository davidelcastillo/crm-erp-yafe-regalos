/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
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
  it("busca coincidencias por nombre o código y restaura la lista al limpiar", () => {
    render(<ExternalInventoryTable inventoryData={[
      ...items, { code: "OT002", name: "Otro artículo", stock: 2, price: 10 },
    ]} />);
    const search = screen.getByRole("searchbox", { name: "Buscar productos por código o nombre" });
    fireEvent.change(search, { target: { value: " pr001 " } });
    expect(screen.getAllByText(items[0].name)).toHaveLength(2);
    expect(screen.queryByText("Otro artículo")).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "OTRO" } });
    expect(screen.getAllByText("Otro artículo")).toHaveLength(2);
    expect(screen.queryByText(items[0].name)).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByText(items[0].name)).toHaveLength(2);
    expect(screen.getAllByText("Otro artículo")).toHaveLength(2);
  });

  it("trata HTML, SQL y expresiones regulares como texto literal", () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const { container } = render(<ExternalInventoryTable inventoryData={[
      ...items, { code: "TXT", name: malicious, stock: 1, price: 1 },
    ]} />);
    const search = screen.getByRole("searchbox");
    for (const value of [".*", "' OR 1=1 --", "(a+)+$"]) {
      fireEvent.change(search, { target: { value } });
      expect(screen.getByText("No se encontraron productos para esta búsqueda")).toBeInTheDocument();
      expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
    }
    fireEvent.change(search, { target: { value: malicious } });
    expect(screen.getAllByText(malicious)).toHaveLength(2);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

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
    // Sin acciones de cuenta: el único control es el de orden (S4), que no
    // inicia sesión ni navega a ninguna cuenta.
    const grupoDeOrden = container.querySelector(
      '[role="group"][aria-label="Ordenar por"]'
    );
    expect(grupoDeOrden).not.toBeNull();
    const botones = Array.from(container.querySelectorAll("button"));
    expect(botones.length).toBeGreaterThan(0);
    expect(botones.every((b) => grupoDeOrden?.contains(b))).toBe(true);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("muestra los encabezados de la tabla y los oculta con showHeaders en false", () => {
    const { unmount } = render(<ExternalInventoryTable inventoryData={items} />);
    expect(screen.getByRole("columnheader", { name: "Código" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Producto" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Stock" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Precio" })).toBeInTheDocument();
    unmount();

    render(
      <ExternalInventoryTable inventoryData={items} showHeaders={false} />
    );
    expect(screen.queryByRole("columnheader", { name: "Código" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Stock" })).not.toBeInTheDocument();
  });
});
