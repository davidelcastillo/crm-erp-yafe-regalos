/**
 * Component tests de la vidriera pública (T4/T5 de
 * `odd/tasks/fotos-vidriera-polkalinas.md`): el catálogo renderiza las tarjetas
 * publicadas y la ficha arma el botón «Consultar por WhatsApp» con el número
 * del dueño (L4) y el mensaje con nombre y código.
 *
 * Las acciones de lectura se mockean: la consulta y el contrato de datos
 * públicos se prueban en `src/app/actions/vidriera.test.ts`.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";

import FichaPage from "@/app/polkalinas/[id]/page";
import CatalogoPage from "@/app/polkalinas/catalogo/page";
import CositasPage from "@/app/polkalinas/cositas/page";
import IntervenidoPage from "@/app/polkalinas/intervenido/page";
import NuevoPage from "@/app/polkalinas/nuevo/page";
import HomePage from "@/app/polkalinas/page";
import SecondHandPage from "@/app/polkalinas/second-hand/page";
import { EstadoVidrieraBadge } from "@/app/polkalinas/components/EstadoVidrieraBadge";
import { ProductoCard } from "@/app/polkalinas/components/ProductoCard";
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

/** El catálogo del rediseño: dos prendas con categoría y talles, y un producto normal. */
const CATALOGO: VidrieraItem[] = [
  {
    id: 11,
    code: "RPI-1",
    name: "Campera intervenida",
    price: 45000,
    kind: "PRENDA",
    estado: "DISPONIBLE",
    portada: null,
    categoria: "Intervenido",
    categoriaId: 2,
    talles: ["M"],
    estilos: ["Vintage", "Coquette"],
  },
  {
    id: 12,
    code: "RPH-1",
    name: "Pollera vintage",
    price: 20000,
    kind: "PRENDA",
    estado: "VENDIDA",
    portada: null,
    categoria: "Second hand",
    categoriaId: 3,
    talles: ["S"],
  },
  {
    id: 13,
    code: "AR-1",
    name: "Llavero frutilla",
    price: 5000,
    kind: "PRODUCT",
    estado: "DISPONIBLE",
    portada: null,
    categoria: null,
    categoriaId: null,
  },
  {
    id: 14,
    code: "RP-1",
    name: "Remera baby tee",
    price: 18000,
    kind: "PRENDA",
    estado: "DISPONIBLE",
    portada: null,
    categoria: "Nuevo",
    categoriaId: 1,
    talles: ["S", "M"],
    estilos: ["Vintage", "Y2K"],
  },
];

const CATEGORIAS = [
  { id: 1, name: "Nuevo" },
  { id: 2, name: "Intervenido" },
  { id: 3, name: "Second hand" },
];

/** Cositas: dos productos con su `Category` propia, uno sin categoría y una prenda suelta. */
const PRODUCTOS: VidrieraItem[] = [
  {
    id: 21,
    code: "AR-9",
    name: "Arito corazón",
    price: 3000,
    kind: "PRODUCT",
    estado: "DISPONIBLE",
    portada: null,
    categoria: "Aritos",
    categoriaId: 21,
  },
  {
    id: 22,
    code: "AR-10",
    name: "Perfume floral",
    price: 30000,
    kind: "PRODUCT",
    estado: "DISPONIBLE",
    portada: null,
    categoria: "Perfumes",
    categoriaId: 22,
  },
  {
    id: 23,
    code: "AR-11",
    name: "Sticker suelto",
    price: 500,
    kind: "PRODUCT",
    estado: "AGOTADO",
    portada: null,
    categoria: null,
    categoriaId: null,
  },
  // Una prenda publicada: en Cositas no entra y tampoco aporta categorías.
  CATALOGO[0],
];

