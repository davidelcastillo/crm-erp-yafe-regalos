/**
 * @jest-environment jsdom
 */

/**
 * Piloto de /ventas (T2 de `odd/tasks/ui-ux-motion.md`):
 * - S4: «Caja» y «Cerrar caja» eran dos accesos a lo mismo; ahora hay una sola
 *   acción de caja que abre un menú de pasos.
 * - S2: mientras carga, la página muestra la forma de su encabezado.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("../actions/product", () => ({
  getProducts: jest.fn(async () => ({ success: true, data: [] })),
}));
jest.mock("../actions/sale", () => ({
  getSales: jest.fn(async () => ({ success: true, data: { items: [], total: 0 } })),
}));
jest.mock("../actions/branch", () => ({
  getBranchOptions: jest.fn(async () => ({
    success: true,
    data: [{ id: 1, name: "Punto Rosa" }],
  })),
}));
// `AddSaleButton` carga clientes y usuario al abrirse: se mockean para no tocar
// Prisma desde un test de interfaz.
jest.mock("@/app/actions/customer", () => ({
  getCustomers: jest.fn(async () => ({ success: true, data: [] })),
}));
jest.mock("@/actions/auth", () => ({
  getUser: jest.fn(async () => null),
  logout: jest.fn(),
}));
// Prisma no se toca desde un test de interfaz: el cliente queda vacío y las
// acciones que la página importa nunca llegan a consultar.
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
// La sucursal vive en un contexto de la app: se stubea igual que en el resto de
// los tests de página, y el selector no aporta nada a lo que este test fija.
jest.mock("@/lib/context/BranchContext", () => ({
  useBranch: () => ({
    branchId: null,
    branch: null,
    branches: [],
    ready: true,
    setBranchId: jest.fn(),
    refreshBranches: jest.fn(),
  }),
}));
jest.mock("@/components/ui/BranchSelector", () => ({ BranchSelector: () => null }));

import VentasPage from "./page";

const esperarCarga = async () =>
  waitFor(() => expect(screen.queryByText("Cargando ventas...")).not.toBeInTheDocument());

describe("Ventas: un solo acceso a la caja (S4)", () => {
  it("no deja «Cerrar caja» suelto y abre el menú de pasos con la acción «Caja»", async () => {
    render(<VentasPage />);
    await esperarCarga();

    // Dos controles «Caja» porque cada layout tiene el suyo (tarjeta en celular,
    // botón en la barra de escritorio): es la misma acción, no dos funcionalidades.
    const accesos = screen.getAllByRole("button", { name: /^Caja/ });
    expect(accesos).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Cerrar caja/i })).not.toBeInTheDocument();

    fireEvent.click(accesos[0]);

    expect(await screen.findByRole("dialog", { name: "Caja" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Movimientos de caja/ })).toBeInTheDocument();
  });

  it("al elegir el paso de cierre abre el modal de cierre y no deja dos diálogos", async () => {
    render(<VentasPage />);
    await esperarCarga();

    fireEvent.click(screen.getAllByRole("button", { name: /^Caja/ })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /Cerrar caja/ }));

    const cierre = await screen.findByRole("dialog", { name: "Cerrar caja" });
    expect(cierre).toHaveAttribute("aria-modal", "true");
    expect(screen.queryByRole("dialog", { name: "Caja" })).not.toBeInTheDocument();
  });
});

describe("Ventas: esqueleto del encabezado (S2)", () => {
  it("mientras carga muestra la forma del encabezado y la reemplaza al terminar", async () => {
    const { container } = render(<VentasPage />);

    expect(screen.getByText("Cargando ventas...")).toBeInTheDocument();
    // La forma del encabezado: píldora, banda de acciones y buscador, con las
    // medidas de la página real. Sin esto, la hoja salta al terminar la carga.
    const esqueleto = (altura: string) =>
      container.querySelector(`[aria-hidden='true'] .h-\\[${altura}\\]`);
    expect(esqueleto("60px")).not.toBeNull();
    expect(esqueleto("72px")).not.toBeNull();
    expect(esqueleto("68px")).not.toBeNull();

    await esperarCarga();

    expect(screen.getByRole("heading", { level: 1, name: "Ventas" })).toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true'] .animate-pulse")).toBeNull();
  });
});
