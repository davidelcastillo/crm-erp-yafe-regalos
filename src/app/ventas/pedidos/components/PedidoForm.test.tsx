/**
 * @jest-environment jsdom
 */

/**
 * Alta de pedido (U5, S2/S3): clienta, canal, productos con cantidad, sucursal,
 * seña opcional y vencimiento. El precio lo calcula el servidor (I7), así que el
 * payload que sale de acá no lleva precio: solo producto y cantidad.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PedidoForm } from "./PedidoForm";

jest.mock("@/app/actions/pedido", () => ({ createPedido: jest.fn() }));
// La clienta se elige de la lista que ya existe y se crea con la acción que ya
// existe: este formulario no trae lector ni alta propios.
jest.mock("@/app/actions/customer", () => ({
  getCustomers: jest.fn(),
  createCustomer: jest.fn(),
}));
jest.mock("@/app/actions/prendaTaxonomy", () => ({ getCanalVentaOptions: jest.fn() }));
// El buscador de productos usa el catálogo inyectado, no consulta al servidor.
jest.mock("@/app/actions/product", () => ({ searchProducts: jest.fn() }));
jest.mock("@/lib/context/BranchContext", () => ({
  useBranch: () => ({
    branchId: 1,
    branch: { id: 1, name: "Principal" },
    branches: [
      { id: 1, name: "Principal" },
      { id: 2, name: "Centro" },
    ],
    ready: true,
    setBranchId: jest.fn(),
    refreshBranches: jest.fn(),
  }),
}));

import { createPedido } from "@/app/actions/pedido";
import { createCustomer, getCustomers } from "@/app/actions/customer";
import { getCanalVentaOptions } from "@/app/actions/prendaTaxonomy";

const mockCrearPedido = createPedido as jest.MockedFunction<typeof createPedido>;
const mockClientes = getCustomers as jest.MockedFunction<typeof getCustomers>;
const mockCrearCliente = createCustomer as jest.MockedFunction<typeof createCustomer>;
const mockCanales = getCanalVentaOptions as jest.MockedFunction<typeof getCanalVentaOptions>;

const productos = [
  { id: 10, name: "Vestido lencero", code: "PK10", price: 1000, stock: 3 },
  { id: 11, name: "Pollerita", code: "PK11", price: 500, stock: 2 },
];

const renderForm = () => {
  const onCreated = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <PedidoForm open products={productos} onClose={onClose} onCreated={onCreated} />
  );
  return { ...utils, onCreated, onClose };
};

/** Espera a que canales (y clientas) estén cargados y devuelve el `<form>`. */
const formListo = async () => {
  await waitFor(() =>
    expect(screen.getByRole("option", { name: "WhatsApp" })).toBeInTheDocument()
  );
  return document.querySelector("form") as HTMLFormElement;
};

