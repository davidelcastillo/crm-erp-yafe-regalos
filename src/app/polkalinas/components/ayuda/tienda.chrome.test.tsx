/**
 * Piezas compartidas de la tienda pública: la barra sticky con el nav completo
 * del mockup (`web/index.html`), el buscador, el menú mobile, la franja piano y
 * el footer con los datos reales de la marca.
 *
 * No incluye páginas: cada unidad de la vidriera prueba la suya.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";

import { Piano } from "@/app/polkalinas/components/Piano";
import { TiendaFooter, TiendaHeader } from "@/app/polkalinas/components/TiendaHeader";
import { WHATSAPP_VIDRIERA } from "@/app/polkalinas/components/whatsapp";

/** El nav del mockup sin «Accesorios»: el dueño la sacó. */
const NAV = [
  ["Nuevo", "/polkalinas/catalogo?categoria=nuevo"],
  ["Second hand", "/polkalinas/catalogo?categoria=second-hand"],
  ["Intervenido", "/polkalinas/catalogo?categoria=intervenido"],
  ["Cositas", "/polkalinas/catalogo?categoria=cositas"],
  ["Cómo comprar", "/polkalinas/ayuda/como-comprar"],
];

const AYUDA = [
  "/polkalinas/ayuda/como-comprar",
  "/polkalinas/ayuda/envios-y-retiros",
  "/polkalinas/ayuda/medios-de-pago",
];

describe("barra de la tienda", () => {
  it("rinde los cinco navegadores del mockup y ninguno más", () => {
    render(<TiendaHeader />);

    const nav = screen.getByRole("navigation", { name: "Tienda" });

    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual(NAV);
    expect(within(nav).queryByRole("link", { name: "Accesorios" })).toBeNull();
  });

  it("el buscador se despliega y manda la búsqueda al catálogo con ?q=", () => {
    render(<TiendaHeader />);

    expect(screen.queryByRole("search")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    const formulario = screen.getByRole("search");
    expect(formulario).toHaveAttribute("action", "/polkalinas/catalogo");
    expect(within(formulario).getByRole("searchbox")).toHaveAttribute("name", "q");
  });

  it("queda pegado arriba con el fondo del tema, su z-index y su sombra", () => {
    render(<TiendaHeader />);

    const barra = screen.getByTestId("tienda-navbar");

    for (const clase of ["sticky", "top-0", "z-40", "bg-background", "shadow-card"]) {
      expect(barra).toHaveClass(clase);
    }
  });

  it("el menú mobile abre con el botón y cierra con Escape o con el overlay", () => {
    render(<TiendaHeader />);

    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const panel = screen.getByRole("dialog", { name: "Menú" });
    expect(
      within(panel)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
    ).toEqual(expect.arrayContaining(NAV.map(([, href]) => href)));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar menú" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("franja piano", () => {
  it("son 14 teclas blancas y 10 negras, en el header y en el footer", () => {
    const { container } = render(
      <>
        <TiendaHeader />
        <Piano crema />
      </>
    );

    const franjas = container.querySelectorAll('[data-testid="franja-piano"]');
    expect(franjas).toHaveLength(2);
    franjas.forEach((franja) => {
      expect(franja.querySelectorAll("span")).toHaveLength(14);
      expect(franja.querySelectorAll("i")).toHaveLength(10);
    });
  });

  it("la variante crema es la del footer y no la del header", () => {
    const { container } = render(
      <>
        <TiendaHeader />
        <Piano crema />
      </>
    );

    const [header, footer] = container.querySelectorAll('[data-testid="franja-piano"]');

    expect(header).toHaveClass("bg-surface");
    expect(footer).toHaveClass("bg-background");
  });
});

describe("footer de la tienda", () => {
  it("arma las cuatro columnas del mockup", () => {
    render(<TiendaFooter />);

    for (const columna of ["Comprar", "Ayuda", "Contacto"]) {
      expect(screen.getByRole("heading", { name: columna })).toBeInTheDocument();
    }
    // El link del footer se llama solo «Polkalina's»: el nombre con «, inicio»
    // es el del header, y repetirlo dejaría dos links iguales en la misma página.
    expect(screen.getByRole("link", { name: "Polkalina's" })).toHaveAttribute(
      "href",
      "/polkalinas"
    );
    expect(
      screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
        .filter((href) => href?.startsWith("/polkalinas/ayuda"))
    ).toEqual(AYUDA);
  });

  it("lleva el Instagram y el WhatsApp reales del dueño", () => {
    render(<TiendaFooter />);

    expect(screen.getByRole("link", { name: /@polkalinass_/ })).toHaveAttribute(
      "href",
      "https://www.instagram.com/polkalinass_/"
    );
    expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute(
      "href",
      `https://wa.me/${WHATSAPP_VIDRIERA}`
    );
  });

  it("muestra los datos de contacto reales del footer", () => {
    render(<TiendaFooter />);

    // Dirección, horario y TikTok ya los completa el dueño: el test no los exige.
    expect(screen.getByRole("link", { name: /instagram/i })).toHaveAttribute(
      "href",
      "https://www.instagram.com/polkalinass_/"
    );
    expect(screen.getAllByText(/387 ?636 ?0163|3876360163/).length).toBeGreaterThan(0);
  });
});
