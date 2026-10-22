"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { transitions } from "@/lib/motion";

export interface ValueChangeProps {
  children: ReactNode;
  className?: string;
}

/**
 * Un número que cambia —un total, un saldo, un contador— entra desde una
 * opacidad baja y 2 px abajo (S9). El componente no detecta el cambio: el padre
 * lo fuerza con `key={value}`, así el valor viejo y el nuevo no comparten nodo.
 *
 * Con movimiento reducido es un `span` con la misma clase, sin animación.
 */
export const ValueChange = ({ children, className }: ValueChangeProps) => {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0.4, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.value}
    >
      {children}
    </motion.span>
  );
};
