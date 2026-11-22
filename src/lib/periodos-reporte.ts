// src/lib/periodos-reporte.ts
/**
 * Períodos de /reportes, en un módulo SIN "use client": un Server Component no
 * puede leer un array exportado desde un módulo de cliente (llega como
 * referencia, no como valor). Lo comparten la página y el filtro cliente.
 */
export const PERIODOS = [
  { value: "mes", label: "Este mes" },
  { value: "anterior", label: "Mes anterior" },
  { value: "tres", label: "Últimos 3 meses" },
] as const;

export type Periodo = (typeof PERIODOS)[number]["value"];
