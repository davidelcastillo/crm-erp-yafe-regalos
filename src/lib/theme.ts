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

/** Duración del cambio de tema. Tiene que coincidir con el CSS (`globals.css`). */
export const THEME_TRANSITION_MS = 2200;

/** Centro del botón que disparó el cambio: de ahí sale el círculo. */
export interface ThemeOrigin {
  x: number;
  y: number;
}

/**
 * Aplica el tema: atributo en el `<html>` (que es lo que lee el CSS) y la
 * preferencia guardada. `localStorage` puede fallar en modo privado; no es
 * motivo para dejar la pantalla sin cambiar.
 */
export const applyTheme = (theme: Theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Sin persistencia: el tema vale para esta visita.
  }
};

/** Radio que cubre la pantalla desde el origen hasta la esquina más lejana. */
export const revealRadius = (origin: ThemeOrigin, width: number, height: number) =>
  Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y));

/** La API existe en los navegadores modernos; el tipo del DOM la da por presente. */
type TransitionableDocument = Pick<Document, "startViewTransition">;

/**
 * ¿Se puede animar el cambio? Necesita la View Transitions API y que el usuario
 * no haya pedido movimiento reducido. En los dos casos que faltan, el tema
 * cambia igual, de golpe: la animación es un gusto, no un requisito.
 */
export const canTransitionTheme = (): boolean => {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  if (typeof (document as Partial<TransitionableDocument>).startViewTransition !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/**
 * Cambia el tema con una apertura en círculo desde `origin` (S12): el tema nuevo
 * se revela encima del viejo, así el cambio se lee como un barrido y no como un
 * parpadeo. `update` es lo que cambia el DOM —el atributo y el estado de React— y
 * corre dentro de la transición, que es lo que permite capturar el antes y el después.
 */
export const withThemeTransition = (update: () => void, origin?: ThemeOrigin) => {
  if (!canTransitionTheme()) {
    update();
    return;
  }

  if (origin) {
    const root = document.documentElement;
    root.style.setProperty("--theme-origin-x", `${origin.x}px`);
    root.style.setProperty("--theme-origin-y", `${origin.y}px`);
    root.style.setProperty(
      "--theme-reveal",
      `${revealRadius(origin, window.innerWidth, window.innerHeight)}px`
    );
  }

  const start = (document as Partial<TransitionableDocument>).startViewTransition;
  start?.call(document, update);
};
