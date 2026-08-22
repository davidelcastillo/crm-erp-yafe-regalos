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

    // Should have 7 nav links (Inactivos was removed — now a button in /inventario)
    const navLinks = screen.getAllByRole("link");
    expect(navLinks).toHaveLength(7);
    expect(navLinks.map((l) => l.textContent)).toEqual(
      expect.arrayContaining([
        "Dashboard",
        "Productos",
        "Compras",
        "Ventas",
        "Inventario",
        "Sucursales",
        "Clientes",
      ])
    );
    expect(screen.queryByRole("link", { name: /inactivos/i })).not.toBeInTheDocument();
  });

  it("highlights active link", () => {
    (usePathname as jest.Mock).mockReturnValue("/productos");
    render(React.createElement(BottomNav));
    const activo = screen.getByRole("link", { name: /productos/i });
    expect(activo).toHaveClass("text-[#ff385c]"); // active color
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

  it.each([
    ["/forgot-password"],
    ["/reset-password"],
    ["/auth/callback"],
  ])("renders nothing on the auth route %s", (pathname) => {
    (usePathname as jest.Mock).mockReturnValue(pathname);
    const { container } = render(React.createElement(BottomNav));

    expect(screen.queryByRole("link")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});