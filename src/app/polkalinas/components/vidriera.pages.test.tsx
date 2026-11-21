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
import CatalogoPage from "@/app/polkalinas/catalogo/page";
import HomePage from "@/app/polkalinas/page";
import { EstadoVidrieraBadge } from "@/app/polkalinas/components/EstadoVidrieraBadge";
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
  {
    id: 4,
    code: "PK-2",
    name: "Pollera escocesa",
    price: 20000,
    kind: "PRENDA",
    estado: "VENDIDA",
    portada: "https://storage.test/product-images/hash-pollera_sm.webp",
    categoria: "Polleras",
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

describe("home /polkalinas", () => {
  it("abre con el hero del mockup en Fraunces y los dos CTA", async () => {
    render(await HomePage());

    expect(screen.getByRole("heading", { level: 1 }).className).toContain("font-display");
    expect(screen.getByRole("link", { name: /ver catálogo/i })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo"
    );
    expect(screen.getByRole("link", { name: /cómo comprar/i })).toHaveAttribute(
      "href",
      "#comprar"
    );
  });

  it("muestra la pieza destacada del hero con su nombre y su precio", async () => {
    render(await HomePage());

    // El colgante del mockup: la foto del hero es decorativa, el dato es texto.
    expect(screen.getByText("Pieza única")).toBeInTheDocument();
    expect(screen.getByText(/Campera de jean · \$ 45\.000,00/)).toBeInTheDocument();
  });

  it("arma «Recién llegado» con 8 destacados y el «Ver todo» al catálogo", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: {
        items: Array.from({ length: 10 }, (_, indice) => ({
          ...ITEMS[0],
          id: indice + 10,
          code: `PK-${indice + 10}`,
          name: `Prenda ${indice + 10}`,
          portada: null,
        })),
        categorias: [{ id: 7, name: "Camperas" }],
      },
    });

    render(await HomePage());

    const destacados = screen.getByRole("list", { name: /recién llegado/i });
    expect(destacados.querySelectorAll("li")).toHaveLength(8);
    expect(
      screen.getByRole("heading", { name: /recién llegado/i }).className
    ).toContain("font-display");
    expect(screen.getByRole("link", { name: /ver todo/i })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo"
    );
  });

  it("las categorías llevan al catálogo filtrado y «Cositas» a los productos", async () => {
    render(await HomePage());

    expect(screen.getByRole("link", { name: /^Camperas/i })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo?categoria=7"
    );
    expect(screen.getByRole("link", { name: /^Cositas/i })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo?tipo=cositas"
    );
  });

  it("sin productos publicados no ofrece la tarjeta «Cositas»", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: [ITEMS[0], ITEMS[2]], categorias: [{ id: 7, name: "Camperas" }] },
    });

    render(await HomePage());

    expect(screen.queryByRole("link", { name: /^Cositas/i })).not.toBeInTheDocument();
  });
});