const FICHA: VidrieraFicha = {
  ...CATALOGO[0],
  name: "Campera de jean intervenida",
  talles: ["M", "S"],
  condicion: "Muy bueno",
  detalleCondicion: null,
  descripcion: "Intervenida a mano con encaje.",
  sucursales: [],
  fotos: [
    { url: "https://storage.test/product-images/hash-portada_lg.webp", alt: "Campera de frente" },
    { url: "https://storage.test/product-images/hash-espalda_lg.webp", alt: "Campera de espalda" },
  ],
};

const FICHA_PRODUCTO: VidrieraFicha = {
  id: 13,
  code: "AR-1",
  name: "Llavero frutilla",
  price: 5000,
  kind: "PRODUCT",
  estado: "DISPONIBLE",
  portada: null,
  categoria: "Perfumes",
  categoriaId: 9,
  talles: [],
  fotos: [],
  condicion: null,
  detalleCondicion: null,
  descripcion: "Un llavero con forma de frutilla.",
  sucursales: [{ id: 1, name: "Salta" }],
};

beforeEach(() => {
  jest.clearAllMocks();
  getVidriera.mockResolvedValue({
    success: true,
    data: { items: ITEMS, categorias: [{ id: 7, name: "Camperas" }] },
  });
  getVidrieraItem.mockResolvedValue({ success: true, data: FICHA });
});

describe("ProductoCard", () => {
  it("muestra el talle en lugar del código", () => {
    render(<ProductoCard item={{ ...ITEMS[0], talles: ["M"] }} />);

    expect(screen.getByText("Talle M · única")).toBeInTheDocument();
    expect(screen.queryByText(/PK-1/)).not.toBeInTheDocument();
  });

  it("con varios talles los lista juntos", () => {
    render(<ProductoCard item={{ ...ITEMS[0], talles: ["S", "M", "L"] }} />);

    expect(screen.getByText("Talles S, M, L")).toBeInTheDocument();
  });

  it("un producto normal muestra su categoría como meta", () => {
    render(<ProductoCard item={{ ...ITEMS[1], categoria: "Perfumes" }} />);

    expect(screen.getByText("Perfumes", { selector: "p" })).toBeInTheDocument();
  });

  it("lleva el nombre en Fraunces, la etiqueta sobre la foto y el precio al final", () => {
    const { container } = render(<ProductoCard item={ITEMS[0]} />);

    expect(screen.getByText("Campera de jean").className).toContain("font-display");
    // La etiqueta vive dentro del hueco de la foto (arriba a la izquierda).
    expect(screen.getByText("Camperas", { selector: "span" })).toHaveClass(
      "absolute",
      "bg-background"
    );
    const precio = container.querySelector("p:last-child");
    expect(precio).toHaveTextContent("$ 45.000,00");
  });

  it("atinúa toda la tarjeta cuando la prenda está vendida", () => {
    render(<ProductoCard item={ITEMS[2]} />);

    expect(screen.getByRole("link", { name: /pollera escocesa/i }).className).toContain("opacity-55");
    expect(screen.getByRole("link", { name: /pollera escocesa/i }).className.split(" ")).not.toContain(
      "opacity-60"
    );
  });

  it("sin foto el hueco son lunares, nunca el cuadro gris", () => {
    render(<ProductoCard item={ITEMS[1]} />);

    const foto = screen.getByTestId("prod-foto");
    expect(foto.style.backgroundImage).toContain("radial-gradient");
    expect(foto.className).not.toContain("bg-surface-strong");
  });
});

