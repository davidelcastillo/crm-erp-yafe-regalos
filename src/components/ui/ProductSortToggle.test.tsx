/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductSortToggle } from "./ProductSortToggle";

describe("ProductSortToggle", () => {
  it("ofrece las dos opciones de S4 bajo el control «Ordenar por»", () => {
    render(<ProductSortToggle value="code" onChange={jest.fn()} />);

    const grupo = screen.getByRole("group", { name: "Ordenar por" });
    expect(grupo).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Código" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Última modificación" })
    ).toBeInTheDocument();
  });

  it("marca con aria-pressed el modo activo", () => {
    render(<ProductSortToggle value="updated" onChange={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Código" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(
      screen.getByRole("button", { name: "Última modificación" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("pinta el segmento activo con el rosa del sistema (S18/U3)", () => {
    render(<ProductSortToggle value="updated" onChange={jest.fn()} />);

    const activo = screen.getByRole("button", { name: "Última modificación" });
    expect(activo).toHaveClass("bg-accent/10", "text-brand-rosa-texto");
    expect(activo).not.toHaveClass("bg-surface", "bg-white");

    const inactivo = screen.getByRole("button", { name: "Código" });
    expect(inactivo).not.toHaveClass("bg-accent/10");
    expect(inactivo).toHaveClass("text-ink-muted");
  });

  it("mantiene los 44 px de alto en los dos segmentos", () => {
    render(<ProductSortToggle value="code" onChange={jest.fn()} />);

    for (const boton of screen.getAllByRole("button")) {
      expect(boton).toHaveClass("min-h-[44px]");
    }
  });

  it("avisa el modo elegido al hacer click", () => {
    const onChange = jest.fn();
    render(<ProductSortToggle value="code" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Última modificación" }));

    expect(onChange).toHaveBeenCalledWith("updated");
  });
});
