/**
 * @jest-environment jsdom
 */

/**
 * Selector de sucursal en cards: reemplaza a los `<select>` en los modales que
 * piden sucursal (venta, mover stock, cerrar caja, movimientos de caja, exportar,
 * entrada/salida). El elegido se marca con el anillo de marca; los excluidos
 * (por ejemplo el origen, al elegir el destino) se ven deshabilitados.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { BranchPicker } from "./BranchPicker";

const branches = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

describe("BranchPicker", () => {
  it("lista todas las sucursales y marca la elegida", () => {
    render(<BranchPicker branches={branches} value={2} onChange={jest.fn()} label="Sucursal" />);

    expect(screen.getByRole("button", { name: "Principal" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Centro" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Centro" }).className).toContain("#ec4899");
  });

  it("avisa la sucursal elegida al tocarla", () => {
    const onChange = jest.fn();
    render(<BranchPicker branches={branches} value={null} onChange={onChange} label="Sucursal" />);

    fireEvent.click(screen.getByRole("button", { name: "Centro" }));

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("deshabilita y no avisa las sucursales excluidas", () => {
    const onChange = jest.fn();
    render(
      <BranchPicker
        branches={branches}
        value={null}
        onChange={onChange}
        disabledIds={[1]}
        label="Sucursal destino"
      />
    );

    const excluida = screen.getByRole("button", { name: "Principal" });
    expect(excluida).toBeDisabled();
    fireEvent.click(excluida);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("muestra el aviso cuando no hay sucursales disponibles", () => {
    render(
      <BranchPicker
        branches={[]}
        value={null}
        onChange={jest.fn()}
        emptyLabel="No hay sucursales activas"
        label="Sucursal"
      />
    );

    expect(screen.getByText("No hay sucursales activas")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
