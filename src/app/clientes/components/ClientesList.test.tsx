/**
 * @jest-environment jsdom
 *
 * ClientesList — el buscador es un bloque propio, no la primera fila de la lista
 * (S16). El estado de la búsqueda vive acá porque la página es un Server
 * Component, así que la tarjeta de vidrio va adentro de la lista, antes de las
 * cards de clientes.
 */
import { render, screen } from "@testing-library/react";
import type { Customer } from "@prisma/client";
import { ClientesList } from "./ClientesList";

jest.mock("@/app/actions/customer", () => ({
  getCustomerHistory: jest.fn(),
  registerPayment: jest.fn(),
}));

const customers = [
  {
    id: 1,
    name: "Ana",
    surname: "Pérez",
    totalBalance: 0,
    phone: null,
    email: null,
    address: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
] as unknown as Customer[];

describe("ClientesList — buscador en su propia tarjeta (S16)", () => {
  it("el buscador tiene su tarjeta de vidrio, separada de las cards de clientes", () => {
    render(<ClientesList initialCustomers={customers} />);

    const buscador = screen.getByPlaceholderText("Buscar por nombre o apellido...");
    const tarjeta = buscador.closest(".glass-strong");

    // Es un bloque de vidrio reforzado…
    expect(tarjeta).not.toBeNull();
    // …y las cards de clientes quedan fuera de esa tarjeta.
    const card = screen.getByRole("heading", { name: "Ana Pérez" }).closest(".glass");
    expect(tarjeta?.contains(card)).toBe(false);
  });
});
