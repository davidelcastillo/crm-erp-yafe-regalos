/**
 * @jest-environment jsdom
 */

/**
 * S4 del usuario: «Caja» y «Cerrar caja» eran dos botones que abrían dos modales
 * parecidos. Acá se elige qué se va a hacer en un solo lugar (paso 1 de 2).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { CashMenuModal } from "./CashMenuModal";

const noop = () => {};

describe("CashMenuModal: un solo acceso con pasos", () => {
  it("ofrece las dos acciones de la caja", () => {
    render(<CashMenuModal open onClose={noop} onPick={noop} />);

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: /Movimientos de caja/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cerrar caja/ })).toBeInTheDocument();
  });

  it("avisa qué paso eligió el usuario", () => {
    const onPick = jest.fn();
    render(<CashMenuModal open onClose={noop} onPick={onPick} />);

    fireEvent.click(screen.getByRole("button", { name: /Cerrar caja/ }));

    expect(onPick).toHaveBeenCalledWith("cierre");
  });

  it("cierra con Escape y con el botón ✕", () => {
    const onClose = jest.fn();
    const { rerender } = render(<CashMenuModal open onClose={onClose} onPick={noop} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<CashMenuModal open onClose={onClose} onPick={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("no renderiza nada cuando está cerrado", () => {
    render(<CashMenuModal open={false} onClose={noop} onPick={noop} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
