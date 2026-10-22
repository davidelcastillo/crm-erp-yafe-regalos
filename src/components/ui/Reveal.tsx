"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { revealMotion, stagger, transitions } from "@/lib/motion";

export interface RevealProps {
  children: ReactNode;
  /** Posición en la lista: aplica el retardo en cascada (S7). */
  index?: number;
  /** Retardo explícito en segundos; gana sobre `index`. */
  delay?: number;
  className?: string;
}

/**
 * Envoltorio de lo que aparece al entrar en pantalla (cards de listas, bloques
 * del recorrido). Sube 12 px y aparece una sola vez.
 *
 * No anima —y muestra el contenido tal cual— si el usuario pidió movimiento
 * reducido o si el navegador no tiene `IntersectionObserver`: en los dos casos
 * esconder el contenido sería peor que no animarlo.
 */
export const Reveal = ({ children, index, delay, className }: RevealProps) => {
  const reduceMotion = useReducedMotion();
  const canAnimate = !reduceMotion && typeof IntersectionObserver !== "undefined";

  if (!canAnimate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={revealMotion.initial}
      whileInView={revealMotion.whileInView}
      viewport={revealMotion.viewport}
      transition={{ ...transitions.reveal, delay: delay ?? (index === undefined ? 0 : stagger(index)) }}
    >
      {children}
    </motion.div>
  );
};