describe("catálogo /polkalinas/catalogo", () => {
  it("renderiza una tarjeta por ítem con nombre, precio, foto y estado", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Catálogo");
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
      await CatalogoPage({ searchParams: Promise.resolve({ categoria: "7" }) })
    );

    expect(screen.getByRole("link", { name: "Todas" })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo"
    );
    expect(screen.getByRole("link", { name: "Camperas" })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo?categoria=7"
    );
    expect(getVidriera).toHaveBeenCalledWith({ categoriaId: 7, q: undefined });
  });

  it("pinta en cacao el chip de la categoría activa, y solo ese", async () => {
    render(
      await CatalogoPage({ searchParams: Promise.resolve({ categoria: "7" }) })
    );

    const activo = screen.getByRole("link", { name: "Camperas" });
    const todas = screen.getByRole("link", { name: "Todas" });

    expect(activo).toHaveAttribute("aria-current", "page");
    expect(activo.className).toContain("bg-ink");
    expect(activo.className).toContain("text-background");
    expect(todas).not.toHaveAttribute("aria-current");
    expect(todas.className).not.toContain("bg-ink");
  });

  it("lleva el header de la tienda: el aviso del dueño, la marca y la vuelta al catálogo", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/Envíos a todo el país desde Salta/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Polkalina's, inicio/ })).toHaveAttribute(
      "href",
      "/polkalinas"
    );
    expect(screen.getByRole("navigation", { name: /tienda/i })).toBeInTheDocument();
  });

  it("titula la página en Fraunces y cierra con la franja piano del footer", async () => {
    const { container } = render(
      await CatalogoPage({ searchParams: Promise.resolve({}) })
    );

    expect(screen.getByRole("heading", { level: 1 }).className).toContain("font-display");
    // La franja piano del footer son teclas blancas y negras, no una imagen.
    expect(container.querySelectorAll('[data-testid="franja-piano"] span')).toHaveLength(14);
    expect(container.querySelectorAll('[data-testid="franja-piano"] i')).toHaveLength(10);
  });

  it("deja el precio al final de la tarjeta, debajo del nombre y la meta", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    const tarjeta = screen.getByRole("link", { name: /Campera de jean/ });
    const bloques = Array.from(tarjeta.children);
    const ultimo = bloques[bloques.length - 1];

    expect(ultimo).toHaveTextContent("$ 45.000,00");
    expect(ultimo.className).toContain("font-display");
    expect(screen.getByText("Campera de jean").className).toContain("font-display");
    expect(bloques[bloques.length - 2]).toHaveTextContent("PK-1 · Camperas");
  });

  it("el chip «Cositas» lista los productos normales, no las prendas", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({ tipo: "cositas" }) }));

    expect(screen.getByRole("link", { name: /Perfume floral/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Campera de jean/ })).not.toBeInTheDocument();

    const cositas = screen.getByRole("link", { name: "Cositas" });
    expect(cositas).toHaveAttribute("aria-current", "page");
    expect(cositas).toHaveAttribute("href", "/polkalinas/catalogo?tipo=cositas");
    expect(getVidriera).toHaveBeenCalledWith({ categoriaId: undefined, q: undefined });
  });

  it("el header de tienda lleva al catálogo y a la home", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /Polkalina's, inicio/ })).toHaveAttribute(
      "href",
      "/polkalinas"
    );
    expect(
      screen.getByRole("navigation", { name: /tienda/i }).querySelector("a")
    ).toHaveAttribute("href", "/polkalinas/catalogo");
  });

  it("busca por texto desde el formulario", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({ q: "campera" }) }));

    expect(screen.getByRole("searchbox", { name: /buscar/i })).toHaveValue("campera");
    expect(getVidriera).toHaveBeenCalledWith({ categoriaId: undefined, q: "campera" });
  });

  it("la categoría va como etiqueta sobre la foto, solo si el ítem tiene categoría", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    // La etiqueta vive dentro de la caja de la foto, no en la meta de abajo.
    expect(screen.getByAltText("Campera de jean").parentElement).toHaveTextContent("Camperas");
    expect(screen.getByAltText("Campera de jean").parentElement?.querySelector("span")).toHaveClass(
      "absolute"
    );
    expect(screen.getByText("Sin foto").parentElement).not.toHaveTextContent("Polleras");
  });

  it("atenúa la foto cuando la prenda está vendida", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByAltText("Pollera escocesa").className).toContain("opacity-60");
    expect(screen.getByAltText("Campera de jean").className).not.toContain("opacity-60");
  });

  it("sin ítems publicados muestra el aviso en lugar de una grilla vacía", async () => {
    getVidriera.mockResolvedValue({ success: true, data: { items: [], categorias: [] } });

    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/no hay prendas ni productos publicados/i)).toBeInTheDocument();
  });
});

describe("EstadoVidrieraBadge", () => {
  it.each([
    ["DISPONIBLE", "Disponible", "bg-surface"],
    ["RESERVADA", "Reservada · consultá", "bg-col-reservado"],
    ["VENDIDA", "Vendida", "bg-ink"],
    ["AGOTADO", "Agotado", "bg-error-surface"],
  ] as const)("el estado %s se lee con su texto y su fondo del tema", (estado, texto, fondo) => {
    const { container } = render(<EstadoVidrieraBadge estado={estado} />);

    expect(screen.getByText(texto)).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass(fondo);
    // Vendida suma el candado: no depende solo del color.
    expect(container.querySelector("svg") !== null).toBe(estado === "VENDIDA");
  });
});

describe("ficha /polkalinas/[id]", () => {
  it("muestra la galería, el estado y el detalle público", async () => {
    render(await FichaPage({ params: Promise.resolve({ id: "1" }) }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Campera de jean" })
    ).toBeInTheDocument();
    expect(screen.getByText("$ 45.000,00")).toBeInTheDocument();
    expect(screen.getByText("Reservada · consultá")).toBeInTheDocument();
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

  it("cierra con la franja piano, como el catálogo", async () => {
    const { container } = render(await FichaPage({ params: Promise.resolve({ id: "1" }) }));

    expect(container.querySelectorAll('[data-testid="franja-piano"]')).toHaveLength(1);
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
