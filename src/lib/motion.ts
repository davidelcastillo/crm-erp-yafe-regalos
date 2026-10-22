import type { Transition } from "motion/react";

/**
 * Curvas y duraciones del sistema de movimiento.
 *
 * Los números son los de Material Design 3 (S6): `standard` es la curva corta y
 * funcional — un cambio de valor o un botón que se transforma tiene que sentirse
 * inmediato; `enter` desacelera y se usa para lo que aparece (un modal, una card
 * que entra al hacer scroll) porque se lee más orgánico; `exit` acelera y se usa
 * para lo que se va. Vive en CSS también (`globals.css`, `--ease-*`) para que una
 * transición de Tailwind y una de Motion no se sientan distintas.
 */
export const ease = {
  standard: [0.2, 0, 0, 1] as [number, number, number, number],
  enter: [0.05, 0.7, 0.1, 1] as [number, number, number, number],
  exit: [0.3, 0, 0.8, 0.15] as [number, number, number, number],
};

/** Duraciones en segundos, que es la unidad de Motion. */
export const duration = { fast: 0.15, base: 0.25, slow: 0.4 };

/**
 * Transiciones con nombre por intención, no por componente: así el mismo cambio
 * se anima igual en toda la app.
 * - `value` (S9): un input o un contador que cambia de valor.
 * - `transform` (S8): un botón que se achica al tocarlo, un modal que escala al abrirse.
 * - `surface` (S6): una card o un panel que cambia de estado.
 * - `reveal` (S7): lo que aparece al entrar en pantalla.
 */
export const transitions = {
  value: { duration: duration.fast, ease: ease.standard } as Transition,
  transform: { duration: duration.base, ease: ease.standard } as Transition,
  surface: { duration: duration.base, ease: ease.enter } as Transition,
  reveal: { duration: duration.slow, ease: ease.enter } as Transition,
};

/** Aparición al hacer scroll: sube un poco y aparece, una sola vez. */
export const revealMotion = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
};

/**
 * Retardo de cada elemento de una lista para que el recorrido se lea en cascada
 * (S7). Se acota a 0,24 s: pasado ese punto la última card llega tarde y la
 * página se siente lenta.
 */
export const stagger = (index: number, step = 0.06, max = 0.24) =>
  Math.min(index * step, max);