describe("home /polkalinas", () => {
  it("abre con el hero del mockup en Fraunces y los dos CTA", async () => {
    render(await HomePage());

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toContain("font-display");
    expect(h1).toHaveTextContent("Segundas oportunidades para prendas hermosas.");
    // La parte destacada del mockup va en itálica.
    expect(within(h1).getByText("oportunidades")).toHaveClass("italic");

    expect(screen.getByRole("link", { name: /ver catálogo/i })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo"
    );
    // El header y el footer también tienen «Cómo comprar»: el del hero es el del main.
    expect(
      within(screen.getByRole("main")).getByRole("link", { name: /cómo comprar/i })
    ).toHaveAttribute("href", "/polkalinas/ayuda/como-comprar");
  });

  it("cuelga la etiqueta de la primera pieza publicada, con su agujero y su precio", async () => {
    render(await HomePage());

    // El colgante del mockup: la foto del hero es decorativa, el dato es texto.
    const colgante = screen.getByRole("link", { name: /pieza única/i });
    expect(colgante).toHaveAttribute("href", "/polkalinas/1");
    expect(colgante).toHaveTextContent("Pieza única");
    expect(colgante).toHaveTextContent("$ 45.000,00");
    // El agujero redondo: rosa con borde cacao.
    expect(colgante.firstElementChild).toHaveClass("rounded-full", "border-ink", "bg-accent-soft");
  });

  it("son lunares, no un cuadro gris, cuando la pieza del hero no tiene foto", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: [{ ...ITEMS[0], portada: null }], categorias: [] },
    });

    render(await HomePage());

    const hero = screen.getByTestId("hero-foto");
    expect(hero.style.backgroundImage).toContain("radial-gradient");
    expect(hero.className).not.toContain("bg-surface-strong");
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

  it("ofrece las cuatro categorías del mockup, cada una con su link al catálogo", async () => {
    render(await HomePage());

    // El nav de la tienda también lista categorías: las tarjetas están en el main.
    const main = within(screen.getByRole("main"));
    expect(main.getByRole("heading", { name: "Categorías" })).toBeInTheDocument();

    expect(main.getByRole("link", { name: /second hand/i })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo?categoria=second-hand"
    );
    expect(main.getByRole("link", { name: /intervenido/i })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo?categoria=intervenido"
    );
    expect(main.getByRole("link", { name: /cositas/i })).toHaveAttribute(
      "href",
      "/polkalinas/cositas"
    );
    expect(main.getByRole("link", { name: /nuevo/i })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo?categoria=nuevo"
    );
    // La cuarta tarjeta del mockup (Accesorios) no existe en la tienda.
    expect(main.queryByRole("link", { name: /accesorios/i })).not.toBeInTheDocument();
  });

  it("no repite claves entre hermanos: la frutilla de la marca dibuja cada lunar una vez", async () => {
    const errores = jest.spyOn(console, "error").mockImplementation(() => {});

    render(await HomePage());

    const repetidas = errores.mock.calls.filter((argumentos) =>
      argumentos.some((argumento) => String(argumento).includes("same key"))
    );
    errores.mockRestore();
    expect(repetidas).toEqual([]);
  });

  it("invita al próximo drop con el WhatsApp del dueño", async () => {
    render(await HomePage());

    expect(
      screen.getByRole("heading", { name: /las prendas únicas vuelan/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /avisame del próximo drop/i })
      // El dueño puede apuntar al número o al grupo de difusión de WhatsApp.
    ).toHaveAttribute("href", expect.stringMatching(/^https:\/\/(wa\.me|chat\.whatsapp\.com)\//));
  });

  it("enlaza el Instagram real y arma los seis cuadros", async () => {
    render(await HomePage());

    // El footer también enlaza el perfil: la sección está en el main.
    expect(
      within(screen.getByRole("main")).getByRole("link", { name: /@polkalinass_/ })
    ).toHaveAttribute("href", "https://www.instagram.com/polkalinass_/");
    expect(screen.getAllByTestId("ig-cuadro")).toHaveLength(6);
  });
});

