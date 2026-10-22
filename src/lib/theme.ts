/**
 * Tema oscuro a elección del usuario (S12).
 *
 * El tema no lo decide una media query: lo decide `data-theme` en el `<html>`.
 * Así el usuario manda sobre la preferencia del sistema, y el CSS puede dar su
 * par oscuro a cada token sin tocar un solo componente.
 *
 * `THEME_BOOTSTRAP_SCRIPT` se inyecta en el `<head>` (`layout.tsx`) para aplicar
 * el tema **antes del primer pintado**: si se aplicara desde un efecto de React,
 * la página se pintaría blanca y después saltaría a oscuro.
 */
export const THEME_STORAGE_KEY = "tema";

export type Theme = "light" | "dark";

/** El tema guardado gana; si no hay nada válido guardado, manda el sistema. */
export const resolveTheme = (stored: string | null, prefersDark: boolean): Theme => {
  if (stored === "dark" || stored === "light") return stored;
  return prefersDark ? "dark" : "light";
};

/* Una sola línea a propósito: el script corre bloqueando el pintado. Un valor
   guardado que no sea "light" ni "dark" (basura en localStorage) se ignora y
   cae en la preferencia del sistema, igual que `resolveTheme`. */
export const THEME_BOOTSTRAP_SCRIPT =
  `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
  `var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);` +
  `document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})();`;
