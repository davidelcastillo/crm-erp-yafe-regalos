/**
 * Prueba visual del usuario (S18, U1/U3): el desplegable del selector de
 * sucursal quedaba **debajo** de los gráficos del dashboard y, con un nombre de
 * sucursal largo, se salía de la pantalla. Además la sucursal elegida salía con
 * fondo azul en unas páginas y en rosa en otras.
 *
 * Causa: el panel era `absolute z-50` dentro del encabezado, que desde el
 * parallax vive en un `motion.div` con `transform` — un contexto de apilado
 * nuevo, así que su `z-50` dejó de competir con los hermanos posteriores.
 */
import { render, screen, fireEvent, within } from "@testing-library/react";
import { BranchSelector } from "./BranchSelector";

const setBranchId = jest.fn();

const branches = [
  { id: 1, name: "Sucursal Centro" },
  { id: 2, name: "Sucursal Avenida Rivadavia 1234, local 5" },
];

// El contexto se muta por caso: la sucursal elegida es el estado bajo prueba.
let estadoSucursal: { branchId: number | null; branches: typeof branches; ready: boolean } = {
  branchId: 1,
  branches,
  ready: true,
};

jest.mock("@/lib/context/BranchContext", () => ({
  useBranch: () => ({ ...estadoSucursal, setBranchId }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  estadoSucursal = { branchId: 1, branches, ready: true };
});

const abrir = (nombre = /Sucursal Centro/) => {
  fireEvent.click(screen.getByRole("button", { name: nombre }));
  return screen.getByRole("listbox");
};

describe("BranchSelector — el desplegable escapa el contexto de apilado (S18)", () => {
  it("monta la lista en un portal al body, no dentro del encabezado", () => {
    const { container } = render(<BranchSelector label="Filtrar por sucursal" />);

    const lista = abrir();

    // Fuera del árbol de la página: ningún ancestro con `transform` la encierra.
    expect(lista.parentElement).toBe(document.body);
    expect(container.contains(lista)).toBe(false);
  });

  it("se posiciona fijo contra el trigger y se acota al ancho de la pantalla", () => {
    render(<BranchSelector block label="Filtrar por sucursal" />);

    const lista = abrir();

    expect(lista).toHaveStyle({ position: "fixed" });
    // El panel nunca puede ser más ancho que la ventana: `left` y `width` salen
    // de la medida del trigger, no del largo de los nombres.
    expect(parseInt(lista.style.width, 10)).toBeLessThanOrEqual(window.innerWidth);
  });

  it("scrollea adentro en vez de crecer sin límite", () => {
    render(<BranchSelector />);

    const lista = abrir();

    expect(lista).toHaveClass("max-h-60", "overflow-y-auto");
    // Los nombres largos se recortan: si no, empujan el ancho del panel.
    for (const opcion of within(lista).getAllByRole("option")) {
      expect(opcion).toHaveClass("truncate");
    }
  });

  it("tocar una opción elige la sucursal y cierra el panel", () => {
    render(<BranchSelector />);

    const lista = abrir();
    fireEvent.click(within(lista).getByRole("option", { name: branches[1].name }));

    expect(setBranchId).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

// U3: la sucursal activa se veía rosa en inventario y con fondo azul en el resto.
// Se unifica en el rosa de marca del `BranchFilterDropdown`, en los dos temas.
describe("BranchSelector — la sucursal activa va en rosa (S18, U3)", () => {
  it("la opción elegida usa el acento de marca y conserva el estado accesible", () => {
    render(<BranchSelector />);

    const lista = abrir();
    const elegida = within(lista).getByRole("option", { name: "Sucursal Centro" });

    expect(elegida).toHaveAttribute("aria-selected", "true");
    expect(elegida).toHaveClass("bg-accent/10", "text-brand-rosa-texto");
    // Ni rastro del bloque azul que tenía la versión anterior.
    expect(elegida.className).not.toMatch(/info/);

    const otra = within(lista).getByRole("option", { name: branches[1].name });
    expect(otra).toHaveAttribute("aria-selected", "false");
    expect(otra).toHaveClass("text-ink");
  });

  it("«Todas las sucursales» sigue siendo la opción elegida cuando no hay sucursal", () => {
    estadoSucursal = { branchId: null, branches, ready: true };

    render(<BranchSelector />);

    const lista = abrir(/Todas las sucursales/);

    const todas = within(lista).getByRole("option", { name: "Todas las sucursales" });
    expect(todas).toHaveAttribute("aria-selected", "true");
    expect(todas).toHaveClass("bg-accent/10", "text-brand-rosa-texto");
  });
});
