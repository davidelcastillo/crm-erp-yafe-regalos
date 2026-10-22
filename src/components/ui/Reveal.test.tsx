import { render, screen } from "@testing-library/react";
import { Reveal } from "./Reveal";

/** jsdom no trae IntersectionObserver: se stubea para probar el camino animado. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  root = null;
  rootMargin = "";
  thresholds = [];
  constructor(callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
    void callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

describe("Reveal", () => {
  it("muestra el contenido tal cual donde no hay IntersectionObserver", () => {
    const { container } = render(
      <Reveal className="card">
        <p>Fila de venta</p>
      </Reveal>
    );

    expect(screen.getByText("Fila de venta")).toBeVisible();
    expect(container.firstChild).toHaveClass("card");
    expect((container.firstChild as HTMLElement).style.opacity).toBe("");
  });

  it("con IntersectionObserver usa el estado inicial de la animación", () => {
    const original = global.IntersectionObserver;
    global.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;

    const { container } = render(
      <Reveal index={1}>
        <p>Fila de venta</p>
      </Reveal>
    );

    expect(screen.getByText("Fila de venta")).toBeInTheDocument();
    expect((container.firstChild as HTMLElement).style.opacity).toBe("0");

    global.IntersectionObserver = original;
    FakeIntersectionObserver.instances = [];
  });
});
