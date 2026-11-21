/**
 * Páginas de ayuda de la tienda (`/polkalinas/ayuda/…`): las cinco del footer,
 * con el header y el footer de la tienda y el índice compartido.
 */
import { render, screen, within } from "@testing-library/react";

import AyudaLayout from "@/app/polkalinas/ayuda/layout";
import ComoComprar from "@/app/polkalinas/ayuda/como-comprar/page";
import EnviosYRetiros from "@/app/polkalinas/ayuda/envios-y-retiros/page";
import MediosDePago from "@/app/polkalinas/ayuda/medios-de-pago/page";

const PAGINAS = [
  ["/polkalinas/ayuda/como-comprar", "Cómo comprar", ComoComprar],
  ["/polkalinas/ayuda/envios-y-retiros", "Envíos y retiros", EnviosYRetiros],
  ["/polkalinas/ayuda/medios-de-pago", "Medios de pago", MediosDePago],
] as const;

const AYUDA = PAGINAS.map(([ruta]) => ruta);

describe("páginas de ayuda", () => {
  it.each(PAGINAS)("%s responde con su título y los chrome de la tienda", (_ruta, titulo, Pagina) => {
    render(
      <AyudaLayout>
        <Pagina />
      </AyudaLayout>
    );

    expect(screen.getByRole("heading", { level: 1, name: titulo })).toBeInTheDocument();
    expect(screen.getByTestId("tienda-navbar")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("el índice de ayuda lleva a las cinco páginas", () => {
    render(
      <AyudaLayout>
        <ComoComprar />
      </AyudaLayout>
    );

    const indice = screen.getByRole("navigation", { name: "Índice de ayuda" });

    expect(
      within(indice)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
    ).toEqual(AYUDA);
  });
});
