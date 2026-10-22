/**
 * @jest-environment jsdom
 *
 * Carga de `/clientes` (S2): la banda de marca tiene que traer la **forma del
 * encabezado** —la píldora de 60 px— y no un bloque vacío de otra medida, para
 * que la página no salte cuando termina la carga. El esqueleto es decorativo.
 */
import { render, screen } from "@testing-library/react";
import Loading from "./loading";

describe("/clientes — esqueleto de carga", () => {
  it("la banda de marca trae la píldora del encabezado, decorativa", () => {
    const { container } = render(<Loading />);

    const píldora = container.querySelector('[class*="h-[60px]"]');
    expect(píldora).not.toBeNull();
    // Decoración: no se anuncia ni se puede tocar.
    expect(píldora?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector(".brand-gradient")).not.toBeNull();
  });

  it("mantiene la ruedita y los esqueletos de la lista", () => {
    render(<Loading />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Cargando clientes...")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
