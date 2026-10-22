/**
 * Tema oscuro a elección del usuario (S12). El módulo es puro a propósito: la
 * decisión de qué tema mostrar se puede probar sin tocar el DOM, y el script de
 * arranque se fija como texto para que no se pueda olvidar la clave de guardado
 * ni el atributo que leen los estilos.
 */
import {
  resolveTheme,
  revealRadius,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
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
  it("lee la clave guardada y escribe el atributo del tema antes del primer pintado", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("localStorage");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("data-theme");
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
