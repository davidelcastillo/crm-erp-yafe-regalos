/**
 * @jest-environment jsdom
 *
 * Carga de `/sucursales` (S2): hoy la ruta no tenía `loading.tsx`, así que la
 * banda de marca y la hoja de vidrio aparecían recién con los datos. Con esto la
 * forma de la página —píldora del encabezado incluida— está antes.
 */
import { render, screen } from "@testing-library/react";
import Loading from "./loading";

describe("/sucursales — esqueleto de carga", () => {
  it("la banda de marca trae la píldora del encabezado, decorativa", () => {
    const { container } = render(<Loading />);

    const píldora = container.querySelector('[class*="h-[60px]"]');
    expect(píldora).not.toBeNull();
    expect(píldora?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector(".brand-gradient")).not.toBeNull();
  });

  it("mantiene la ruedita y los esqueletos de la lista", () => {
    render(<Loading />);

    expect(screen.getByText("Cargando sucursales...")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