/** Paso 1 → 2: elige el canal (la sucursal viene preselectiva) y continúa. */
const avanzarPaso1 = () => {
  fireEvent.change(screen.getByLabelText("Canal de venta"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
};

/** Paso 2 → 3: elige la clienta, agrega el Vestido lencero y continúa. */
const avanzarPaso2 = () => {
  fireEvent.change(screen.getByLabelText("Clienta"), { target: { value: "1" } });
  agregarProducto("Vestido", "Vestido lencero");
  fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
};

const hastaPaso3 = () => {
  avanzarPaso1();
  avanzarPaso2();
};

const agregarProducto = (busqueda: string, nombre: string) => {
  fireEvent.change(screen.getByLabelText("Buscar producto"), {
    target: { value: busqueda },
  });
  fireEvent.click(screen.getByRole("option", { name: new RegExp(nombre) }));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockClientes.mockResolvedValue({
    success: true,
    data: [{ id: 1, name: "Juli", surname: "M." }],
  } as never);
  mockCanales.mockResolvedValue({
    success: true,
    data: [
      { id: 2, name: "WhatsApp" },
      { id: 3, name: "Instagram" },
    ],
  } as never);
  mockCrearPedido.mockResolvedValue({ success: true, data: { id: 7 } } as never);
});

describe("PedidoForm: alta de pedido", () => {
  it("es un wizard de 3 pasos con resumen antes de crear", async () => {
    renderForm();
    await formListo();

    // Paso 1: canal y sucursal; sin botón de crear.
    expect(screen.getByText(/paso 1 de 3/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /crear pedido/i })).not.toBeInTheDocument();
    avanzarPaso1();
    expect(screen.getByText(/paso 2 de 3/i)).toBeInTheDocument();

    // Paso 2: clienta y productos.
    avanzarPaso2();
    expect(screen.getByText(/paso 3 de 3/i)).toBeInTheDocument();

    // Paso 3: resumen de lo cargado antes de comprometer stock y caja.
    expect(screen.getByText(/Juli/)).toBeInTheDocument();
    expect(screen.getByText(/whatsapp/i)).toBeInTheDocument();
    expect(screen.getByText(/Vestido lencero/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear pedido/i })).toBeInTheDocument();

    // Se puede volver sin perder lo cargado.
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(screen.getByText(/paso 2 de 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Clienta")).toHaveValue("1");
  });

  it("llegar al paso 3 no crea el pedido: el clic de Continuar no debe submitir", async () => {
    renderForm();
    await formListo();

    avanzarPaso1();
    avanzarPaso2();

    expect(screen.getByText(/paso 3 de 3/i)).toBeInTheDocument();
    expect(mockCrearPedido).not.toHaveBeenCalled();
  });

  it("continuar sin clienta avisa qué falta y no avanza", async () => {
    renderForm();
    await formListo();
    avanzarPaso1();

    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Elegí una clienta");
    expect(screen.getByText(/paso 2 de 3/i)).toBeInTheDocument();
    expect(mockCrearPedido).not.toHaveBeenCalled();
  });

  it("muestra el total del pedido antes de crearlo", async () => {
    renderForm();
    await formListo();
    avanzarPaso1();
    agregarProducto("Vestido", "Vestido lencero");

    fireEvent.change(screen.getByLabelText("Cantidad de Vestido lencero"), {
      target: { value: "2" },
    });

    expect(screen.getByText(/2\.000,00/)).toBeInTheDocument();
  });

  it("llama a createPedido con lo que pide el servidor y sin precio", async () => {
    const { onCreated } = renderForm();
    const form = await formListo();
    avanzarPaso1();
    fireEvent.change(screen.getByLabelText("Clienta"), { target: { value: "1" } });
    agregarProducto("Vestido", "Vestido lencero");
    fireEvent.change(screen.getByLabelText("Cantidad de Vestido lencero"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    fireEvent.submit(form);

    await waitFor(() => expect(mockCrearPedido).toHaveBeenCalledTimes(1));
    expect(mockCrearPedido.mock.calls[0][0]).toEqual({
      customerId: 1,
      canalId: 2,
      branchId: 1,
      items: [{ productId: 10, cantidad: 2 }],
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it("la seña es opcional y viaja con su medio cuando se carga", async () => {
    renderForm();
    const form = await formListo();
    avanzarPaso1();
    fireEvent.change(screen.getByLabelText("Clienta"), { target: { value: "1" } });
    agregarProducto("Pollerita", "Pollerita");
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    fireEvent.change(screen.getByLabelText("Seña (opcional)"), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText("Medio de la seña"), {
      target: { value: "TRANSFERENCIA" },
    });
    fireEvent.submit(form);

    await waitFor(() => expect(mockCrearPedido).toHaveBeenCalledTimes(1));
    expect(mockCrearPedido.mock.calls[0][0]).toMatchObject({
      sena: { monto: 200, metodo: "TRANSFERENCIA" },
    });
  });

  it("muestra tal cual el error de stock del servidor, nombrando el producto", async () => {
    mockCrearPedido.mockResolvedValue({
      success: false,
      error: 'Sin stock disponible para "Vestido lencero": disponible 0, el pedido pide 2',
    } as never);
    renderForm();
    const form = await formListo();
    hastaPaso3();

    fireEvent.submit(form);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Sin stock disponible para "Vestido lencero"'
    );
  });

  it("crea la clienta sin salir del formulario y la deja elegida", async () => {
    mockClientes.mockResolvedValue({ success: true, data: [] } as never);
    mockCrearCliente.mockResolvedValue({
      success: true,
      data: { id: 42, name: "Mica", surname: "R." },
    } as never);
    renderForm();
    await formListo();
    avanzarPaso1();

    fireEvent.click(await screen.findByRole("button", { name: "Nueva clienta" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Mica" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "R." } });
    fireEvent.click(screen.getByRole("button", { name: "Crear clienta" }));

    await waitFor(() =>
      expect(mockCrearCliente).toHaveBeenCalledWith({ name: "Mica", surname: "R." })
    );
    await waitFor(() =>
      expect(within(screen.getByLabelText("Clienta")).getByRole("option", {
        name: "Mica R.",
      })).toBeInTheDocument()
    );
    expect(screen.getByLabelText("Clienta")).toHaveValue("42");
  });
});
