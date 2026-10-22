import { duration, ease, revealMotion, stagger, transitions } from "./motion";

describe("presets de movimiento", () => {
  it("usa las curvas de Material 3 por intención", () => {
    expect(ease.standard).toEqual([0.2, 0, 0, 1]);
    expect(ease.enter).toEqual([0.05, 0.7, 0.1, 1]);
    expect(ease.exit).toEqual([0.3, 0, 0.8, 0.15]);
    expect(duration).toEqual({ fast: 0.15, base: 0.25, slow: 0.4 });
  });

  it("ordena los cambios rápidos antes que los de superficie", () => {
    expect(transitions.value.duration).toBeLessThan(transitions.surface.duration as number);
    expect(transitions.surface.ease).toEqual(ease.enter);
    expect(transitions.reveal.ease).toEqual(ease.enter);
  });
});

describe("stagger", () => {
  it("escala con la posición y se acota para que la última card no llegue tarde", () => {
    expect(stagger(0)).toBe(0);
    expect(stagger(1)).toBe(0.06);
    expect(stagger(4)).toBeCloseTo(0.24);
    expect(stagger(9)).toBe(0.24);
  });

  it("acepta otro paso manteniendo el tope", () => {
    expect(stagger(2, 0.1)).toBeCloseTo(0.2);
    expect(stagger(5, 0.1)).toBe(0.24);
  });
});

describe("revealMotion", () => {
  it("aparece subiendo 12 px una sola vez", () => {
    expect(revealMotion.initial).toEqual({ opacity: 0, y: 12 });
    expect(revealMotion.whileInView).toEqual({ opacity: 1, y: 0 });
    expect(revealMotion.viewport).toEqual({ once: true, amount: 0.2 });
  });
});
