const MAX_CODE_LENGTH = 10;
const MAX_VARIANTS = 100;

/** Código corto y estable a partir del nombre; cae al id si el nombre no deja letras. */
export function baseBranchCode(name: string, id: number): string {
  const initials = name
    .toUpperCase()
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_CODE_LENGTH);

  return initials || `BR${id.toString().padStart(3, "0")}`;
}

/** Primer código libre: el base, o `base8 + NN` con el primer número no usado. */
export function freeBranchCode(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;

  const prefix = base.slice(0, MAX_CODE_LENGTH - 2);
  for (let counter = 1; counter < MAX_VARIANTS; counter++) {
    const candidate = `${prefix}${counter.toString().padStart(2, "0")}`;
    if (!taken.has(candidate)) return candidate;
  }

  // Falla ruidosa: es preferible no asignar código antes que duplicarlo.
  throw new Error(`No hay código libre para "${base}" tras ${MAX_VARIANTS - 1} variantes`);
}
