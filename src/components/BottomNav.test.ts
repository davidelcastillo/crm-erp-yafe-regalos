/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import BottomNav from "./BottomNav";
// Mock usePathname
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));
import { usePathname } from "next/navigation";

describe("BottomNav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all primary nav items", () => {
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
    render(React.createElement(BottomNav));

    // 5 destinos: el máximo de STYLE.md. «Clientes» salió de la barra (S6):
    // ahora se entra solo por el botón de /sucursales.
    const navLinks = screen.getAllByRole("link");
    expect(navLinks).toHaveLength(5);
    expect(navLinks.map((l) => l.textContent)).toEqual(
      expect.arrayContaining([
        "Dashboard",
        "Compras",
        "Ventas",
        "Inventario",
        "Sucursales",
      ])
    );
    expect(screen.queryByRole("link", { name: /clientes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /productos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /inactivos/i })).not.toBeInTheDocument();
  });

  it("usa el vidrio con tinte de marca, no blanco pelado sobre la hoja blanca", () => {
    // Detrás de la barra está el fondo blanco de la página (los wrappers de las
    // páginas son `bg-white`), así que un vidrio blanco sin tinte se lee como
    // blanco sólido salvo donde justo pasa contenido con color por debajo.
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
    render(React.createElement(BottomNav));

    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("glass-nav");
    expect(nav.className).not.toContain("bg-white/70");
  });

  it("highlights active link", () => {
    (usePathname as jest.Mock).mockReturnValue("/inventario");
    render(React.createElement(BottomNav));
    const activo = screen.getByRole("link", { name: /inventario/i });
    // El activo se marca con el circulo de marca detras del icono, no con el rojo viejo.
    expect(activo.querySelector(".brand-gradient")).toBeInTheDocument();
    expect(activo).toHaveAttribute("aria-current", "page");
    expect(activo.className).not.toContain("#ff385c");
  });

  it("renders nothing on branch portal routes", () => {
    (usePathname as jest.Mock).mockReturnValue("/sucursal/210/inventory");
    const { container } = render(React.createElement(BottomNav));

    expect(screen.queryByRole("link")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on the login page", () => {
    (usePathname as jest.Mock).mockReturnValue("/login");
    const { container } = render(React.createElement(BottomNav));

    expect(screen.queryByRole("link")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on the unauthorized page", () => {
    (usePathname as jest.Mock).mockReturnValue("/unauthorized");
    const { container } = render(React.createElement(BottomNav));

    expect(screen.queryByRole("link")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});