/**
 * @jest-environment jsdom
 */

/**
 * `BrandBand` es la banda de marca para páginas que no pueden tener hooks
 * (Server Components como `/clientes` y `/sucursales`): el degradé se retira al
 * scrollear (S10) y el encabezado se mueve un poco (S11).
 *
 * Lo que se fija acá es el contrato: renderiza lo que le pasan, el degradé es
 * sólo decoración (nunca un control, porque atenuar algo que se puede tocar lo
 * hace parecer deshabilitado) y con movimiento reducido no queda ningún
 * `transform` inline.
 */
import { render, screen } from "@testing-library/react";

jest.mock("motion/react", () => {
  const actual = jest.requireActual("motion/react");
  return {
    ...actual,
    useReducedMotion: () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
});

import { BrandBand } from "./BrandBand";

const originalMatchMedia = window.matchMedia;

const setReducedMotion = (reduce: boolean) => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
};

const renderBand = () =>
  render(
    <BrandBand header={<h1>Clientes</h1>}>
      <p>Lista de clientes</p>
    </BrandBand>
  );

describe("BrandBand", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("renderiza el encabezado y el contenido de la página", () => {
    setReducedMotion(false);
    renderBand();

    expect(screen.getByRole("heading", { name: "Clientes" })).toBeInTheDocument();
    expect(screen.getByText("Lista de clientes")).toBeInTheDocument();
  });

  it("el degradé es una capa decorativa: aria-hidden y sin controles adentro", () => {
    setReducedMotion(false);
    const { container } = renderBand();

    const banda = container.firstChild as HTMLElement;
    const degradé = banda.querySelector(".brand-gradient") as HTMLElement;

    expect(degradé).not.toBeNull();
    // Decoración: ni se anuncia ni se puede tocar.
    expect(degradé).toHaveAttribute("aria-hidden", "true");
    expect(degradé).toHaveClass("pointer-events-none");
    expect(degradé.querySelector("button, a, input, select, textarea")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("con movimiento reducido renderiza sin transform ni opacidad inline", () => {
    setReducedMotion(true);
    const { container } = renderBand();

    const banda = container.firstChild as HTMLElement;
    const degradé = banda.querySelector(".brand-gradient") as HTMLElement;
    const envueltoDelEncabezado = screen.getByRole("heading", { name: "Clientes" })
      .parentElement as HTMLElement;

    expect(degradé.style.opacity).toBe("");
    expect(envueltoDelEncabezado.style.transform).toBe("");
  });
});
