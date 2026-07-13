/**
 * Pure function to generate next sequential product code for a productCode
 * Format: PREFIX + 3 digits (e.g., AA001, PROD000, XYZ999)
 * No side effects - 100% testable in isolation
 */

export interface GetNextCodeResult {
  code: string;
  prefix: string;
  sequence: number;
}

export function getNextCode(prefix: string, existingCodes: string[]): string {
  // Validate prefix format FIRST: 2-4 uppercase letters only (strict)
  const upperPrefix = prefix.toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(upperPrefix)) {
    throw new Error(`Prefijo inválido: "${prefix}" (debe ser 2-4 letras A-Z)`);
  }

  // Extract sequences for this prefix
  const sequences = existingCodes
    .filter((code) => code.startsWith(upperPrefix))
    .map((code) => {
      const suffix = code.slice(upperPrefix.length);
      const num = parseInt(suffix, 10);
      return isNaN(num) ? null : num;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  // Determine next sequence
  const nextSequence = sequences.length === 0 ? 0 : sequences[sequences.length - 1] + 1;

  // Check limit
  if (nextSequence > 999) {
    throw new Error(`Prefijo ${upperPrefix} agotado (máximo 999 códigos)`);
  }

  // Format: PREFIX + 3 digits with leading zeros
  return `${upperPrefix}${String(nextSequence).padStart(3, "0")}`;
}

/**
 * Helper to get detailed result for testing/debugging
 */
export function getNextCodeDetail(prefix: string, existingCodes: string[]): GetNextCodeResult {
  const upperPrefix = prefix.toUpperCase();
  const code = getNextCode(prefix, existingCodes);
  const sequence = parseInt(code.slice(upperPrefix.length), 10);
  return { code, prefix: upperPrefix, sequence };
}