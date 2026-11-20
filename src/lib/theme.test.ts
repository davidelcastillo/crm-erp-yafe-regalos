/**
 * Tema: congelado en claro (pedido del dueño 2026-11-20; el oscuro quedó con
 * la paleta anterior). El módulo sigue siendo puro: la decisión de qué tema
 * mostrar se prueba sin tocar el DOM, y el script de arranque se fija como
 * texto para que no se pueda olvidar el atributo que leen los estilos.
 */
import {
  resolveTheme,
  revealRadius,
  THEME_BOOTSTRAP_SCRIPT,
  withThemeTransition,
} from "./theme";

describe("resolveTheme", () => {
  it("respeta el tema oscuro guardado, aunque el sistema prefiera claro", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("respeta el tema claro guardado, aunque el sistema prefiera oscuro", () => {
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("sin nada guardado sigue la preferencia del sistema", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });
});

describe("THEME_BOOTSTRAP_SCRIPT", () => {
  it("congela el tema en claro antes del primer pintado (pedido del dueño)", () => {
    // El modo oscuro quedó con la paleta anterior: ni la preferencia guardada
    // ni la del sistema lo activan hasta que se rediseñe.
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('setAttribute("data-theme","light")');
    expect(THEME_BOOTSTRAP_SCRIPT).not.toContain("localStorage");
    expect(THEME_BOOTSTRAP_SCRIPT).not.toContain("prefers-color-scheme");
  });
});

describe("cambio de tema en círculo (S12)", () => {
  const matchMediaOriginal = window.matchMedia;

  const conSoporte = (soportado: boolean, reducido = false) => {
    (document as unknown as { startViewTransition?: unknown }).startViewTransition = soportado
      ? jest.fn((update: () => void) => {
          update();
          return { finished: Promise.resolve() };
        })
      : undefined;

    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: reducido && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
  };

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
    (document as unknown as { startViewTransition?: unknown }).startViewTransition = undefined;
  });

  it("el radio del círculo llega a la esquina más lejana", () => {
    expect(revealRadius({ x: 500, y: 400 }, 1000, 800)).toBeCloseTo(Math.hypot(500, 400));
    expect(revealRadius({ x: 0, y: 0 }, 1000, 800)).toBeCloseTo(Math.hypot(1000, 800));
  });

  it("con soporte y sin movimiento reducido, el cambio va dentro de la transición", () => {
    conSoporte(true);
    const update = jest.fn();

    withThemeTransition(update, { x: 10, y: 20 });

    expect(update).toHaveBeenCalledTimes(1);
    expect(document.startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.getPropertyValue("--theme-origin-x")).toBe("10px");
    expect(document.documentElement.style.getPropertyValue("--theme-origin-y")).toBe("20px");
    expect(document.documentElement.style.getPropertyValue("--theme-reveal")).toMatch(/px$/);
  });

  it("sin soporte del navegador, el tema cambia igual de golpe", () => {
    conSoporte(false);
    const update = jest.fn();

    withThemeTransition(update, { x: 0, y: 0 });

    expect(update).toHaveBeenCalledTimes(1);
  });

  it("con movimiento reducido no se anima aunque el navegador sepa hacerlo", () => {
    conSoporte(true, true);
    const update = jest.fn();

    withThemeTransition(update);

    expect(update).toHaveBeenCalledTimes(1);
    expect(document.startViewTransition).not.toHaveBeenCalled();
  });
});