describe("catálogo /polkalinas/catalogo", () => {
  beforeEach(() => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: CATALOGO, categorias: CATEGORIAS },
    });
  });

  it("pone los filtros del mockup en un aside, con los conteos por categoría", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    const filtros = screen.getByRole("complementary", { name: /filtros/i });
    expect(within(filtros).getByRole("group", { name: "Categoría" })).toBeInTheDocument();
    expect(within(filtros).getByRole("group", { name: "Talle" })).toBeInTheDocument();
    expect(within(filtros).getByRole("group", { name: "Estilo" })).toBeInTheDocument();
    expect(within(filtros).getByRole("group", { name: "Precio" })).toBeInTheDocument();
    expect(within(filtros).getByRole("checkbox", { name: /ocultar vendidas/i })).not.toBeChecked();
    // El conteo del mockup: cuántas piezas hay en cada categoría.
    expect(
      within(filtros).getByRole("checkbox", { name: /segunda|second hand/i })
    ).toHaveAccessibleName(/1/);
  });

  it("elige el orden con el select del mockup, al lado de la grilla", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    const orden = screen.getByRole("combobox", { name: /ordenar/i });
    expect(within(orden).getAllByRole("option").map((opcion) => opcion.textContent)).toEqual([
      "Más nuevas",
      "Menor precio",
      "Mayor precio",
    ]);
  });

  it("busca por texto con ?q= y deja la búsqueda como filtro activo", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({ q: "campera" }) }));

    expect(getVidriera).toHaveBeenCalledWith({ categoriaId: undefined, q: "campera" });
    const activos = screen.getByRole("group", { name: /filtros activos/i });
    expect(
      within(activos).getByRole("link", { name: /quitar filtro campera/i })
    ).toBeInTheDocument();
  });

  it("filtra por el slug de la categoría, como los links del header", async () => {
    render(
      await CatalogoPage({ searchParams: Promise.resolve({ categoria: "second-hand" }) })
    );

    expect(screen.getByRole("link", { name: /Pollera vintage/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Remera baby tee/ })).toBeNull();
  });

  it("«cositas» lista los productos normales, no las prendas", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({ categoria: "cositas" }) }));

    expect(screen.getByRole("link", { name: /Llavero frutilla/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Pollera vintage/ })).toBeNull();
  });

  it("muestra los filtros activos con su X, y solo cuando hay alguno", async () => {
    const { unmount } = render(
      await CatalogoPage({
        searchParams: Promise.resolve({ categoria: "second-hand", talle: "S" }),
      })
    );

    const activos = screen.getByRole("group", { name: /filtros activos/i });
    expect(
      within(activos).getByRole("link", { name: /quitar filtro second hand/i })
    ).toHaveAttribute("href", "/polkalinas/catalogo?talle=S");
    expect(
      within(activos).getByRole("link", { name: /quitar filtro talle s/i })
    ).toBeInTheDocument();

    unmount();
    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("group", { name: /filtros activos/i })).toBeNull();
  });

  it("arma el filtro «Estilo» con los estilos reales de las prendas, habilitados", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    const filtros = screen.getByRole("complementary", { name: /filtros/i });
    const estilos = within(filtros).getByRole("group", { name: "Estilo" });
    const checks = within(estilos).getAllByRole("checkbox") as HTMLInputElement[];

    expect(checks.map((check) => check.value)).toEqual(["Coquette", "Vintage", "Y2K"]);
    checks.forEach((check) => expect(check).toBeEnabled());
  });

  it("filtra por estilo y deja el chip activo con su X", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({ estilo: "Vintage" }) }));

    expect(screen.getByRole("link", { name: /Campera intervenida/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Llavero frutilla/ })).toBeNull();

    const filtros = screen.getByRole("complementary", { name: /filtros/i });
    expect(
      within(within(filtros).getByRole("group", { name: "Estilo" })).getByRole("checkbox", {
        name: "Vintage",
      })
    ).toBeChecked();

    const activos = screen.getByRole("group", { name: /filtros activos/i });
    expect(
      within(activos).getByRole("link", { name: /quitar filtro vintage/i })
    ).toHaveAttribute("href", "/polkalinas/catalogo");
  });

  it("combina el estilo con la categoría sin perder ninguna de las dos", async () => {
    render(
      await CatalogoPage({
        searchParams: Promise.resolve({ categoria: "cositas", estilo: "Vintage" }),
      })
    );

    // «Cositas» no tiene estilos: el filtro no rompe, solo deja la grilla vacía.
    expect(screen.getByText(/no hay prendas con esos filtros/i)).toBeInTheDocument();
    const activos = screen.getByRole("group", { name: /filtros activos/i });
    expect(
      within(activos).getByRole("link", { name: /quitar filtro cositas/i })
    ).toBeInTheDocument();
    expect(
      within(activos).getByRole("link", { name: /quitar filtro vintage/i })
    ).toHaveAttribute("href", "/polkalinas/catalogo?categoria=cositas");
  });

  it("sin estilos cargados no muestra el filtro «Estilo»", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: ITEMS, categorias: [{ id: 7, name: "Camperas" }] },
    });

    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    const filtros = screen.getByRole("complementary", { name: /filtros/i });
    expect(within(filtros).queryByRole("group", { name: "Estilo" })).toBeNull();
  });

  it("filtra por talle", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({ talle: "M" }) }));

    expect(screen.getByRole("link", { name: /Remera baby tee/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Pollera vintage/ })).toBeNull();
  });

  it("filtra por rango de precio, con los dos extremos incluidos", async () => {
    render(
      await CatalogoPage({ searchParams: Promise.resolve({ desde: "5000", hasta: "20000" }) })
    );

    expect(screen.getByRole("link", { name: /Llavero frutilla/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pollera vintage/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Campera intervenida/ })).toBeNull();
  });

  it("ordena por precio cuando se lo pedís", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({ orden: "precio-asc" }) }));

    const tarjetas = within(
      screen.getByRole("list", { name: /prendas y productos/i })
    ).getAllByRole("link");
    expect(tarjetas[0]).toHaveTextContent("Llavero frutilla");
    expect(tarjetas[tarjetas.length - 1]).toHaveTextContent("Campera intervenida");
  });

  it("esconde las vendidas cuando se lo pedís", async () => {
    render(await CatalogoPage({ searchParams: Promise.resolve({ ocultarVendidas: "1" }) }));

    expect(screen.queryByRole("link", { name: /Pollera vintage/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Remera baby tee/ })).toBeInTheDocument();
  });
  it("lleva el header de la tienda y cierra con la franja piano del footer", async () => {
    const { container } = render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/Envíos a todo el país desde Salta/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Polkalina's, inicio/ })).toHaveAttribute(
      "href",
      "/polkalinas"
    );
    expect(container.querySelectorAll('[data-testid="franja-piano"]')).toHaveLength(2);
  });

  it("sin ítems publicados muestra el aviso en lugar de una grilla vacía", async () => {
    getVidriera.mockResolvedValue({ success: true, data: { items: [], categorias: [] } });

    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/no hay prendas ni productos publicados/i)).toBeInTheDocument();
  });
});

