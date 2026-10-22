/**
 * @jest-environment jsdom
 */

/**
 * S4 del usuario: dos botones que abren variantes de lo mismo se unifican en un
 * acceso visible con pasos. Este es el componente del paso 1, compartido por la
 * caja de `/ventas`, el stock y la impresión de `/inventario`.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { OptionsMenuModal } from "./OptionsMenuModal";

const OPCIONES = [
  { id: "mover", label: "Mover stock", hint: "Entre sucursales" },
  { id: "control", label: "Control de stock", hint: "Contar y ajustar" },
];

const noop = () => {};

describe("OptionsMenuModal", () => {
  it("arma un diálogo con el título y una opción por acción", () => {
    render(
      <OptionsMenuModal open title="Stock" options={OPCIONES} onClose={noop} onPick={noop} />
    );

    const dialogo = screen.getByRole("dialog", { name: "Stock" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: /Mover stock/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Control de stock/ })).toBeInTheDocument();
    expect(screen.getByText("Entre sucursales")).toBeInTheDocument();
  });

  it("avisa qué opción eligió el usuario", () => {
    const onPick = jest.fn();
    render(
      <OptionsMenuModal open title="Stock" options={OPCIONES} onClose={noop} onPick={onPick} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Control de stock/ }));

    expect(onPick).toHaveBeenCalledWith("control");
  });

  it("cierra con Escape, con el ✕ y tocando el fondo", () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <OptionsMenuModal open title="Stock" options={OPCIONES} onClose={onClose} onPick={noop} />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <OptionsMenuModal open title="Stock" options={OPCIONES} onClose={onClose} onPick={noop} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    // Un click dentro del panel no cierra; sólo el fondo.
    const panel = screen.getByRole("dialog").firstElementChild as HTMLElement;
    fireEvent.click(panel);
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("no renderiza nada cuando está cerrado", () => {
    render(
      <OptionsMenuModal open={false} title="Stock" options={OPCIONES} onClose={noop} onPick={noop} />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
