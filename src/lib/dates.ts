/**
 * Días calendario locales como clave "YYYY-MM-DD".
 *
 * `new Date("2026-10-15")` es medianoche UTC, así que en hora local (UTC-3) cae el
 * 14: usarlo como clave corría el eje del gráfico un día y dejaba el día elegido
 * afuera del rango (bug 4 y 5 del usuario). Estas funciones evitan ese `Date`.
 */

export const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

/** "2026-10-15" -> "15/10" */
export const toShortLabel = (dateKey: string) => {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
};

/** "2026-10-15" -> "15/10/2026" */
export const toFullLabel = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
};