describe("categorías del aside según lo que muestra la vista", () => {
  const grupoCategoria = () =>
    within(screen.getByRole("complementary", { name: /filtros/i })).getByRole("group", {
      name: "Categoría",
    });

  it("en el catálogo general sigue ofreciendo las categorías de prenda", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: CATALOGO, categorias: CATEGORIAS },
    });

    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    const categoria = grupoCategoria();
    expect(within(categoria).getByRole("checkbox", { name: /intervenido/i })).toHaveAccessibleName(
      /1/
    );
    expect(
      within(categoria).getByRole("checkbox", { name: /segunda|second hand/i })
    ).toHaveAccessibleName(/1/);
    expect(within(categoria).getByRole("checkbox", { name: /nuevo/i })).toHaveAccessibleName(/1/);
  });

  it("en Cositas ofrece las categorías de producto, no las de prenda", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: PRODUCTOS, categorias: CATEGORIAS },
    });

    render(await CositasPage({ searchParams: Promise.resolve({}) }));

    const categoria = grupoCategoria();
    expect(within(categoria).getByRole("checkbox", { name: /aritos/i })).toHaveAccessibleName(/1/);
    expect(within(categoria).getByRole("checkbox", { name: /perfumes/i })).toHaveAccessibleName(
      /1/
    );
    expect(within(categoria).queryByRole("checkbox", { name: /intervenido/i })).toBeNull();
    // Aritos, Perfumes y el agregado «Cositas»: el producto sin categoría no
    // agrega una opción vacía.
    expect(within(categoria).getAllByRole("checkbox")).toHaveLength(3);
  });

  it("en Cositas elegir una categoría filtra la grilla y deja el chip", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: PRODUCTOS, categorias: CATEGORIAS },
    });

    render(await CositasPage({ searchParams: Promise.resolve({ categoria: "Perfumes" }) }));

    expect(screen.getByRole("link", { name: /Perfume floral/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Arito corazón/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Sticker suelto/ })).toBeNull();

    const activos = screen.getByRole("group", { name: /filtros activos/i });
    expect(
      within(activos).getByRole("link", { name: /quitar filtro perfumes/i })
    ).toHaveAttribute("href", "/polkalinas/cositas");
  });

  it("un producto sin categoría se muestra y no rompe el aside", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: PRODUCTOS, categorias: CATEGORIAS },
    });

    render(await CositasPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /Sticker suelto/ })).toBeInTheDocument();
    expect(grupoCategoria()).toBeInTheDocument();
  });

  it("una categoría que no es de las cuatro del header también filtra, por nombre", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: ITEMS, categorias: [{ id: 7, name: "Camperas" }] },
    });

    render(await CatalogoPage({ searchParams: Promise.resolve({ categoria: "Polleras" }) }));

    expect(screen.getByRole("link", { name: /Pollera escocesa/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Campera de jean/ })).toBeNull();
    expect(
      within(screen.getByRole("group", { name: /filtros activos/i })).getByRole("link", {
        name: /quitar filtro polleras/i,
      })
    ).toBeInTheDocument();
  });

  it("cuando la vista mezcla prendas y productos, el aside ofrece solo las de prenda", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: [...CATALOGO, PRODUCTOS[0]], categorias: CATEGORIAS },
    });

    render(await CatalogoPage({ searchParams: Promise.resolve({}) }));

    const categoria = grupoCategoria();
    // La card del producto muestra su categoría, pero no crea opción de filtro.
    expect(screen.getByRole("link", { name: /Arito corazón/ })).toBeInTheDocument();
    expect(within(categoria).getByRole("checkbox", { name: /intervenido/i })).toBeInTheDocument();
    expect(within(categoria).queryByRole("checkbox", { name: /aritos/i })).toBeNull();
  });

  it.each([
    ["Nuevo", NuevoPage],
    ["Second hand", SecondHandPage],
    ["Intervenido", IntervenidoPage],
  ] as const)(
    "en la ruta %s el conteo de la categoría suma solo prendas",
    async (nombre, Pagina) => {
      // Un producto cuya `Category` se llama igual que la categoría de la ruta.
      const producto = { ...PRODUCTOS[0], id: 40, categoria: nombre };
      getVidriera.mockResolvedValue({
        success: true,
        data: { items: [...CATALOGO, producto], categorias: CATEGORIAS },
      });

      render(await Pagina({ searchParams: Promise.resolve({}) }));

      expect(within(grupoCategoria()).getByRole("checkbox", { name: `${nombre} 1` })).toBeInTheDocument();
    }
  );

  it("en Cositas no ofrece el filtro «Talle», que sí está en las rutas de prendas", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: PRODUCTOS, categorias: CATEGORIAS },
    });

    const { unmount } = render(await CositasPage({ searchParams: Promise.resolve({}) }));
    const filtros = screen.getByRole("complementary", { name: /filtros/i });
    expect(within(filtros).queryByRole("group", { name: "Talle" })).toBeNull();
    // El resto de los filtros de Cositas se mantiene.
    expect(within(filtros).getByRole("group", { name: "Categoría" })).toBeInTheDocument();
    expect(within(filtros).getByRole("group", { name: "Precio" })).toBeInTheDocument();
    expect(within(filtros).getByRole("group", { name: "Disponibilidad" })).toBeInTheDocument();

    unmount();
    render(await NuevoPage({ searchParams: Promise.resolve({}) }));
    expect(
      within(screen.getByRole("complementary", { name: /filtros/i })).getByRole("group", {
        name: "Talle",
      })
    ).toBeInTheDocument();
  });

  it("en Cositas una prenda con la misma categoría no suma a la opción de producto", async () => {
    const prenda: VidrieraItem = { ...CATALOGO[0], id: 41, categoria: "Aritos" };
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: [PRODUCTOS[0], prenda], categorias: CATEGORIAS },
    });

    render(await CositasPage({ searchParams: Promise.resolve({}) }));

    const categoria = grupoCategoria();
    expect(within(categoria).getByRole("checkbox", { name: "Aritos 1" })).toBeInTheDocument();
    expect(within(categoria).queryByRole("checkbox", { name: /intervenido/i })).toBeNull();
  });

  it("la categoría de producto también filtra en el catálogo general", async () => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: [...CATALOGO, PRODUCTOS[0]], categorias: CATEGORIAS },
    });

    render(await CatalogoPage({ searchParams: Promise.resolve({ categoria: "Aritos" }) }));

    expect(screen.getByRole("link", { name: /Arito corazón/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Campera intervenida/ })).toBeNull();
    expect(
      within(screen.getByRole("group", { name: /filtros activos/i })).getByRole("link", {
        name: /quitar filtro aritos/i,
      })
    ).toBeInTheDocument();
  });
});

