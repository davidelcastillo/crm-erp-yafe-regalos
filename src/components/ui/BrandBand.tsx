"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import type { ReactNode } from "react";

export interface BrandBandProps {
  /** Encabezado de la página (`PageHeader`): es lo que recibe el parallax. */
  header: ReactNode;
  /** Contenido que vive dentro de la banda, antes de la hoja de vidrio. */
  children?: ReactNode;
}

/**
 * Banda de marca con movimiento para páginas que **no pueden tener hooks**
 * (`/clientes` y `/sucursales` son Server Components): así el degradé que se
 * retira al scrollear (S10) y el parallax del encabezado (S11) viven en un solo
 * componente cliente en vez de volver cliente a la página o duplicar el código.
 *
 * Atenúa sólo la capa decorativa del degradé: el encabezado y sus controles
 * quedan a plena opacidad, porque un botón atenuado se lee como deshabilitado.
 */
export const BrandBand = ({ header, children }: BrandBandProps) => {
  const { scrollY } = useScroll();
  const brandOpacity = useTransform(scrollY, [0, 140], [1, 0.45]);
  const headerY = useTransform(scrollY, [0, 160], [0, 16]);
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative isolate pb-16">
      <motion.div
        className="brand-gradient pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={reduceMotion ? undefined : { opacity: brandOpacity }}
      />

      <motion.div style={reduceMotion ? undefined : { y: headerY }}>
        {header}
      </motion.div>

      {children}
    </div>
  );
};
