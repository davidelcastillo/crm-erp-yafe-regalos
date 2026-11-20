/**
 * Component tests de la vidriera pública (T4/T5 de
 * `odd/tasks/fotos-vidriera-polkalinas.md`): el catálogo renderiza las tarjetas
 * publicadas y la ficha arma el botón «Consultar por WhatsApp» con el número
 * del dueño (L4) y el mensaje con nombre y código.
 *
 * Las acciones de lectura se mockean: la consulta y el contrato de datos
 * públicos se prueban en `src/app/actions/vidriera.test.ts`.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import FichaPage from "@/app/polkalinas/[id]/page";
import PolkalinasPage from "@/app/polkalinas/page";
import { linkConsulta } from "@/app/polkalinas/components/whatsapp";
import type { VidrieraFicha, VidrieraItem } from "@/app/actions/vidriera";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

jest.mock("@/app/actions/vidriera", () => ({
  getVidriera: jest.fn(),
  getVidrieraItem: jest.fn(),
}));

const { getVidriera, getVidrieraItem } = jest.requireMock("@/app/actions/vidriera") as {
  getVidriera: jest.Mock;
  getVidrieraItem: jest.Mock;
};

const ITEMS: VidrieraItem[] = [
  {
    id: 1,
    code: "PK-1",
    name: "Campera de jean",
    price: 45000,
    kind: "PRENDA",
    estado: "DISPONIBLE",
    portada: "https://storage.test/product-images/hash-portada_sm.webp",
    categoria: "Camperas",
  },
  {
    id: 3,
    code: "AR-1",
    name: "Perfume floral",
    price: 30000,
    kind: "PRODUCT",
    estado: "AGOTADO",
    portada: null,
    categoria: null,
  },
];

const FICHA: VidrieraFicha = {
  ...ITEMS[0],
  estado: "RESERVADA",
  condicion: "Muy bueno",
  detalleCondicion: null,
  talles: ["M", "S"],
  fotos: [
    { url: "https://storage.test/product-images/hash-portada_lg.webp", alt: "Campera de frente" },
    { url: "https://storage.test/product-images/hash-espalda_lg.webp", alt: "Campera de espalda" },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  getVidriera.mockResolvedValue({
    success: true,
    data: { items: ITEMS, categorias: [{ id: 7, name: "Camperas" }] },
  });
  getVidrieraItem.mockResolvedValue({ success: true, data: FICHA });
});

describe("catálogo /polkalinas", () => {
  it("renderiza una tarjeta por ítem con nombre, precio, foto y estado", async () => {
    render(await PolkalinasPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { level: 1, name: "Polkalina's" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Campera de jean/ })).toHaveAttribute(
      "href",
      "/polkalinas/1"
    );
    expect(screen.getByRole("link", { name: /Perfume floral/ })).toHaveAttribute(
      "href",
      "/polkalinas/3"
    );
    expect(screen.getByText("$ 45.000,00")).toBeInTheDocument();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    // La foto es contenido: lleva texto alternativo con el nombre del producto.
    expect(screen.getByAltText("Campera de jean")).toHaveAttribute(
      "src",
      "https://storage.test/product-images/hash-portada_sm.webp"
    );
  });

  it("arma los chips con las categorías publicadas y filtra por la elegida", async () => {
    render(
      await PolkalinasPage({ searchParams: Promise.resolve({ categoria: "7" }) })
    );

    expect(screen.getByRole("link", { name: "Todas" })).toHaveAttribute("href", "/polkalinas");
    expect(screen.getByRole("link", { name: "Camperas" })).toHaveAttribute(
      "href",
      "/polkalinas?categoria=7"
    );
    expect(getVidriera).toHaveBeenCalledWith({ categoriaId: 7, q: undefined });
  });

  it("busca por texto desde el formulario", async () => {
    render(await PolkalinasPage({ searchParams: Promise.resolve({ q: "campera" }) }));

    expect(screen.getByRole("searchbox", { name: /buscar/i })).toHaveValue("campera");
    expect(getVidriera).toHaveBeenCalledWith({ categoriaId: undefined, q: "campera" });
  });

  it("sin ítems publicados muestra el aviso en lugar de una grilla vacía", async () => {
    getVidriera.mockResolvedValue({ success: true, data: { items: [], categorias: [] } });

    render(await PolkalinasPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/no hay prendas ni productos publicados/i)).toBeInTheDocument();
  });
});

describe("ficha /polkalinas/[id]", () => {
  it("muestra la galería, el estado y el detalle público", async () => {
    render(await FichaPage({ params: Promise.resolve({ id: "1" }) }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Campera de jean" })
    ).toBeInTheDocument();
    expect(screen.getByText("$ 45.000,00")).toBeInTheDocument();
    expect(screen.getByText("Reservada")).toBeInTheDocument();
    expect(screen.getByText("Muy bueno")).toBeInTheDocument();
    expect(screen.getByText("Talles: M, S")).toBeInTheDocument();
    expect(screen.getByAltText("Campera de frente")).toHaveAttribute(
      "src",
      "https://storage.test/product-images/hash-portada_lg.webp"
    );
  });

  it("cambia la foto grande al tocar una miniatura", async () => {
    render(await FichaPage({ params: Promise.resolve({ id: "1" }) }));

    fireEvent.click(screen.getByRole("button", { name: "Ver foto 2" }));

    expect(screen.getByAltText("Campera de espalda")).toBeInTheDocument();
  });

  it("el botón de WhatsApp lleva el número del dueño y el mensaje con nombre y código", async () => {
    render(await FichaPage({ params: Promise.resolve({ id: "1" }) }));

    const consulta = screen.getByRole("link", { name: /consultar por whatsapp/i });

    expect(consulta).toHaveAttribute("href", linkConsulta("Campera de jean", "PK-1"));
    expect(consulta.getAttribute("href")).toContain("https://wa.me/5493876360163?text=");
    expect(decodeURIComponent(consulta.getAttribute("href") ?? "")).toContain(
      "Hola! Consulto por Campera de jean (PK-1)"
    );
  });

  it("un ítem no publicado no existe para el visitante (misma respuesta que inexistente)", async () => {
    getVidrieraItem.mockResolvedValue({ success: false });

    await expect(
      FichaPage({ params: Promise.resolve({ id: "999" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("un id que no es número tampoco consulta ni renderiza", async () => {
    await expect(FichaPage({ params: Promise.resolve({ id: "abc" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(getVidrieraItem).not.toHaveBeenCalled();
  });
});
