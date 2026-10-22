/**
 * @jest-environment jsdom
 *
 * El selector de sucursal dentro de un encabezado real: abrir el desplegable y
 * elegir una sucursal tiene que avisar la selección. La pantalla de control lo
 * usa así (`PageHeader.right`), y su test lo mockea, de modo que este es el
 * único lugar donde se ejercita el componente de verdad.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BranchFilterDropdown } from "./BranchFilterDropdown";
import { PageHeader } from "./PageHeader";

jest.mock("@/app/actions/branch", () => ({
  getBranchOptions: jest.fn(async () => ({
    success: true,
    data: [
      { id: 1498, name: "Punto Rosa" },
      { id: 601, name: "Sucursal de prueba" },
    ],
  })),
}));

jest.mock("@/actions/auth", () => ({ logout: jest.fn() }));

describe("BranchFilterDropdown", () => {
  test("elegir una sucursal avisa el id, incluso dentro del encabezado", async () => {
    const onValueChange = jest.fn();

    render(
      <PageHeader
        title="Control de stock"
        right={
          <BranchFilterDropdown
            selectedId={null}
            onValueChange={onValueChange}
            label="Sucursal del control"
          />
        }
      />
    );

    const trigger = await screen.findByRole("button", { name: /todas las sucursales/i });
    await waitFor(() => expect(trigger).toBeEnabled());

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Punto Rosa" }));

    expect(onValueChange).toHaveBeenCalledWith(1498);
  });

  test("sin selección no avisa nada y muestra «Todas las sucursales»", async () => {
    const onValueChange = jest.fn();
    render(<BranchFilterDropdown selectedId={null} onValueChange={onValueChange} />);

    const trigger = await screen.findByRole("button", { name: /todas las sucursales/i });
    await waitFor(() => expect(trigger).toBeEnabled());

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
