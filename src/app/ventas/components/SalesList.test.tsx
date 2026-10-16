/**
 * @jest-environment jsdom
 */

/**
 * S17 del usuario (L23): en el listado de ventas, las ventas de la caja anterior
 * llevan el fondo **oscurecido** y el rótulo «Caja anterior», y las nuevas
 * (posteriores al cierre) quedan en blanco, resaltadas como «activas».
 */
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { SalesList } from "./SalesList";

type Venta = ComponentProps<typeof SalesList>["sales"][number];

const ventaBase: Venta = {
  id: 1,
  date: "2026-03-04T12:00:00.000Z",
  totalAmount: 100,
  paymentMethod: "EFECTIVO",
  items: [
    {
      id: 10,
      productId: 5,
      price: 100,
      quantity: 1,
      subtotal: 100,
      product: { id: 5, name: "Producto QA" },
    },
  ],
};

/** La card es el div raíz de la venta, dentro del contenedor del listado. */
const cardDe = (container: HTMLElement) =>
  container.firstElementChild?.firstElementChild as HTMLElement;

describe("SalesList: marca de la caja anterior (S17)", () => {
  it("muestra el rótulo y el fondo oscurecido en una venta de la caja anterior", () => {
    const { container } = render(
      <SalesList sales={[{ ...ventaBase, previousCash: true }]} />
    );

    expect(screen.getByText("Caja anterior")).toBeInTheDocument();
    expect(cardDe(container).className).toContain("bg-[#f2f2f2]");
  });

  it("no muestra el rótulo y deja el fondo blanco en una venta sin caja anterior", () => {
    const { container } = render(<SalesList sales={[ventaBase]} />);

    expect(screen.queryByText("Caja anterior")).not.toBeInTheDocument();
    expect(cardDe(container).className).toContain("bg-white");
  });
});
