/**
 * @jest-environment jsdom
 */

/**
 * Interruptor de tema (S12): un solo botón redondo que alterna claro/oscuro.
 *
 * El estado inicial **no** es propio del componente: lo lee del
 * `document.documentElement`, donde lo dejó el script de arranque de
 * `layout.tsx` antes del primer pintado. Eso es lo que evita el destello blanco
 * y lo que se fija acá.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const root = () => document.documentElement;

beforeEach(() => {
  delete root().dataset.theme;
  localStorage.clear();
});

describe("ThemeToggle", () => {
  it("refleja en su etiqueta el tema que dejó el script de arranque", () => {
    root().dataset.theme = "dark";

    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Activar tema claro" })).toBeInTheDocument();
  });

  it("al tocarlo aplica el tema contrario y lo guarda", () => {
    root().dataset.theme = "light";

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Activar tema oscuro" }));

    expect(root().dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Activar tema claro" })).toBeInTheDocument();
  });

  it("con el tema oscuro puesto vuelve al claro", () => {
    root().dataset.theme = "dark";

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Activar tema claro" }));

    expect(root().dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
