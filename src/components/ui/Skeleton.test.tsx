/**
 * @jest-environment jsdom
 */

/**
 * Esqueletos de carga: bloques con la forma del contenido que va a llegar, para
 * que la página no salte cuando termina la carga. Son decorativos: no se anuncian
 * al lector de pantalla (el estado lo da el `Spinner`).
 */
import { render } from "@testing-library/react";
import { CardSkeleton, Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("el bloque es decorativo y pulsa", () => {
    const { container } = render(<Skeleton className="h-4 w-1/2" />);

    const bloque = container.querySelector(".animate-pulse");
    expect(bloque).toBeInTheDocument();
    expect(bloque).toHaveAttribute("aria-hidden", "true");
    expect(bloque?.className).toContain("w-1/2");
  });

  it("el esqueleto de card dibuja la forma de una card de lista", () => {
    const { container } = render(<CardSkeleton />);

    const card = container.firstElementChild;
    expect(card).toHaveAttribute("aria-hidden", "true");
    expect(card?.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(3);
  });
});
