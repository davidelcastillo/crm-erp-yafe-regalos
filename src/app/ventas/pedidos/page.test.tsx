/**
 * @jest-environment jsdom
 */

/**
 * Tablero de pedidos (U5, S3): cuatro columnas con sus conteos en PC, una lista
 * con selector de estado en el celular, arrastre sin librerías y el paso de
 * cobro como único camino a «Pagado».
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PedidosPage from "./page";

jest.mock("@/app/actions/pedido", () => ({
  getPedidosPorEstado: jest.fn(),
  getContadoresPedidos: jest.fn(),
  getPedido: jest.fn(),
  moverPedido: jest.fn(),
  cobrarPedido: jest.fn(),
  registrarSena: jest.fn(),
  actualizarEnvio: jest.fn(),
  cancelarPedido: jest.fn(),
}));

jest.mock("@/app/actions/prendaTaxonomy", () => ({
  getCanalVentaOptions: jest.fn(),
}));

jest.mock("@/app/actions/product", () => ({
  getProducts: jest.fn(),
  searchProducts: jest.fn(),
}));

jest.mock("@/app/actions/customer", () => ({
  getCustomers: jest.fn(),
  createCustomer: jest.fn(),
}));

jest.mock("@/actions/auth", () => ({
  logout: jest.fn(),
  getUser: jest.fn(async () => null),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: false }),
}));

jest.mock("@/lib/context/BranchContext", () => ({
  useBranch: () => ({
    branchId: 1,
    branch: { id: 1, name: "Principal" },
    branches: [{ id: 1, name: "Principal" }],
    ready: true,
    setBranchId: jest.fn(),
    refreshBranches: jest.fn(),
  }),
}));

import {
  getContadoresPedidos,
  getPedido,
  getPedidosPorEstado,
  moverPedido,
} from "@/app/actions/pedido";
import { getCanalVentaOptions } from "@/app/actions/prendaTaxonomy";
import Swal from "sweetalert2";
import { getProducts } from "@/app/actions/product";
import { getCustomers } from "@/app/actions/customer";

const mockContadores = getContadoresPedidos as jest.MockedFunction<
  typeof getContadoresPedidos
>;
const mockColumnas = getPedidosPorEstado as jest.MockedFunction<
  typeof getPedidosPorEstado
>;
const mockPedido = getPedido as jest.MockedFunction<typeof getPedido>;
const mockMover = moverPedido as jest.MockedFunction<typeof moverPedido>;
const mockCanales = getCanalVentaOptions as jest.MockedFunction<
  typeof getCanalVentaOptions
>;
const mockProductos = getProducts as jest.MockedFunction<typeof getProducts>;
const mockClientes = getCustomers as jest.MockedFunction<typeof getCustomers>;

const hoy = new Date().toISOString();

const mica = {
  id: 5,
  numero: "V-0005",
  canal: "WhatsApp",
  cliente: "Mica R.",
  ciudad: "Córdoba",
  items: [{ nombre: "Pollera escocesa", cantidad: 1 }],
  itemsRestantes: 0,
  senas: 5000,
  saldo: 8500,
  medio: "EFECTIVO",
  envioMetodo: null,
  envioEstado: null,
  total: 13500,
  venceEl: null,
  pagadoAt: null,
  entregadoAt: null,
};

const sofi = {
  ...mica,
  id: 8,
  numero: "V-0008",
  canal: "TikTok",
  cliente: "Sofi L.",
  items: [{ nombre: "Cardigan coquette", cantidad: 2 }],
  itemsRestantes: 2,
  total: 16000,
  senas: 0,
  saldo: 16000,
  venceEl: hoy,
};

const juli = {
  ...mica,
  id: 6,
  numero: "V-0006",
  cliente: "Juli M.",
  canal: "Instagram",
  items: [{ nombre: "Campera de jean", cantidad: 1 }],
  total: 27500,
  senas: 27500,
  saldo: 0,
  medio: "TRANSFERENCIA",
  pagadoAt: hoy,
};

const lu = {
  ...juli,
  id: 7,
  numero: "V-0007",
  cliente: "Lu T.",
  items: [{ nombre: "Vestido lencero", cantidad: 1 }],
  envioMetodo: "CORREO",
  envioEstado: "ETIQUETA_LISTA",
};

const columnas: Record<string, unknown[]> = {
  RESERVADO: [mica, sofi],
  PAGADO: [juli],
  PARA_ENVIAR: [lu],
  ENTREGADO: [],
};

const boardListo = async () => {
  await waitFor(() =>
    expect(
      within(screen.getByRole("region", { name: "Reservado" })).getByText("Mica R.")
    ).toBeInTheDocument()
  );
};

/** jsdom no trae DataTransfer: el arrastre de la página usa un ref, no el portapapeles. */
const arrastrar = (region: HTMLElement, cliente: string) => {
  const tarjeta = within(region).getByText(cliente).closest("article") as HTMLElement;
  fireEvent.dragStart(tarjeta);
  return tarjeta;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockContadores.mockResolvedValue({
    success: true,
    data: { RESERVADO: 2, PAGADO: 1, PARA_ENVIAR: 1, ENTREGADO: 0, CANCELADO: 0 },
  } as never);
  mockColumnas.mockImplementation((async (filtros: { estado: string }) => ({
    success: true,
    data: columnas[filtros.estado] ?? [],
  })) as never);
  mockPedido.mockResolvedValue({
    success: true,
    data: { ...mica, customer: { name: "Mica", surname: "R." } },
  } as never);
  mockMover.mockResolvedValue({ success: true, data: { id: 6 } } as never);
  mockCanales.mockResolvedValue({
    success: true,
    data: [{ id: 2, name: "WhatsApp" }],
  } as never);
  mockProductos.mockResolvedValue({ success: true, data: [] } as never);
  mockClientes.mockResolvedValue({ success: true, data: [] } as never);
});

