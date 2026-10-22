/**
 * @jest-environment jsdom
 */

/**
 * Ruedita de carga del rebranding: anillo rosa girando con su etiqueta, en
 * reemplazo del spinner viejo que armaba el círculo a mano en cada página.
 */
import { render, screen } from "@testing-library/react";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("se anuncia como estado y expone su etiqueta", () => {
    render(<Spinner label="Cargando ventas..." />);

    const estado = screen.getByRole("status", { name: "Cargando ventas..." });
    expect(estado).toBeInTheDocument();
    expect(screen.getByText("Cargando ventas...")).toBeInTheDocument();
  });

  it("el anillo gira y usa los tonos de marca", () => {
    const { container } = render(<Spinner label="Cargando" />);

    const anillo = container.querySelector(".animate-spin");
    expect(anillo).toBeInTheDocument();
    expect(anillo?.className).toContain("border-t-accent");
    expect(anillo?.className).toContain("border-accent-soft");
  });
});
