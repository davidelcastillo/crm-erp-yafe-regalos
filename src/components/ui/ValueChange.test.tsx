/**
 * @jest-environment jsdom
 */

/**
 * S9 del usuario: «Value Change» en lo que cambia de valor — un total, un saldo.
 * El padre fuerza la animación con `key={value}`; el componente sólo tiene que
 * animar la entrada (opacidad 0,4 y 2 px) y respetar la preferencia de
 * movimiento reducido.
 *
 * `motion` decide la preferencia una sola vez, al cargar el módulo, así que en
 * el test se controla la respuesta de `useReducedMotion` en lugar de fingir un
 * `matchMedia` que ya quedó cacheado.
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

import { ValueChange } from "./ValueChange";

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

describe("ValueChange", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("arranca el valor nuevo desde la opacidad baja y 2 px abajo", () => {
    setReducedMotion(false);
    render(<ValueChange className="tabular-nums">$1.500,00</ValueChange>);

    const valor = screen.getByText("$1.500,00");
    expect(valor.tagName).toBe("SPAN");
    expect(valor).toHaveClass("tabular-nums");
    expect(valor.style.opacity).toBe("0.4");
  });

  it("con movimiento reducido muestra el valor sin animar y con la misma clase", () => {
    setReducedMotion(true);
    render(<ValueChange className="tabular-nums">$1.500,00</ValueChange>);

    const valor = screen.getByText("$1.500,00");
    expect(valor.tagName).toBe("SPAN");
    expect(valor).toHaveClass("tabular-nums");
    expect(valor.style.opacity).toBe("");
  });
});