describe("Pedidos: tablero", () => {
  it("muestra las cuatro columnas con sus conteos", async () => {
    render(<PedidosPage />);
    await boardListo();

    expect(screen.getByRole("heading", { name: /Reservado/ })).toHaveTextContent("2");
    expect(screen.getByRole("heading", { name: /Pagado/ })).toHaveTextContent("1");
    expect(screen.getByRole("heading", { name: /Para enviar/ })).toHaveTextContent("1");
    expect(screen.getByRole("heading", { name: /Entregado/ })).toHaveTextContent("0");
  });

  it("la tarjeta muestra clienta, artículos y total, sin costo", async () => {
    render(<PedidosPage />);
    await boardListo();
    const reservado = screen.getByRole("region", { name: "Reservado" });

    expect(within(reservado).getByText("Mica R.")).toBeInTheDocument();
    expect(within(reservado).getByText("Pollera escocesa ×1")).toBeInTheDocument();
    expect(within(reservado).getByText(/13\.500,00/)).toBeInTheDocument();
    expect(within(reservado).getByText("WhatsApp")).toBeInTheDocument();
    expect(within(reservado).queryByText(/costo/i)).not.toBeInTheDocument();
  });

  it("soltar una tarjeta en «Para enviar» la mueve", async () => {
    render(<PedidosPage />);
    await boardListo();
    arrastrar(screen.getByRole("region", { name: "Pagado" }), "Juli M.");

    fireEvent.drop(screen.getByRole("region", { name: "Para enviar" }));

    await waitFor(() =>
      expect(mockMover).toHaveBeenCalledWith({
        id: 6,
        desde: "PAGADO",
        hacia: "PARA_ENVIAR",
      })
    );
  });

  it("soltar en «Pagado» abre el cobro en vez de mover", async () => {
    render(<PedidosPage />);
    await boardListo();
    arrastrar(screen.getByRole("region", { name: "Reservado" }), "Mica R.");

    fireEvent.drop(screen.getByRole("region", { name: "Pagado" }));

    expect(await screen.findByText("Cobrar pedido")).toBeInTheDocument();
    expect(mockMover).not.toHaveBeenCalled();
  });

  it("en celular los segmentos cambian la columna visible", async () => {
    render(<PedidosPage />);
    await boardListo();
    const reservado = screen.getByRole("region", { name: "Reservado" });
    const paraEnviar = screen.getByRole("region", { name: "Para enviar" });
    expect(reservado).toHaveClass("flex");
    expect(paraEnviar).toHaveClass("hidden");

    const tab = screen.getByRole("tab", { name: "Para enviar (1)" });
    fireEvent.click(tab);

    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(paraEnviar).toHaveClass("flex");
    expect(reservado).toHaveClass("hidden");
  });

  it("avisa cuando una reserva vence hoy", async () => {
    render(<PedidosPage />);
    await boardListo();

    expect(
      within(screen.getByRole("region", { name: "Reservado" })).getByText("vence hoy")
    ).toBeInTheDocument();
  });

  it("no mueve una reserva derecho a «Para enviar»", async () => {
    render(<PedidosPage />);
    await boardListo();
    arrastrar(screen.getByRole("region", { name: "Reservado" }), "Mica R.");

    fireEvent.drop(screen.getByRole("region", { name: "Para enviar" }));

    await waitFor(() => expect(Swal.fire).toHaveBeenCalled());
    expect(mockMover).not.toHaveBeenCalled();
  });

  it("la reserva ofrece señar, cobrar y cancelar; lo pagado no se cancela", async () => {
    render(<PedidosPage />);
    await boardListo();
    const reservado = screen.getByRole("region", { name: "Reservado" });
    const pagado = screen.getByRole("region", { name: "Pagado" });

    // Cancelar existe SOLO en Reservado (confirmación del dueño: puede pasar,
    // no toca plata, la prenda vuelve a disponible). Pagado es irreversible.
    expect(within(reservado).getAllByRole("button", { name: "Cancelar" }).length).toBeGreaterThan(0);
    expect(within(reservado).getAllByRole("button", { name: "+ Seña" }).length).toBeGreaterThan(0);
    expect(within(reservado).getAllByRole("button", { name: "Cobrar" }).length).toBeGreaterThan(0);
    expect(within(pagado).queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });
});
