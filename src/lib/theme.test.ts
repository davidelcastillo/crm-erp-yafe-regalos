/**
 * Tema oscuro a elección del usuario (S12). El módulo es puro a propósito: la
 * decisión de qué tema mostrar se puede probar sin tocar el DOM, y el script de
 * arranque se fija como texto para que no se pueda olvidar la clave de guardado
 * ni el atributo que leen los estilos.
 */
import { resolveTheme, THEME_BOOTSTRAP_SCRIPT, THEME_STORAGE_KEY } from "./theme";

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
