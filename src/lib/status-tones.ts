/**
 * Colores de los estados de sucursal, un color por caso.
 *
 * Regla (ver `status-tones.test.ts` y STYLE.md): el texto de estos badges es
 * chico (11-12px), así que cada par fondo/texto tiene que llegar a **4.5:1**
 * de contraste (WCAG 2.1 AA para texto normal); **3:1** es el piso para texto
 * grande y para lo no textual.
 *
 * Los valores viven acá y no en clases de Tailwind porque las clases dinámicas
 * (`bg-[${hex}]`) no las genera el JIT: los badges los aplican con `style`.
 */
export type StatusTone = {
  label: string;
  background: string;
  color: string;
};

export const BRANCH_STATUS_TONES = {
  /** Sucursal por defecto (la primera): azul informativo. */
  principal: { label: "Principal", background: "#e0ecff", color: "#16408a" },
  /** Sucursal desactivada: gris de superficie, sin color de marca. */
  inactive: { label: "Inactiva", background: "#f2f2f2", color: "#4a4a4a" },
  /** Catálogo público: rojo de marca oscurecido para ganar contraste. */
  public: { label: "Pública", background: "#ffe4ea", color: "#8f0020" },
} as const satisfies Record<string, StatusTone>;
