// src/app/fonts.ts
import { Fraunces, Work_Sans } from "next/font/google";

/**
 * Tipografías Polkalina's (spec §11.2 + mockups). Reglas de la variante A:
 * Fraunces REGULAR para títulos de página (la itálica es solo para la marca y
 * precios destacados, que van con la variante B); Work Sans para cuerpo,
 * botones, badges y datos tabulares (`tabular-nums`).
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-fraunces",
});

export const workSans = Work_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-work-sans",
});
