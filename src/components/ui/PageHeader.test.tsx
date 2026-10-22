/**
 * @jest-environment jsdom
 */

/**
 * Encabezado de página compartido: en mobile la barra tiene el botón ☰ (que
 * esconde las filas del menú y el cierre de sesión) y en desktop las acciones y
 * el cierre de sesión quedan a la vista.
 *
 * Nota: jsdom no aplica CSS, así que el `hidden md:flex` de los controles de
 * escritorio y el `md:hidden` del menú no se pueden comprobar acá. Lo que sí se
 * fija es el contrato: el menú es un diálogo aparte que se abre, se cierra y
 * lleva el cierre de sesión.
 */
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { PageHeader } from "./PageHeader";

const mockLogout = jest.fn();

jest.mock("@/actions/auth", () => ({
  logout: (...args: unknown[]) => mockLogout(...args),
}));

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}));

const renderHeader = () =>
  render(
    <PageHeader
      title="Ventas"
      actions={<button type="button">Acción de escritorio</button>}
      right={<span>Sucursal activa</span>}
      menuItems={[
        { label: "Ver movimientos", onClick: jest.fn() },
        { label: "Inactivos", href: "/inventario/inactivos" },
      ]}
    />
  );

const menu = () => screen.getByRole("dialog");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PageHeader", () => {
  it("muestra el título, el contenido de la derecha y las acciones, con el menú cerrado", () => {
    renderHeader();

    expect(screen.getByRole("heading", { name: "Ventas" })).toBeInTheDocument();
    expect(screen.getByText("Sucursal activa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acción de escritorio" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("el botón ☰ abre el menú con sus filas y el cierre de sesión", () => {
    renderHeader();

    fireEvent.click(screen.getByLabelText("Abrir menú"));

    expect(within(menu()).getByRole("button", { name: "Ver movimientos" })).toBeInTheDocument();
    expect(within(menu()).getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("monta el menú en el body para que no lo tapen las cards del listado", () => {
    renderHeader();
    fireEvent.click(screen.getByLabelText("Abrir menú"));

    // Es un overlay: si quedara dentro del árbol de la página, un ancestro con
    // `transform`, `filter` o `isolation` (el parallax del encabezado) encerraría
    // su `z-50` en ese contexto de apilado y las cards pintarían encima.
    expect(menu().parentElement).toBe(document.body);
  });

  it("Escape cierra el menú", () => {
    renderHeader();
    fireEvent.click(screen.getByLabelText("Abrir menú"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cerrar sesión llama a logout y cierra el menú", async () => {
    mockLogout.mockResolvedValue({ success: true, redirectTo: "/login" });
    renderHeader();

    fireEvent.click(screen.getByLabelText("Abrir menú"));
    fireEvent.click(within(menu()).getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("una fila de navegación es un link real al destino", () => {
    renderHeader();

    fireEvent.click(screen.getByLabelText("Abrir menú"));

    expect(within(menu()).getByRole("link", { name: "Inactivos" })).toHaveAttribute(
      "href",
      "/inventario/inactivos"
    );
  });

  it("el interruptor de tema vive en la píldora del encabezado, no dentro del menú ☰", () => {
    renderHeader();

    // El tema lo elige el usuario: si quedara detrás del menú, en el celular no
    // se alcanzaría sin abrirlo. Debe estar a la vista en los dos layouts.
    const toggle = screen.getByRole("button", { name: /^Activar tema (oscuro|claro)$/ });
    expect(toggle).toBeInTheDocument();
    expect(toggle.closest("[role='dialog']")).toBeNull();
  });

  it("una fila del menú se cierra al tocarla y dispara su acción", () => {
    const onClick = jest.fn();
    render(
      <PageHeader title="Ventas" menuItems={[{ label: "Ver movimientos", onClick }]} />
    );

    fireEvent.click(screen.getByLabelText("Abrir menú"));
    fireEvent.click(within(menu()).getByRole("button", { name: "Ver movimientos" }));

    expect(onClick).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