describe("rutas filtradas del catálogo", () => {
  beforeEach(() => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: CATALOGO, categorias: CATEGORIAS },
    });
  });

  it.each([
    ["Nuevo", NuevoPage, /Remera baby tee/, /Pollera vintage/],
    ["Second hand", SecondHandPage, /Pollera vintage/, /Remera baby tee/],
    ["Intervenido", IntervenidoPage, /Campera intervenida/, /Remera baby tee/],
    ["Cositas", CositasPage, /Llavero frutilla/, /Campera intervenida/],
  ])("la ruta %s muestra su título y el catálogo ya filtrado", async (titulo, Pagina, presente, ausente) => {
    render(await Pagina({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(titulo);
    expect(screen.getByRole("link", { name: presente })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: ausente })).toBeNull();
    expect(screen.getByRole("complementary", { name: /filtros/i })).toBeInTheDocument();
  });

  it("el filtro «Estilo» convive con la categoría fija de la ruta", async () => {
    const { unmount } = render(
      await NuevoPage({ searchParams: Promise.resolve({ estilo: "Y2K" }) })
    );
    expect(screen.getByRole("link", { name: /Remera baby tee/ })).toBeInTheDocument();

    unmount();
    render(await NuevoPage({ searchParams: Promise.resolve({ estilo: "Coquette" }) }));
    expect(screen.queryByRole("link", { name: /Remera baby tee/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Campera intervenida/ })).toBeNull();
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
  beforeEach(() => {
    getVidriera.mockResolvedValue({
      success: true,
      data: { items: CATALOGO, categorias: CATEGORIAS },
    });
    getVidrieraItem.mockResolvedValue({ success: true, data: FICHA });
  });

  it("abre con las migas, el título en Fraunces con su parte en itálica y el precio", async () => {
    render(await FichaPage({ params: Promise.resolve({ id: "11" }) }));

    const migas = screen.getByRole("navigation", { name: /ruta/i });
    expect(within(migas).getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "href",
      "/polkalinas"
    );
    expect(within(migas).getByRole("link", { name: "Intervenido" })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo?categoria=2"
    );

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Campera de jean intervenida");
    expect(h1.className).toContain("font-display");
    expect(within(h1).getByText("intervenida")).toHaveClass("italic");
    expect(screen.getByText("$ 45.000,00")).toBeInTheDocument();
  });

  it("arriba lleva «Pieza única» y el estado, sin guía de talles ni código", async () => {
    render(await FichaPage({ params: Promise.resolve({ id: "11" }) }));

    expect(screen.getByText("Pieza única")).toBeInTheDocument();
    // El estado está en la ficha; las cards de «Te puede interesar» también lo dicen.
    expect(screen.getAllByText("Disponible", { selector: "span" }).length).toBeGreaterThan(0);
    // El footer enlaza la guía de talles como ayuda: la ficha no la repite.
    expect(within(screen.getByRole("main")).queryByText(/guía de talles/i)).toBeNull();
    expect(screen.queryByText("RPI-1")).toBeNull();
  });

  it("elige el talle y el mensaje de WhatsApp lo lleva", async () => {
    render(await FichaPage({ params: Promise.resolve({ id: "11" }) }));

    const selector = screen.getByRole("group", { name: /talle/i });
    const medio = within(selector).getByRole("button", { name: "M" });
    expect(medio).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(medio);

    expect(medio).toHaveAttribute("aria-pressed", "true");
    const consulta = screen.getByRole("link", { name: /lo quiero por whatsapp/i });
    expect(decodeURIComponent(consulta.getAttribute("href") ?? "")).toContain("Talle M");
    expect(consulta.getAttribute("href")).toContain("https://wa.me/5493876360163?text=");
  });

  it("cambia la foto grande al tocar una miniatura", async () => {
    render(await FichaPage({ params: Promise.resolve({ id: "11" }) }));

    expect(screen.getByAltText("Campera de frente")).toHaveAttribute(
      "src",
      "https://storage.test/product-images/hash-portada_lg.webp"
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver foto 2" }));

    expect(screen.getByAltText("Campera de espalda")).toBeInTheDocument();
  });

  it("muestra la descripción, el estado y las tres filas de envío, retiro y pago", async () => {
    render(await FichaPage({ params: Promise.resolve({ id: "11" }) }));

    expect(screen.getByText("Intervenida a mano con encaje.")).toBeInTheDocument();
    expect(screen.getByText(/muy bueno/i)).toBeInTheDocument();
    // El footer también enlaza estas ayudas: las filas de la ficha van en negrita.
    expect(screen.getByText("Envíos a todo el país", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Retiro en Salta", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Medios de pago", { selector: "strong" })).toBeInTheDocument();
  });

  it("al final sugiere «Te puede interesar» sin la prenda que estás viendo", async () => {
    render(await FichaPage({ params: Promise.resolve({ id: "11" }) }));

    expect(screen.getByRole("heading", { name: /te puede interesar/i })).toBeInTheDocument();
    const lista = screen.getByRole("list", { name: /te puede interesar/i });
    expect(
      within(lista).queryByRole("link", { name: /Campera de jean intervenida/ })
    ).toBeNull();
    expect(within(lista).getAllByRole("listitem").length).toBeLessThanOrEqual(4);
    expect(screen.getByRole("link", { name: /ver catálogo/i })).toHaveAttribute(
      "href",
      "/polkalinas/catalogo"
    );
  });

  it("un producto normal no tiene selector de talle y muestra descripción, categoría y sucursales", async () => {
    getVidrieraItem.mockResolvedValue({ success: true, data: FICHA_PRODUCTO });

    render(await FichaPage({ params: Promise.resolve({ id: "13" }) }));

    expect(screen.queryByRole("group", { name: /talle/i })).toBeNull();
    expect(screen.queryByText("Pieza única")).toBeNull();
    expect(screen.getByText("Un llavero con forma de frutilla.")).toBeInTheDocument();
    expect(screen.getByText(/categoría: perfumes/i)).toBeInTheDocument();
    expect(screen.getByText(/disponible en: salta/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /lo quiero por whatsapp/i })).toBeInTheDocument();
  });

  it("cierra con la franja piano, como el catálogo", async () => {
    const { container } = render(await FichaPage({ params: Promise.resolve({ id: "11" }) }));

    // Header y footer: el piano es el mismo en las dos puntas de la página.
    expect(container.querySelectorAll('[data-testid="franja-piano"]')).toHaveLength(2);
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
