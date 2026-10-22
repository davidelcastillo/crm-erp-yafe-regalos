"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

/**
 * Interruptor de tema (S12): un botón redondo que alterna claro y oscuro.
 *
 * La fuente de verdad es el `documentElement`, donde el script de arranque de
 * `layout.tsx` ya dejó el tema antes del primer pintado. `useSyncExternalStore`
 * lee ese valor sin un `setState` dentro de un efecto (que dispararía un render
 * extra en cascada) y sin desajustar la hidratación: en el servidor vale "light",
 * que es el HTML que viaja.
 *
 * El aviso del cambio es un evento propio y no un `MutationObserver` para que el
 * re-render ocurra dentro del mismo click.
 */
const CHANGE_EVENT = "tema-cambiado";

const readTheme = (): Theme =>
  document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
};

export const ThemeToggle = () => {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  const toggle = () => {
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === "dark" ? "Activar tema oscuro" : "Activar tema claro"}
      className="btn btn-icon btn-round text-ink hover:bg-surface/60"
    >
      {theme === "dark" ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" strokeWidth={2} />
          <path
            strokeLinecap="round"
            strokeWidth={2}
            d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
          />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"
          />
        </svg>
      )}
    </button>
  );
};
